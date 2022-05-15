import * as HTTP from 'http'
import { resolve, relative, basename } from 'path'
import { cwd } from 'process'
import { spawnSync, execFile } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { Transform } from 'stream'
import { pathToFileURL } from 'url'
import LineTransformStream from 'line-transform-stream'
import { toHex } from '@iov/encoding'
import { Sha256 } from '@iov/crypto'
import { Console, bold } from '@hackbg/konzola'
import { Docker, DockerImage } from '@hackbg/dokeres'
import { Artifact } from '@fadroma/client'

import { config } from './Config'

const console = Console('Fadroma Build')

export const DEFAULT_REF = 'HEAD'

export function distinct <T> (x: T[]): T[] {
  return [...new Set(x)]
}

export const sanitizeRef  = ref => ref.replace(/\//g, '_')

export const artifactName = (crate, ref) => `${crate}@${sanitizeRef(ref)}.wasm`

export class Source {
  constructor (
    public readonly workspace: string,
    public readonly crate:     string,
    public readonly ref?:      string
  ) {}

  /** Take a workspace and a list of crates in it and return a function
    * that creates a mapping from crate name to Source object for a particular VCS ref. */
  static collectCrates = (workspace: string, crates: string[]) =>
    (ref?: string): Record<string, Source> =>
      crates.reduce(
        (sources, crate)=>Object.assign(sources, {[crate]: new Source(workspace, crate, ref)}),
        {}
      )

  static collect = (workspace, ref, ...crateLists): Source[] => {
    const sources: Set<string> = new Set()
    for (const crateList of crateLists) {
      for (const crate of crateList) {
        sources.add(crate)
      }
    }
    return [...sources].map(crate=>new Source(workspace, crate, ref))
  }
}

export abstract class Builder {
  abstract build (source: Source, ...args): Promise<Artifact>
  buildMany (sources: Source[], ...args): Promise<Artifact[]> {
    return Promise.all(sources.map(source=>this.build(source, ...args)))
  }
}

export function codeHashForPath (location: string) {
  return toHex(new Sha256(readFileSync(location)).digest())
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
        console.info('✅ Exists, not rebuilding:', bold(relative(cwd(), location)))
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

  run (...args) {
    throw new Error('RawBuilder#run: not implemented')
  }

  async build (source: Source): Promise<Artifact> {
    const { ref = DEFAULT_REF, workspace, crate } = source
    let cwd = workspace
    // LD_LIBRARY_PATH=$(nix-build -E 'import <nixpkgs>' -A 'gcc.cc.lib')/lib64
    const run = (cmd, args) => new Promise((resolve, reject)=>{
      const env = { ...process.env, CRATE: crate, REF: ref, WORKSPACE: workspace }
      execFile(cmd, args, { cwd, env, stdio: 'inherit' } as any, (error, stdout, stderr) => {
        if (error) return reject(error)
        resolve([stdout, stderr])
      })
    })
    if (ref && ref !== DEFAULT_REF) {
      await this.run(this.checkoutScript, [ref])
    }
    await this.run(this.buildScript, [])
    const location = resolve(workspace, 'artifacts', artifactName(crate, ref))
    const codeHash = codeHashForPath(location)
    return { url: pathToFileURL(location), codeHash }
  }
}

/** This builder launches a one-off build container using Dockerode. */
export class DockerodeBuilder extends CachingBuilder {

  constructor (options: {
    socketPath?: string,
    docker?:     Docker,
    image?:      string|DockerImage,
    dockerfile?: string,
    script?:     string
    caching?:    boolean
  } = {}) {
    super()
    this.socketPath = options.socketPath || config.dockerHost || '/var/run/docker.sock'
    this.docker     = options.docker || new Docker({ socketPath: this.socketPath })
    this.dockerfile = options.dockerfile
    this.script     = options.script
    if (options.image instanceof DockerImage) {
      this.image = options.image
    } else {
      this.image = new DockerImage(this.docker, options.image)
    }
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
    return (await this.buildMany([source]))[0]
  }

  /** This implementation groups the passed source by workspace and ref,
    * in order to launch one build container per workspace/ref combination
    * and have it build all the crates from that combination in sequence,
    * reusing the container's internal intermediate build cache. */
  async buildMany (sources) {
    // Populate empty `ref` fields of sources with the default value
    sources = sources.map(source=>source.ref?source:{...source, ref: DEFAULT_REF})
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
          workspace, ref, sourcesForContainer
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

  protected async buildInContainer (workspace, ref = DEFAULT_REF, crates: [number, string][] = []):
    Promise<(Artifact|null)[]>
  {
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
    const safeRef = sanitizeRef(ref)
    // If there are artifacts to build, make sure the build image exists
    const image = await this.image.ensure()
    // Define the build container
    const outputDir    = resolve(workspace, 'artifacts')
    const buildScript  = `/${basename(this.script)}`
    const buildOptions = {
      Tty: true,
      AttachStdin: true,
      Entrypoint: ['/bin/sh', '-c'],
      HostConfig: {
        Binds: [
          `${workspace}:/src:rw`,
          `${outputDir}:/output:rw`,
          `${this.script}:${buildScript}:ro`,
          // Persist cache to make future rebuilds faster. May be unneccessary.
          `project_cache_${safeRef}:/tmp/target:rw`,
          `cargo_cache_${safeRef}:/usr/local/cargo:rw`
        ],
        AutoRemove: true
      },
      Env: [
        'CARGO_NET_GIT_FETCH_WITH_CLI=true',
        //'CARGO_TERM_VERBOSE=true',
        'CARGO_HTTP_TIMEOUT=240',
        'LOCKED=',/*'--locked'*/
      ]
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
        buildOptions.HostConfig.Binds.push(`${config.homeDir}/.ssh:/root/.ssh:rw`)
      } else {
        console.info(
          'Not mounting SSH keys into build container - '+
          'will not be able to clone private submodules'
        )
      }
    }
    // Pre-populate the list of expected artifacts.
    const outputWasms = [...new Array(crates.length)].map(()=>null)
    for (const [crate, index] of Object.entries(shouldBuild)) {
      outputWasms[index] = resolve(outputDir, artifactName(crate, safeRef))
    }
    // Pass the compacted list of crates to build into the container
    const cratesToBuild = Object.keys(shouldBuild)
    const buildCommand  = `bash ${buildScript} phase1 ${ref} ${cratesToBuild.join(' ')}`
    console.info(bold('Running command:'), buildCommand)
    console.debug(bold('In container with this configuration:'), buildOptions)
    // Run the build container
    const [{Error: err, StatusCode: code}, container] = await this.docker.run(
      image, buildCommand, this.makeBuildLogStream(ref), buildOptions
    )
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
    return outputWasms.map(location=>{
      if (location === null) {
        return null
      } else {
        const url = pathToFileURL(location)
        const codeHash = codeHashForPath(location)
        return { url, codeHash }
      }
    })
  }

  // Creates a stream that prepends a prefix to every line output by the container.
  protected makeBuildLogStream (ref: string): LineTransformStream {
    const buildLogPrefix = `[${ref}]`.padEnd(16)
    const buildLogs = new LineTransformStream(line=>`[Fadroma Build] ${buildLogPrefix} ${line}`)
    buildLogs.pipe(process.stdout)
    return buildLogs
  }

}
