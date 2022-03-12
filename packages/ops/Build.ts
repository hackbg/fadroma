import * as HTTP from 'http'
import { Transform } from 'stream'
import LineTransformStream from 'line-transform-stream'
import {
  Console, bold, resolve, relative, basename, rimraf, spawnSync, existsSync, readFileSync
} from '@hackbg/tools'
import { config } from './Config'
import { Source, Builder, Artifact, codeHashForPath } from './Core'
import { tmp, Docker, ensureDockerImage } from '@hackbg/tools'
import { Endpoint } from './Endpoint'

const console = Console('@fadroma/ops/Build')

/** Take a workspace and a list of crates in it and return a function
  * that creates a mapping from crate name to Source object for a particular VCS ref. */
export const collectCrates = (workspace: string, crates: string[]) =>
  (ref?: string): Record<string, Source> =>
    crates.reduce(
      (sources, crate)=>Object.assign(sources, {[crate]: new Source(workspace, crate, ref)}),
      {}
    )

/** This builder talks to a remote build server over HTTP. */
export abstract class ManagedBuilder extends Builder {
  constructor (options: { managerURL?: string } = {}) {
    super()
    const { managerURL = config.buildManager } = options
    this.manager = new Endpoint(managerURL)
  }
  /** HTTP endpoint to request builds */
  manager: Endpoint
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
export abstract class DockerodeBuilder extends Builder {
  constructor (options) {
    super()
    this.image      = options.image
    this.dockerfile = options.dockerfile
    this.script     = options.script
    this.socketPath = options.socketPath || '/var/run/docker.sock'
    this.docker     = new Docker({ socketPath: this.socketPath })
  }
  /** Tag of the docker image for the build container. */
  image:      string
  /** Path to the dockerfile to build the build container if missing. */
  dockerfile: string
  /** Path to the build script to be mounted and executed in the container. */
  script:     string
  /** Used to launch build container. */
  socketPath: string
  /** Used to launch build container. */
  docker:     Docker
  /** Set the first time this Builder instance is used to build something. */
  private ensuringBuildImage: Promise<string>|null = null
  /** If `ensuringBuildImage` is not set, sets it to a Promise that resolves
    * when the build image is available. Returns that Promise every time. */
  private get buildImageReady () {
    if (!this.ensuringBuildImage) {
      console.info(bold('Ensuring build image:'), this.image, 'from', this.dockerfile)
      return this.ensuringBuildImage = ensureDockerImage(this.image, this.dockerfile, this.docker)
    } else {
      console.info(bold('Already ensuring build image from parallel build:'), this.image)
      return this.ensuringBuildImage
    }
  }
  async build (source) {
    // Support optional build caching
    const prebuilt = this.prebuild(source)
    if (prebuilt) {
      return prebuilt
    }
    const { workspace, crate, ref = 'HEAD' } = source
    const outputDir = resolve(workspace, 'artifacts')
    const location  = resolve(outputDir, `${crate}@${ref}.wasm`)
    // Wait until the build image is available.
    const image = await this.buildImageReady
    // Configuration of the build container
    const [cmd, args] = getBuildContainerArgs(workspace, crate, ref, outputDir, this.script)
    // Run the build in the container
    console.debug(
      `Running ${bold(cmd)} in ${bold(image)}`,
      `with the following options:`, args
    )
    const output = new LineTransformStream(line=>{
      const tag = `[${crate}@${ref}]`.padEnd(24)
      return `[@fadroma/ops/Build] ${tag} ${line}`
    })
    output.pipe(process.stdout)
    const running = await this.docker.run(image, cmd, output, args)
    const [{Error: err, StatusCode: code}, container] = running
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
}

export function getBuildContainerArgs (
  src:     string,
  crate:   string,
  ref:     string,
  output:  string,
  command: string,
): [string, object] {
  const cmdName = basename(command)
  const cmd = `bash /${cmdName} ${crate} ${ref}`
  const binds = []
  binds.push(`${src}:/src:rw`)                         // Input
  binds.push(`${command}:/${cmdName}:ro`)              // Procedure
  binds.push(`${output}:/output:rw`)                   // Output
  binds.push(`project_cache_${ref}:/src/target:rw`)    // Cache
  binds.push(`cargo_cache_${ref}:/usr/local/cargo:rw`) // Cache
  if (ref !== 'HEAD') {
    if (config.buildUnsafeMountKeys) {
      // Keys for SSH cloning of submodules - dangerous!
      console.warn(
        '!!! UNSAFE: Mounting your SSH keys directory into the build container'
      )
      binds.push(`${config.homeDir}/.ssh:/root/.ssh:rw`)
    } else {
      console.warn(
        'Not mounting SSH keys into build container - may not be able to clone submodules'
      )
    }
  }
  const args = { Tty:         true,
                 AttachStdin: true,
                 Entrypoint:  ['/bin/sh', '-c'],
                 HostConfig:  { Binds:      binds,
                                AutoRemove: true },
                 Env:         ['CARGO_NET_GIT_FETCH_WITH_CLI=true',
                               'CARGO_TERM_VERBOSE=true',
                               'CARGO_HTTP_TIMEOUT=240',
                               'LOCKED=',/*'--locked'*/] }
  return [cmd, args]
}

export abstract class RawBuilder extends Builder {

  async build (source: Source): Promise<Artifact> {

    throw new Error('pls review')

    const { ref = 'HEAD', workspace, crate } = source
    if (ref && ref !== 'HEAD') {
      throw new Error('[@fadroma/ops/Contract] non-HEAD builds unsupported outside Docker')
    }

    const run = (cmd: string, ...args: string[]) =>
      spawnSync(cmd, args, { cwd: workspace, stdio: 'inherit', env: {
        RUSTFLAGS:   '-C link-arg=-s',
        Output:      'TODO',
        FinalOutput: 'TODO',
      } })

    run('cargo',
        'build', '-p', crate,
        '--target', 'wasm32-unknown-unknown',
        '--release',
        '--locked',
        '--verbose')

    run('wasm-opt',
        '-Oz', './target/wasm32-unknown-unknown/release/$Output.wasm',
        '-o', '/output/$FinalOutput')

    run('sh', '-c',
        "sha256sum -b $FinalOutput > $FinalOutput.sha256")

    return { location: 'TODO' }
  }

}
