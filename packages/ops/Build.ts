import assert from 'assert'
import { cwd } from 'process'
import { resolve, relative, basename } from 'path'
import { execFile } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { pathToFileURL } from 'url'
import simpleGit from 'simple-git'

import LineTransformStream from 'line-transform-stream'
import { toHex } from '@iov/encoding'
import { Sha256 } from '@iov/crypto'
import { Console, bold, colors } from '@hackbg/konzola'
import { Dokeres, DokeresImage } from '@hackbg/dokeres'
import $, { Path, TextFile } from '@hackbg/kabinet'
import { Artifact } from '@fadroma/client'

import { config } from './Config'
import { Endpoint } from './Endpoint'

/** The part of OperationContext that deals with building
  * contracts from source code to WASM artifacts */
export interface BuildContext {
  ref?: string

  src?: Source

  srcs?: Source[]

  builder?: Builder

  build?: (source: Source) => Promise<Artifact>

  buildMany?: (sources: Source[]) => Promise<Artifact[]>
}

const console = Console('Fadroma Build')

interface WorkspaceCtor<W> {
  new (path: string, ref?: string, gitDir?: DotGit): W
}

/** Represents a Cargo workspace containing multiple smart contract crates.
  * - Select a crate with `new Workspace(path).crate(name)`
  * - Select from past commit with `new Workspace(path).at(ref).crate(name)`
  * - Use `.crates([name1, name2])` to get multiple crates */
export class Workspace {

  constructor (
    public readonly path:   string,
    public readonly ref:    string = HEAD,
    public readonly gitDir: DotGit = new DotGit(path)
  ) {}

  /** Create a new instance of the same workspace that will
    * return Source objects pointing to a specific Git ref. */
  at (ref: string): this {
    return new (this.constructor as WorkspaceCtor<typeof this>)(this.path, ref, this.gitDir)
  }

  /** Get a Source object pointing to a crate from the current workspace and ref */
  crate (crate: string): Source {
    return new Source(this, crate)
  }

  /** Get multiple Source objects pointing to crates from the current workspace and ref */
  crates (crates: string[]): Source[] {
    return crates.map(crate=>this.crate(crate))
  }

}

/** Represents the real location of the Git data directory.
  * - In standalone repos this is `.git/`
  * - If the contracts workspace repository is a submodule,
  *   `.git` will be a file containing e.g. "gitdir: ../.git/modules/something" */
export class DotGit extends Path {

  constructor (base, ...fragments) {
    super(base, ...fragments, '.git')
    if (!this.exists) {
      // If .git does not exist, it is not possible to build past commits
      console.warn(bold(this.shortPath), 'does not exist')
      this.present = false
    } else if (this.isFile) {
      // If .git is a file, the workspace is contained in a submodule
      const gitPointer = this.as(TextFile).load().trim()
      const prefix = 'gitdir:'
      if (gitPointer.startsWith(prefix)) {
        // If .git contains a pointer to the actual git directory,
        // building past commits is possible.
        const gitRel  = gitPointer.slice(prefix.length).trim()
        const gitPath = resolve(this.parent, gitRel)
        const gitRoot = $(gitPath)
        console.info(bold(this.shortPath), 'is a file, pointing to', bold(gitRoot.shortPath))
        this.path      = gitRoot.path
        this.present   = true
        this.isSubmodule = true
      } else {
        // Otherwise, who knows?
        console.info(bold(this.shortPath), 'is an unknown file.')
        this.present = false
      }
    } else if (this.isDir) {
      // If .git is a directory, this workspace is not in a submodule
      // and it is easy to build past commits
      this.present = true
    } else {
      // Otherwise, who knows?
      console.warn(bold(this.shortPath), `is not a file or directory`)
      this.present = false
    }
  }

  readonly present:     boolean
  readonly isSubmodule: boolean = false

  get rootRepo (): Path {
    return $(this.path.split(DotGit.rootRepoRE)[0])
  }

  get submoduleDir (): string {
    return this.path.split(DotGit.rootRepoRE)[1]
  }

  /* Matches "/.git" or "/.git/" */
  static rootRepoRE = new RegExp(`${Path.separator}.git${Path.separator}?`)

}

export class Source {
  constructor (
    public readonly workspace: Workspace,
    public readonly crate:     string,
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

export abstract class CachingBuilder extends Builder {

  /** Check if artifact exists in local artifacts cache directory.
    * If it does, don't rebuild it but return it from there. */ 
  protected prebuild (outputDir: string, crate: string, ref: string = HEAD): Artifact|null {
    if (!this.caching) {
      return null
    }
    const location = resolve(outputDir, artifactName(crate, ref))
    if (existsSync(location)) {
      return { url: pathToFileURL(location), codeHash: codeHashForPath(location) }
    }
    return null
  }

  /** Caching can be disabled using FADROMA_REBUILD=1 */
  caching = !config.rebuild

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

    // Announce what will be done
    console.info('Requested to build the following contracts:')
    const longestCrateName = sources.map(source=>source.crate.length).reduce((x,y)=>Math.max(x,y),0)
    for (const source of sources) {
      const outputDir = $(source.workspace.path).resolve('artifacts')
      const prebuilt  = this.prebuild(outputDir, source.crate, source.workspace.ref)
      console.info(
        bold(source.crate.padEnd(longestCrateName)),
        'from', bold(`${$(source.workspace.path).shortPath}/`),
        '@',    bold(source.workspace.ref),
        prebuilt ? '(exists, not rebuilding)': ''
      )
    }

    // Collect a mapping of workspace path -> Workspace object
    const workspaces: Record<string, Workspace> = {}
    for (const source of sources) {
      workspaces[source.workspace.path] = source.workspace
      // No way to checkout non-`HEAD` ref if there is no `.git` dir
      if (source.workspace.ref !== HEAD && !source.workspace.gitDir.present) {
        const error = new Error("Fadroma Build: could not find Git directory for source.")
        throw Object.assign(error, { source })
      }
    }

    // Here we will collect the build outputs
    const artifacts:  Artifact[] = []

    // Get the distinct workspaces and refs by which to group the crate builds
    const workspaceRoots: string[] = distinct(sources.map(source=>source.workspace.path))
    const refs:           string[] = distinct(sources.map(source=>source.workspace.ref))

    // For each workspace,
    for (const path of workspaceRoots) {
      const { gitDir } = workspaces[path]

      // And for each ref of that workspace,
      for (const ref of refs) {

        let mounted = $(path)
        console.info(
          `Building contracts from workspace:`, bold(`${mounted.shortPath}/`),
          `@`, bold(ref)
        )
        if (ref !== HEAD) {
          mounted = gitDir.rootRepo
          console.info(`Using history from Git directory: `, bold(`${mounted.shortPath}/`))
          await simpleGit(gitDir.path)
            .fetch(process.env.FADROMA_PREFERRED_REMOTE || 'origin')
        }

        // Create a list of sources for the container to build,
        // along with their indices in the input and output arrays
        // of this function.
        const crates: [number, string][] = []

        for (let index = 0; index < sources.length; index++) {
          const source = sources[index]
          if (source.workspace.path === path && source.workspace.ref === ref) {
            crates.push([index, source.crate])
          }
        }

        // Build the crates from the same workspace/ref
        // sequentially in the same container.
        const buildArtifacts = await this.buildInContainer(
          mounted.path,
          mounted.relative(path),
          ref,
          crates,
          gitDir.isSubmodule ? gitDir.submoduleDir : ''
        )

        // Collect the artifacts built by the container
        for (const index in buildArtifacts) {
          const artifact = buildArtifacts[index]
          if (artifact) {
            artifacts[index] = artifact
          }
        }

      }

    }

    return artifacts

  }

  protected async buildInContainer (
    root:      string,
    subdir:    string,
    ref:       string,
    crates:    [number, string][],
    gitSubdir: string = '',
    outputDir: string = resolve(root, subdir, 'artifacts'),
  ): Promise<(Artifact|null)[]> {

    // Output slots. Indices should correspond to those of the input to buildMany
    const artifacts:   (Artifact|null)[] = crates.map(()=>null)

    // Whether any crates should be built, and at what indices they are in the input and output.
    const shouldBuild: Record<string, number> = {}

    // Collect cached artifacts. If any are missing from the cache mark them as buildable.
    for (const [index, crate] of crates) {
      const prebuilt = this.prebuild(outputDir, crate, ref)
      if (prebuilt) {
        const location = $(prebuilt.url).shortPath
        console.info('Exists, not rebuilding:', bold(relative(cwd(), location)))
        artifacts[index] = prebuilt
      } else {
        shouldBuild[crate] = index
      }
    }

    // If there are no artifacts to build, this means everything was cached and we're done.
    if (Object.keys(shouldBuild).length === 0) {
      return artifacts
    }

    // Define the mounts of the build container
    const buildScript  = `/${basename(this.script)}`
    const safeRef      = sanitize(ref)
    const readonly = {
      [this.script]: buildScript
    }
    const knownHosts = $(`${config.homeDir}/.ssh/known_hosts`)
    if (knownHosts.isFile) {
      readonly['/root/.ssh/known_hosts'] = knownHosts.path
    }
    const globalKnownHosts = $(`/etc/ssh/ssh_known_hosts`)
    if (knownHosts.isFile) {
      readonly['/etc/ssh/ssh_known_hosts'] = globalKnownHosts.path
    }
    const writable = {
      // Root directory of repository, containing real .git directory
      [resolve(root)]:              `/src`,
      // Output path for final artifacts
      [outputDir]:                  `/output`,
      // Persist cache to make future rebuilds faster. May be unneccessary.
      [`project_cache_${safeRef}`]: `/tmp/target`,
      [`cargo_cache_${safeRef}`]:   `/usr/local/cargo`
    }

    // Define the environment variables of the build container
    const env = {
      TERM:                         process.env.TERM,
      SSH_AUTH_SOCK:                process.env.SSH_AUTH_SOCK,
      GIT_PAGER:                    'cat',
      GIT_TERMINAL_PROMPT:          '0',
      LOCKED:                       '',/*'--locked'*/
      CARGO_HTTP_TIMEOUT:           '240',
      CARGO_NET_GIT_FETCH_WITH_CLI: 'true',
      //'CARGO_TERM_VERBOSE':         'true',
      SUBDIR:                       subdir,
      GIT_SUBDIR:                   gitSubdir,
      REMOTE:                       process.env.FADROMA_PREFERRED_REMOTE||'origin'
    }

    // Pre-populate the list of expected artifacts.
    const outputWasms = [...new Array(crates.length)].map(()=>null)
    for (const [crate, index] of Object.entries(shouldBuild)) {
      outputWasms[index] = resolve(outputDir, artifactName(crate, safeRef))
    }

    // Pass the compacted list of crates to build into the container
    const cratesToBuild = Object.keys(shouldBuild)
    const command = ['node', buildScript, 'phase1', ref, ...cratesToBuild]
    const options = {
      remove: true,
      readonly,
      writable,
      env,
      extra: {
        Tty:         true,
        AttachStdin: true,
      }
    }
    console.info('Building with command:', bold(command.join(' ')))
    console.debug('in container with configuration:', options)

    // Prepare the log output stream
    const buildLogPrefix = `[${ref}]`.padEnd(16)
    const logs = new LineTransformStream(line=>`[Fadroma Build] ${buildLogPrefix} ${line}`)
    logs.pipe(process.stdout)

    // Run the build container
    const rootName       = sanitize(basename(root))
    const buildName      = `fadroma-build-${rootName}@${ref}`
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
    return outputWasms.map(location => {
      if (location === null) {
        return null
      } else {
        return { url: pathToFileURL(location), codeHash: codeHashForPath(location) }
      }
    })

  }

}

/** This build mode looks for a Rust toolchain in the same environment
  * as the one in which the script is running, i.e. no build container. */
export class RawBuilder extends CachingBuilder {
  constructor (
    public readonly buildScript:    string,
    public readonly checkoutScript: string
  ) { super() }

  async build (source: Source): Promise<Artifact> {
    throw new Error('RawBuilder#build: not implemented')
    const { workspace: { path: cwd, ref = HEAD }, workspace, crate } = source
    // LD_LIBRARY_PATH=$(nix-build -E 'import <nixpkgs>' -A 'gcc.cc.lib')/lib64
    if (ref && ref !== HEAD) {
      await run(this.checkoutScript, [ref])
    }
    await run(this.buildScript, [])
    const location = resolve(cwd, 'artifacts', artifactName(crate, ref))
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
      console.info('Exists, not rebuilding:', bold(relative(cwd(), source)))
      return prebuilt
    }
    // Request a build from the build manager
    const { crate, ref = HEAD } = source
    const { location } = await this.manager.get('/build', { crate, ref })
    const codeHash = codeHashForPath(location)
    return { url: pathToFileURL(location), codeHash }
  }
}

export const HEAD = 'HEAD'

export const distinct = <T> (x: T[]): T[] => [...new Set(x)]

export const sanitize  = ref => ref.replace(/\//g, '_')

export const artifactName = (crate, ref) => `${crate}@${sanitize(ref)}.wasm`

export const codeHashForPath = (location: string) => codeHashForBlob(readFileSync(location))

export const codeHashForBlob = (blob: Uint8Array) => toHex(new Sha256(blob).digest())
