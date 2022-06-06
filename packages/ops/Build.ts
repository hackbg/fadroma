import { cwd } from 'process'
import { resolve, relative, basename } from 'path'
import { execFile } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { pathToFileURL } from 'url'

import LineTransformStream from 'line-transform-stream'
import { toHex } from '@iov/encoding'
import { Sha256 } from '@iov/crypto'
import { Console, bold } from '@hackbg/konzola'
import { Dokeres, DokeresImage } from '@hackbg/dokeres'
import { Artifact } from '@fadroma/client'
import { Path } from '@fadroma/kabinet'

import { config } from './Config'
import { Endpoint } from './Endpoint'

const console = Console('Fadroma Build')

export const DEFAULT_REF = 'HEAD'

export function distinct <T> (x: T[]): T[] {
  return [...new Set(x)]
}

export const sanitize  = ref => ref.replace(/\//g, '_')

export const artifactName = (crate, ref) => `${crate}@${sanitize(ref)}.wasm`

interface WorkspaceCtor<W> {
  new (root: string, ref?: string): W // ew
}

/** Represents a Cargo workspace containing multiple smart contract crates.
  * - Point to a crate with `new Workspace(path).crate(name)`
  * - Point to a past commit with `new Workspace(path).at(ref).crate(name)`
  * - use `.crates([name1, name2])` to get multiple crates.` */
export class Workspace {

  constructor (
    public readonly root: string,
    public readonly ref:  string = DEFAULT_REF
  ) {}

  /** Create a new instance of the same workspace that will
    * return Source objects pointing to a specific Git ref. */
  at (ref: string): this {
    return new (this.constructor as WorkspaceCtor<typeof this>)(this.root, ref)
  }

  /** Get a Source object pointing to a crate from the current workspace and ref */
  crate (crate: string): Source {
    return new Source(this.root, crate, this.ref)
  }

  /** Get multiple Source objects pointing to crates from the current workspace and ref */
  crates (crates: string[]): Source[] {
    return crates.map(crate=>this.crate(crate))
  }

}

export class Source {
  constructor (
    public readonly workspace: string,
    public readonly crate:     string,
    public readonly ref?:      string
  ) {}

  build (builder: Builder): Promise<Artifact> {
    return builder.build(this)
  }
}

export abstract class Builder {
  abstract build (source: Source, ...args): Promise<Artifact>
  buildMany (sources: Source[], ...args): Promise<Artifact[]> {
    return Promise.all(sources.map(source=>this.build(source, ...args)))
  }
}

export function codeHashForPath (location: string) {
  return codeHashForBlob(readFileSync(location))
}

export function codeHashForBlob (blob: Uint8Array) {
  return toHex(new Sha256(blob).digest())
}

export abstract class CachingBuilder extends Builder {
  caching = !config.rebuild
  protected prebuild ({ workspace, crate, ref = DEFAULT_REF }: Source): Artifact|null {
    // For now, workspace-less crates are not supported.
    if (!workspace) {
      const msg = `[@fadroma/ops] Missing workspace path (for crate ${crate} at ${ref})`
      throw new Error(msg)
    }
    // Don't rebuild existing artifacts
    if (this.caching) {
      const outputDir = resolve(workspace, 'artifacts')
      const location  = resolve(outputDir, artifactName(crate, ref))
      if (existsSync(location)) {
        console.info('Exists, not rebuilding:', bold(relative(cwd(), location)))
        return { url: pathToFileURL(location), codeHash: codeHashForPath(location) }
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
    throw new Error('RawBuilder#build: not implemented')
    const { ref = DEFAULT_REF, workspace, crate } = source
    let cwd = workspace
    // LD_LIBRARY_PATH=$(nix-build -E 'import <nixpkgs>' -A 'gcc.cc.lib')/lib64
    if (ref && ref !== DEFAULT_REF) {
      await run(this.checkoutScript, [ref])
    }
    await run(this.buildScript, [])
    const location = resolve(workspace, 'artifacts', artifactName(crate, ref))
    const codeHash = codeHashForPath(location)
    return { url: pathToFileURL(location), codeHash }

    function run (cmd, args) {
      return new Promise((resolve, reject)=>{
        const env = { ...process.env, CRATE: crate, REF: ref, WORKSPACE: workspace }
        execFile(cmd, args, { cwd, env, stdio: 'inherit' } as any, (error, stdout, stderr) => {
          if (error) return reject(error)
          resolve([stdout, stderr])
        })
      })
    }
  }
}

/** This builder launches a one-off build container using Dockerode. */
export class DockerBuilder extends CachingBuilder {

  constructor (options: {
    socketPath?: string,
    docker?:     Dokeres,
    image?:      string|DokeresImage,
    dockerfile?: string,
    script?:     string
    caching?:    boolean
  } = {}) {

    super()

    // docker api handle
    this.socketPath = options.socketPath || config.dockerHost || this.socketPath
    this.docker     = options.docker || this.docker

    // docker image
    this.dockerfile = options.dockerfile
    this.script     = options.script
    if (options.image instanceof DokeresImage) {
      this.image = options.image
    } else {
      this.image = new DokeresImage(this.docker, options.image)
    }

  }

  /** Used to launch build container. */
  socketPath: string  = '/var/run/docker.sock'
  /** Used to launch build container. */
  docker:     Dokeres = new Dokeres(this.socketPath)

  /** Tag of the docker image for the build container. */
  image:      DokeresImage
  /** Path to the dockerfile to build the build container if missing. */
  dockerfile: string
  /** Path to the build script to be mounted and executed in the container. */
  script:     string

  /** Build a Source into an Artifact */
  async build (source: Source): Promise<Artifact> {
    return (await this.buildMany([source]))[0]
  }

  /** This implementation groups the passed source by workspace and ref,
    * in order to launch one build container per workspace/ref combination
    * and have it build all the crates from that combination in sequence,
    * reusing the container's internal intermediate build cache. */
  async buildMany (sources: Source[]): Promise<Artifact[]> {
    // Populate empty `ref` fields of sources with the default value
    sources = sources.map(source=>source.ref?source:Object.assign(source, {ref: DEFAULT_REF}))
    // Here we will collect the build outputs
    const artifacts:  Artifact[] = []
    // Get the distinct workspaces and refs by which to group the crate builds
    const workspaces: string[]   = distinct(sources.map(source=>source.workspace))
    const refs:       string[]   = distinct(sources.map(source=>source.ref||DEFAULT_REF))
    for (const workspace of workspaces) {
      console.info(`Building contracts from workspace:`, bold(relative(cwd(), workspace)))
      for (const ref of refs) {
        console.info(`* Building contracts from ref:`, ref)
        // Create a list of sources for this container to build,
        // along with their indices in the input and output arrays
        // of this function.
        const sourcesForContainer: [number, string][] = []
        for (let index = 0; index < sources.length; index++) {
          const source = sources[index]
          if (source.workspace === workspace && (source.ref||DEFAULT_REF) === ref) {
            sourcesForContainer.push([index, source.crate])
          }
        }
        // Build the crates from the same workspace/ref
        // sequentially in the same container.
        const artifactsFromContainer = await this.buildInContainer(
          workspace,
          ref,
          sourcesForContainer
        )
        // Collect the artifacts built by the container
        for (const index in artifactsFromContainer) {
          const artifact = artifactsFromContainer[index]
          if (artifact) {
            artifacts[index] = artifact
          }
        }
      }
    }
    return artifacts
  }

  protected async buildInContainer (
    workspace: string,
    ref:       string             = DEFAULT_REF,
    crates:    [number, string][] = []
  ): Promise<(Artifact|null)[]> {
    
    // Workspace should be an absolute path so that it can be mounted into the container.
    workspace = resolve(workspace)

    // Output slots. Indices should correspond to those of the input to buildMany
    const artifacts:   (Artifact|null)[] = crates.map(()=>null)

    // Whether any crates should be built, and at what indices they are in the input and output.
    const shouldBuild: Record<string, number> = {}

    // Collect cached artifacts. If any are missing from the cache mark them as buildable.
    for (const [index, crate] of crates) {
      const prebuilt = this.prebuild({ workspace, ref, crate })
      if (prebuilt) {
        artifacts[index] = prebuilt
      } else {
        shouldBuild[crate] = index
      }
    }

    // If there are no artifacts to build, this means everything was cached and we're done.
    if (Object.keys(shouldBuild).length === 0) {
      return artifacts
    }

    // Define the build container
    const outputDir    = resolve(workspace, 'artifacts')
    const buildScript  = `/${basename(this.script)}`
    const safeRef      = sanitize(ref)
    const readonly = {
      [this.script]: buildScript
    }
    const writable = {
      [workspace]: `/src`,
      [outputDir]: `/output`,
      // Persist cache to make future rebuilds faster. May be unneccessary.
      [`project_cache_${safeRef}`]: `/tmp/target`,
      [`cargo_cache_${safeRef}`]:   `/usr/local/cargo`
    }
    const env = {
      //'CARGO_TERM_VERBOSE': 'true',
      TERM:                         process.env.TERM,
      LOCKED:                       '',/*'--locked'*/
      CARGO_HTTP_TIMEOUT:           '240',
      CARGO_NET_GIT_FETCH_WITH_CLI: 'true',
    }
    const extra = {
      Tty:         true,
      AttachStdin: true,
    }

    // If a different ref will need to be checked out, it may contain private submodules.
    // If an unsafe option is set, this mounts the running user's *ENTIRE ~/.ssh DIRECTORY*,
    // containing their private keys, into the container, in order to enable pulling private
    // submodules over SSH. This is an edge case and ideally `git subtree` and/or
    // public HTTP-based submodules should be used instead.
    if (ref !== DEFAULT_REF) {
      if (config.buildUnsafeMountKeys) {
        // Keys for SSH cloning of submodules - dangerous!
        console.warn(
          '!!! UNSAFE: Mounting your SSH keys directory into the build container'
        )
        writable[`${config.homeDir}/.ssh`] = '/root/.ssh'
      } else {
        console.info(
          'Not mounting SSH keys into build container - '+
          'will not be able to clone private submodules'
        )
      }
    }
    
    // Options of the build container to pass to Dokeres
    const options = { remove: true, readonly, writable, env, extra }

    // Pre-populate the list of expected artifacts.
    const outputWasms = [...new Array(crates.length)].map(()=>null)
    for (const [crate, index] of Object.entries(shouldBuild)) {
      outputWasms[index] = resolve(outputDir, artifactName(crate, safeRef))
    }

    // Pass the compacted list of crates to build into the container
    const cratesToBuild = Object.keys(shouldBuild)
    const command = ['node', buildScript, 'phase1', ref, ...cratesToBuild]
    console.info(bold('Building with command:'), command.join(' '))
    console.debug(bold('in container with configuration:'), options)

    // Prepare the log output stream
    const buildLogPrefix = `[${ref}]`.padEnd(16)
    const logs = new LineTransformStream(line=>`[Fadroma Build] ${buildLogPrefix} ${line}`)
    logs.pipe(process.stdout)

    // Run the build container
    const buildName      = `fadroma-build-${sanitize(basename(workspace))}@${ref}`
    const buildContainer = await this.image.run(buildName, options, command, '/usr/bin/env', logs)
    const {Error: err, StatusCode: code} = await buildContainer.wait()

    // Throw error if launching the container failed
    if (err) {
      throw new Error(`[@fadroma/ops/Build] Docker error: ${err}`)
    }

    // Throw error if the build failed
    if (code !== 0) {
      const crateList = cratesToBuild.join(' ')
      console.error(
        'Build of crates:',   bold(crateList),
        'exited with status', bold(code)
      )
      throw new Error(
        `[@fadroma/ops/Build] Build of crates: "${crateList}" exited with status ${code}`
      )
    }

    // Return a sparse array of the resulting artifacts
    const toArtifact = location=>
      (location === null)
        ? null
        : { url: pathToFileURL(location), codeHash: codeHashForPath(location) }
    return outputWasms.map(toArtifact)

  }

}

/** This builder talks to a "remote" build server over HTTP.
  * "Remote" is in quotes because this implementation still expects
  * the source code and resulting artifact to be on the same filesystem,
  * i.e. this is only useful in a local docker-compose scenario. */
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
    const { workspace, crate, ref = DEFAULT_REF } = source
    const { location } = await this.manager.get('/build', { crate, ref })
    const codeHash = codeHashForPath(location)
    return { url: pathToFileURL(location), codeHash }
  }
}
