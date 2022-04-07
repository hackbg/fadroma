import * as HTTP from 'http'
import { Transform } from 'stream'
import LineTransformStream from 'line-transform-stream'
import {
  Console, bold, resolve, relative, basename, rimraf,
  spawnSync, execFile, existsSync, readFileSync
} from '@hackbg/tools'

import { config } from './Config'
import { Source, Builder, Artifact, codeHashForPath } from './Core'
import { Endpoint } from './Endpoint'
import { Docker, DockerImage } from './Docker'

const console = Console('@fadroma/ops/Build')

export abstract class CachingBuilder extends Builder {
  caching = !config.rebuild
  protected prebuild ({ workspace, crate, ref = 'HEAD' }: Source): Artifact|null {
    // For now, workspace-less crates are not supported.
    if (!workspace) {
      const msg = `[@fadroma/ops] Missing workspace path (for crate ${crate} at ${ref})`
      throw new Error(msg)
    }
    // Don't rebuild existing artifacts
    if (this.caching) {
      const outputDir = resolve(workspace, 'artifacts')
      ref = ref.replace(/\//g, '_') // kludge
      const location  = resolve(outputDir, `${crate}@${ref}.wasm`)
      if (existsSync(location)) {
        console.info('✅', bold(location), 'exists, not rebuilding.')
        return { location, codeHash: codeHashForPath(location) }
      }
    }
    return null
  }
}

/** This build mode uses the toolchain from the developer's environment. */
export class RawBuilder extends CachingBuilder {
  constructor (
    public readonly buildScript:    string,
    public readonly checkoutScript: string
  ) { super() }

  async build (source: Source): Promise<Artifact> {
    const { ref = 'HEAD', workspace, crate } = source
    let cwd = workspace
    // LD_LIBRARY_PATH=$(nix-build -E 'import <nixpkgs>' -A 'gcc.cc.lib')/lib64
    const run = (cmd, args) => new Promise((resolve, reject)=>{
      const env = { ...process.env, CRATE: crate, REF: ref, WORKSPACE: workspace }
      execFile(cmd, args, { cwd, env, stdio: 'inherit' } as any, (error, stdout, stderr) => {
        if (error) return reject(error)
        resolve([stdout, stderr])
      })
    })
    if (ref && ref !== 'HEAD') {
      await run(this.checkoutScript, [])
    }
    await run(this.buildScript, [])
    const location = resolve(workspace, 'artifacts', `${crate}@${ref.replace(/\//g,'_')}.wasm`)
    const codeHash = codeHashForPath(location)
    return { location, codeHash }
  }
}

/** This builder talks to a remote build server over HTTP. */
export class ManagedBuilder extends CachingBuilder {
  Endpoint = Endpoint

  /** HTTP endpoint to request builds */
  manager: Endpoint

  constructor (options: { managerURL?: string } = {}) {
    super()
    const { managerURL = config.buildManager } = options
    this.manager = new this.Endpoint(managerURL)
  }

  /** Perform a managed build. */
  async build (source): Promise<Artifact> {
    // Support optional build caching
    const prebuilt = this.prebuild(source)
    if (prebuilt) {
      return prebuilt
    }
    // Request a build from the build manager
    const { workspace, crate, ref = 'HEAD' } = source
    const { location } = await this.manager.get('/build', { crate, ref })
    const codeHash = codeHashForPath(location)
    return { location, codeHash }
  }
}

/** This builder launches a one-off build container using Dockerode. */
export class DockerodeBuilder extends CachingBuilder {

  constructor (options = {}) {
    super()
    this.socketPath = options.socketPath || '/var/run/docker.sock'
    this.docker     = options.docker || new Docker({ socketPath: this.socketPath })
    this.image      = options.image
    this.dockerfile = options.dockerfile
    this.script     = options.script
  }

  /** Tag of the docker image for the build container. */
  image:      DockerImage
  /** Path to the dockerfile to build the build container if missing. */
  dockerfile: string
  /** Path to the build script to be mounted and executed in the container. */
  script:     string
  /** Used to launch build container. */
  socketPath: string
  /** Used to launch build container. */
  docker:     Docker

  async build (source) {
    // Support optional build caching
    const prebuilt = this.prebuild(source)
    if (prebuilt) {
      return prebuilt
    }
    let { workspace, crate, ref = 'HEAD' } = source
    const outputDir = resolve(workspace, 'artifacts')
    const location  = resolve(outputDir, `${crate}@${ref.replace(/\//g, '_')}.wasm`)
    const image     = await this.image.ensure()
    const [cmd, args] = this.getBuildContainerArgs(source, outputDir)

    const buildLogs = new LineTransformStream(line=>{
      const tag = `[${crate}@${ref}]`.padEnd(24)
      return `[@fadroma/ops/Build] ${tag} ${line}`
    })
    buildLogs.pipe(process.stdout)
    const [
      {Error: err, StatusCode: code}, container
    ] = await this.docker.run(image, cmd, buildLogs, args)
    // Throw error if build failed
    if (err) {
      throw new Error(`[@fadroma/ops/Build] Docker error: ${err}`)
    }
    if (code !== 0) {
      console.error(bold('Build of'), crate, 'exited with', bold(code))
      throw new Error(`[@fadroma/ops/Build] Build of ${crate} exited with status ${code}`)
    }
    const codeHash = codeHashForPath(location)
    return { location, codeHash }
  }

  protected getBuildContainerArgs (
    { workspace, crate, ref = 'HEAD' }: Source,
    output
  ): [string, any] {
    const entrypoint = this.script
    const cmdName = basename(entrypoint)
    const cmd = `bash /${cmdName} ${crate} ${ref}`
    const binds = []
    binds.push(`${workspace}:/src:rw`)
    binds.push(`${output}:/output:rw`)
    binds.push(`${entrypoint}:/${cmdName}:ro`) // Procedure
    enableBuildCache(ref, binds)
    applyUnsafeMountKeys(ref, binds)
    const args = {
      Tty: true,
      AttachStdin: true,
      Entrypoint: ['/bin/sh', '-c'],
      HostConfig: { Binds: binds, AutoRemove: true },
      Env: [
        'CARGO_NET_GIT_FETCH_WITH_CLI=true',
        'CARGO_TERM_VERBOSE=true',
        'CARGO_HTTP_TIMEOUT=240',
        'LOCKED=',/*'--locked'*/
      ]
    }
    console.debug(
      `Running ${bold(cmd)} in ${bold(this.image.name)}`,
      `with the following options:`, args
    )
    return [cmd, args]
  }
}

export function getBuildContainerArgs (
  src:     string,
  crate:   string,
  ref:     string,
  output:  string,
  command: string,
): [string, object] {
  const cmdName = basename(command)
  const cmd     = `bash /${cmdName} ${crate} ${ref}`
  const binds   = []
  binds.push(`${src}:/src:rw`)
  binds.push(`/dev/null:/src/receipts:ro`)
  binds.push(`${output}:/output:rw`)
  binds.push(`${command}:/${cmdName}:ro`) // Procedure
  enableBuildCache(ref, binds)
  applyUnsafeMountKeys(ref, binds)
  const args = {
    Tty: true,
    AttachStdin: true,
    Entrypoint:  ['/bin/sh', '-c'],
    HostConfig:  { Binds: binds, AutoRemove: true },
    Env: [
      'CARGO_NET_GIT_FETCH_WITH_CLI=true',
      'CARGO_TERM_VERBOSE=true',
      'CARGO_HTTP_TIMEOUT=240',
      'LOCKED=',/*'--locked'*/
    ]
  }
  return [cmd, args]
}

function enableBuildCache (ref, binds) {
  ref = ref.replace(/\//g, '_') // kludge
  binds.push(`project_cache_${ref}:/tmp/target:rw`)    // Cache
  binds.push(`cargo_cache_${ref}:/usr/local/cargo:rw`) // Cache
}

function applyUnsafeMountKeys (ref, binds) {
  if (ref !== 'HEAD') {
    if (config.buildUnsafeMountKeys) {
      // Keys for SSH cloning of submodules - dangerous!
      console.warn(
        '!!! UNSAFE: Mounting your SSH keys directory into the build container'
      )
      binds.push(`${config.homeDir}/.ssh:/root/.ssh:rw`)
    } else {
      console.info(
        'Not mounting SSH keys into build container - '+
        'will not be able to clone private submodules'
      )
    }
  }
}
