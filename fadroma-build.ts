import type {
  Project, Class, BuilderClass, Buildable, Built, Template
} from './fadroma'
import {
  Builder, Contract, HEAD, Config, Console, bold, colors, Error
} from './fadroma-base'

import $, { Path, OpaqueDirectory, TextFile, BinaryFile, TOMLFile, OpaqueFile } from '@hackbg/file'
import { Engine, Image, Docker, Podman, LineTransformStream } from '@hackbg/dock'

import { default as simpleGit } from 'simple-git'

import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname } from 'node:path'
import { homedir } from 'node:os'
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

/** The parts of Cargo.toml which the builder needs to be aware of. */
export type CargoTOML = TOMLFile<{ package: { name: string } }>

export { Builder }

/** @returns Builder configured as per environment and options */
export function getBuilder (options: Partial<Config["build"]> = {}): Builder {
  return new Config({ build: options }).getBuilder()
}

/** Compile a single contract with default settings. */
export async function build (source: Buildable): Promise<Built> {
  return getBuilder().build(source)
}

/** Compile multiple single contracts with default settings. */
export async function buildMany (sources: Buildable[]): Promise<Built[]> {
  return getBuilder().buildMany(sources)
}

/** Can perform builds.
  * Will only perform a build if a contract is not built yet or FADROMA_REBUILD=1 is set. */
export abstract class BuildLocal extends Builder {
  readonly id: string = 'local'
  /** Logger. */
  log = new Console('Local Builder')
  /** The build script. */
  script?:    string
  /** The project workspace. */
  workspace?: string
  /** Whether to set _NO_FETCH=1 in build script's environment and skip "git fetch" calls */
  noFetch:    boolean     = false
  /** Name of directory where build artifacts are collected. */
  outputDir:  OpaqueDirectory
  /** Version of Rust toolchain to use. */
  toolchain:  string|null = null
  /** Whether the build process should print more detail to the console. */
  verbose:    boolean     = false
  /** Whether the build log should be printed only on error, or always */
  quiet:      boolean     = false
  /** Whether to enable caching. */
  caching:    boolean     = true
  /** Default Git reference from which to build sources. */
  revision:   string = HEAD

  constructor (options: Partial<Config["build"]>) {
    super()
    this.workspace = options.workspace ?? this.workspace
    this.noFetch   = options.noFetch   ?? this.noFetch
    this.toolchain = options.toolchain ?? this.toolchain
    this.verbose   = options.verbose   ?? this.verbose
    this.quiet     = options.quiet     ?? this.quiet
    this.outputDir = $(options.outputDir!).as(OpaqueDirectory)
    if (options.script) this.script = options.script
  }

  /** Check if artifact exists in local artifacts cache directory.
    * If it does, don't rebuild it but return it from there. */
  protected prebuild (
    outputDir: string, crate?: string, revision: string = HEAD
  ): Built|null {
    if (this.caching && crate) {
      const location = $(outputDir, artifactName(crate, revision))
      if (location.exists()) {
        const artifact = location.url
        const codeHash = this.hashPath(location)
        return { crate, revision, artifact, codeHash }
      }
    }
    return null
  }

  hashPath (location: string|Path) {
    return $(location).as(BinaryFile).sha256
  }

}

export const artifactName = (crate: string, ref: string) =>
  `${crate}@${sanitize(ref)}.wasm`

export const sanitize = (ref: string) =>
  ref.replace(/\//g, '_')

/** This builder launches a one-off build container using Dockerode. */
export class BuildContainer extends BuildLocal {
  readonly id = 'Container'
  /** Logger */
  log = new Console('@hackbg/fadroma: BuildContainer')
  /** Used to launch build container. */
  docker: Engine
  /** Tag of the docker image for the build container. */
  image: Image
  /** Path to the dockerfile to build the build container if missing. */
  dockerfile: string

  constructor (opts: Partial<Config["build"] & { docker?: Engine }> = {}) {
    super(opts)
    const { docker, dockerSocket, dockerImage } = opts
    // Set up Docker API handle
    const Containers = opts.podman ? Podman : Docker
    if (dockerSocket) {
      this.docker = new Containers.Engine(dockerSocket)
    } else if (docker) {
      this.docker = docker
    } else {
      this.docker = new Containers.Engine()
    }
    if ((dockerImage as unknown) instanceof Containers.Image) {
      this.image = opts.dockerImage as unknown as Image
    } else if (opts.dockerImage) {
      this.image = this.docker.image(opts.dockerImage)
    } else {
      this.image = this.docker.image('ghcr.io/hackbg/fadroma:master')
    }
    // Set up Docker image
    this.dockerfile ??= opts.dockerfile!
    this.script     ??= opts.script!
    for (const hide of [
      'log', 'name', 'description', 'timestamp',
      'commandTree', 'currentCommand',
      'args', 'task', 'before'
    ]) Object.defineProperty(this, hide, { enumerable: false, writable: true })
  }

  /** Build a Source into a Template. */
  async build (contract: Buildable): Promise<Built> {
    const [result] = await this.buildMany([contract])
    return result
  }

  /** This implementation groups the passed source by workspace and ref,
    * in order to launch one build container per workspace/ref combination
    * and have it build all the crates from that combination in sequence,
    * reusing the container's internal intermediate build cache. */
  async buildMany (contracts: (string|(Buildable & Partial<Built>))[]): Promise<Built[]> {
    // Copy the argument because we'll mutate it later on
    contracts = [...contracts]
    // For batching together contracts from the same repo+commit
    const workspaces = new Set<string>()
    const revisions  = new Set<string>()
    // Go over the list of contracts, filtering out the ones that are already built,
    // and collecting the source repositories and revisions. This will allow for
    // multiple crates from the same source checkout to be passed to a single build command.
    for (let id in contracts) {
      // Contracts passed as strins are converted to object here
      const contract = (typeof contracts[id] === 'string') 
        ? { crate: contracts[id] as string }
        : contracts[id] as Buildable & Partial<Built>
      contract.workspace ??= this.workspace
      contract.revision  ??= 'HEAD'
      // If the contract is already built, don't build it again
      if (!this.prebuilt(contract)) {
        this.log.build.one(contract)
        // Set ourselves as the contract's builder
        contract.builder = this as unknown as Builder
        // Add the source repository of the contract to the list of sources to build
        workspaces.add(contract.workspace!)
        revisions.add(contract.revision!)
      }
    }
    // For each repository/revision pair, build the contracts from it.
    for (const path of workspaces) {
      for (const revision of revisions) {
        this.log.log('Building from', path, '@', revision)
        // Which directory to mount into the build container? By default,
        // this is the root of the workspace. But if the workspace is not
        // at the root of the Git repo (e.g. when using Git submodules),
        // a parent directory may need to be mounted to get the full
        // Git history.
        let mounted = $(path)
        if (this.verbose) this.log.build.workspace(mounted, revision)
        // If we're building from history, update `mounted` to make sure
        // that the full contents of the Git repo will be mounted in the
        // build container.
        if (revision !== HEAD) {
          const gitDir = getGitDir({ workspace: path })
          mounted = gitDir.rootRepo
          const remote = process.env.FADROMA_PREFERRED_REMOTE || 'origin'
          try {
            await this.fetch(gitDir, remote)
          } catch (e) {
            console.warn(`Git fetch from remote ${remote} failed. Build may fail or produce an outdated result.`)
            console.warn(e)
          }
        }
        // Match each crate from the current repo/ref pair
        // with its index in the originally passed list of contracts.
        const crates: [number, string][] = []
        for (let index = 0; index < contracts.length; index++) {
          const source = contracts[index] as Buildable & Partial<Built>
          if (source.workspace === path && source.revision === revision) {
            crates.push([index, source.crate!])
          }
        }
        // Build the crates from each same workspace/revision pair and collect the results.
        // sequentially in the same container.
        // Collect the templates built by the container
        const results = await this.runBuildContainer(
          mounted.path,
          mounted.relative(path),
          revision,
          crates,
          (revision !== HEAD)
            ? (gitDir=>gitDir.isSubmodule?gitDir.submoduleDir:'')(getGitDir({ workspace: path }))
            : ''
        )
        // Using the previously collected indices,
        // populate the values in each of the passed contracts.
        for (const index in results) {
          if (!results[index]) continue
          const contract = contracts[index] as Buildable & Partial<Built>
          contract.artifact = results[index]!.artifact
          contract.codeHash = results[index]!.codeHash
        }
      }
    }
    return contracts as Built[]
  }

  protected async fetch (gitDir: Path, remote: string) {
    await simpleGit(gitDir.path).fetch(remote)
  }

  protected prebuilt (contract: Buildable & Partial<Built>): boolean {
    const { workspace, revision, crate } = contract
    //if (!workspace) throw new Error(`Workspace not set, can't build crate "${contract.crate}"`)
    const prebuilt = this.prebuild(this.outputDir.path, crate, revision)
    if (prebuilt) {
      new Console(`build ${crate}`).build.found(prebuilt)
      contract.artifact = prebuilt.artifact
      contract.codeHash = prebuilt.codeHash
      return true
    }
    return false
  }

  protected async runBuildContainer (
    root:      string,
    subdir:    string,
    revision:  string,
    crates:    [number, string][],
    gitSubdir: string = '',
    outputDir: string = this.outputDir.path
  ): Promise<(Built|null)[]> {
    // Default to building from working tree.
    revision ??= HEAD
    // Create output directory as user if it does not exist
    $(outputDir).as(OpaqueDirectory).make()
    // Output slots. Indices should correspond to those of the input to buildMany
    const templates: Array<Built|null> = crates.map(()=>null)
    // Whether any crates should be built, and at what indices they are in the input and output.
    const shouldBuild: Record<string, number> = {}
    // Collect cached templates. If any are missing from the cache mark them as buildable.
    for (const [index, crate] of crates) {
      const prebuilt = this.prebuild(outputDir, crate, revision)
      if (prebuilt) {
        const location = $(prebuilt.artifact!).shortPath
        //console.info('Exists, not rebuilding:', bold($(location).shortPath))
        templates[index] = prebuilt
      } else {
        shouldBuild[crate] = index
      }
    }
    // If there are no templates to build, this means everything was cached and we're done.
    if (Object.keys(shouldBuild).length === 0) {
      return templates
    }
    // Define the mounts and environment variables of the build container
    if (!this.script) throw new Error.Build('Build script not set.')
    const buildScript = $(`/`, $(this.script).name).path
    const safeRef = sanitize(revision)
    const knownHosts = $(homedir()).in('.ssh').at('known_hosts')
    const etcKnownHosts = $(`/etc/ssh/ssh_known_hosts`)
    const readonly = {
      // The script that will run in the container
      [this.script]:  buildScript,
      // Root directory of repository, containing real .git directory
      [$(root).path]: `/src`,
      // For non-interactively fetching submodules over SSH, we need to propagate known_hosts
      ...(knownHosts.isFile()    ? { [knownHosts.path]:     '/root/.ssh/known_hosts'   } : {}),
      ...(etcKnownHosts.isFile() ? { [etcKnownHosts.path] : '/etc/ssh/ssh_known_hosts' } : {}),
    }
    // For fetching from private repos, we need to give the container access to ssh-agent
    if (process.env.SSH_AUTH_SOCK) readonly[process.env.SSH_AUTH_SOCK] = '/ssh_agent_socket'
    const writable = {
      // Output path for final artifacts
      [outputDir]:                  `/output`,
      // Persist cache to make future rebuilds faster. May be unneccessary.
      //[`project_cache_${safeRef}`]: `/tmp/target`,
      [`cargo_cache_${safeRef}`]:   `/usr/local/cargo`
    }
    // Since Fadroma can be included as a Git submodule, but
    // Cargo doesn't support nested workspaces, Fadroma's
    // workpace root manifest is renamed to _Cargo.toml.
    // Here we can mount it under its proper name
    // if building the example contracts from Fadroma.
    if (process.env.FADROMA_BUILD_WORKSPACE_MANIFEST) {
      if (revision !== HEAD) {
        throw new Error(
          'Fadroma Build: FADROMA_BUILD_WORKSPACE_ROOT can only' +
          'be used when building from working tree'
        )
      }
      writable[$(root).path] = readonly[$(root).path]
      delete readonly[$(root).path]
      readonly[$(process.env.FADROMA_BUILD_WORKSPACE_MANIFEST).path] = `/src/Cargo.toml`
    }
    // Pre-populate the list of expected artifacts.
    const outputWasms: Array<string|null> = [...new Array(crates.length)].map(()=>null)
    for (const [crate, index] of Object.entries(shouldBuild)) {
      outputWasms[index] = $(outputDir, artifactName(crate, safeRef)).path
    }
    // Pass the compacted list of crates to build into the container
    const cratesToBuild = Object.keys(shouldBuild)
    const buildCommand = [ 'node', buildScript, 'phase1', revision, ...cratesToBuild ]
    const buildEnv = {
      // Variables used by the build script are prefixed with underscore;
      // variables used by the tools that the build script uses are left as is
      _BUILD_USER: process.env.FADROMA_BUILD_USER ?? 'fadroma-builder',
      _BUILD_UID:  process.env.FADROMA_BUILD_UID ?? (process.getuid ? process.getuid() : undefined),
      _BUILD_GID:  process.env.FADROMA_BUILD_GID ?? (process.getgid ? process.getgid() : undefined),
      _GIT_REMOTE: process.env.FADROMA_PREFERRED_REMOTE ?? 'origin',
      _GIT_SUBDIR: gitSubdir,
      _SUBDIR:     subdir,
      _NO_FETCH:   String(this.noFetch),
      _VERBOSE:    String(this.verbose),

      LOCKED: '',/*'--locked'*/
      CARGO_HTTP_TIMEOUT: '240',
      CARGO_NET_GIT_FETCH_WITH_CLI: 'true',
      GIT_PAGER: 'cat',
      GIT_TERMINAL_PROMPT: '0',
      SSH_AUTH_SOCK: '/ssh_agent_socket',
      TERM: process.env.TERM,
    }
    // Clean up the buildEnv so as not to run afoul of TS
    for (const key of Object.keys(buildEnv)) {
      if (buildEnv[key as keyof typeof buildEnv] === undefined) {
        delete buildEnv[key as keyof typeof buildEnv]
      }
    }
    const buildOptions = {
      remove: true,
      readonly,
      writable,
      cwd: '/src',
      env: buildEnv as Record<string, string>,
      extra: { Tty: true, AttachStdin: true }
    }
    // This stream collects the output from the build container, i.e. the build logs.
    const buildLogStream = new LineTransformStream((!this.quiet)
      // In normal and verbose mode, build logs are printed to the console in real time,
      // with an addition prefix to show what is being built.
      ? (line:string)=>`${bold('BUILD')} @ ${revision} │ ${line}`
      // In quiet mode the logs are collected into a string as-is,
      // and are only printed if the build fails.
      : (line:string)=>line)
    let buildLogs = ''
    if (!this.quiet) {
      // In verbose mode, build logs are piped directly to the console
      buildLogStream.pipe(process.stdout)
    } else {
      // In non-verbose mode, build logs are collected in a string
      buildLogStream.on('data', (data: string) => buildLogs += data)
    }
    // Run the build container
    this.log.build.container(root, revision, cratesToBuild)
    const buildName = `fadroma-build-${randomBytes(3).toString('hex')}`
    const buildContainer = await this.image.run(
      buildName,      // container name
      buildOptions,   // container options
      buildCommand,   // container arguments
      '/usr/bin/env', // container entrypoint command
      buildLogStream  // container log stream
    )
    process.once('beforeExit', async () => {
      this.log.log('Killing build container', bold(buildContainer.id))
      try {
        await buildContainer.kill()
        this.log.log('Killed build container', bold(buildContainer.id))
      } catch (e) {
        if (!e.statusCode) this.log.error(e)
        else if (e.statusCode === '404') {}
        else this.log.warn('Failed to kill build container', e.statusCode, e.reason)
      }
    })
    const {error, code} = await buildContainer.wait()
    // Throw error if launching the container failed
    if (error) {
      throw new Error(`[@hackbg/fadroma] Docker error: ${error}`)
    }
    // Throw error if the build failed
    if (code !== 0) this.buildFailed(cratesToBuild, code, buildLogs)
    // Return a sparse array of the resulting artifacts
    return outputWasms.map(x=>this.locationToContract(x) as Built)
  }

  protected buildFailed (crates: string[], code: string|number, logs: string) {
    const crateList = crates.join(' ')
    this.log.log(logs)
    this.log.error('Build of crates:', bold(crateList), 'exited with status', bold(String(code)))
    throw new Error(`[@hackbg/fadroma] Build of crates: "${crateList}" exited with status ${code}`)
  }

  protected locationToContract (location: any) {
    if (location === null) return null
    const artifact = $(location).url
    const codeHash = this.hashPath(location)
    return new Contract({ artifact, codeHash })
  }

  get [Symbol.toStringTag]() {
    return `${this.image?.name??'-'} -> ${this.outputDir?.shortPath??'-'}`
  }

}

export const distinct = <T> (x: T[]): T[] =>
  [...new Set(x) as any]

/** This build mode looks for a Rust toolchain in the same environment
  * as the one in which the script is running, i.e. no build container. */
export class BuildRaw extends BuildLocal {

  readonly id = 'Raw'

  log = new Console('build')

  runtime = process.argv[0]

  /** Build a Source into a Template */
  async build (source: Buildable): Promise<Built> {
    source.workspace ??= this.workspace
    source.revision  ??= HEAD
    const { workspace, revision, crate } = source
    if (!workspace) throw new Error('no workspace')
    if (!crate)     throw new Error('no crate')
    // Temporary dirs used for checkouts of non-HEAD builds
    let tmpGit, tmpBuild
    // Most of the parameters are passed to the build script
    // by way of environment variables.
    const env = {
      _BUILD_GID: process.getgid ? process.getgid() : undefined,
      _BUILD_UID: process.getuid ? process.getuid() : undefined,
      _OUTPUT:    $(workspace).in('wasm').path,
      _REGISTRY:  '',
      _TOOLCHAIN: this.toolchain,
    }
    if ((revision ?? HEAD) !== HEAD) {
      const gitDir = this.getGitDir(source)
      // Provide the build script with the config values that ar
      // needed to make a temporary checkout of another commit
      if (!gitDir?.present) {
        const error = new Error("Fadroma Build: could not find Git directory for source.")
        throw Object.assign(error, { source })
      }
      // Create a temporary Git directory. The build script will copy the Git history
      // and modify the refs in order to be able to do a fresh checkout with submodules
      tmpGit   = $.tmpDir('fadroma-git-')
      tmpBuild = $.tmpDir('fadroma-build-')
      Object.assign(env, {
        _GIT_ROOT:   gitDir.path,
        _GIT_SUBDIR: gitDir.isSubmodule ? gitDir.submoduleDir : '',
        _NO_FETCH:   this.noFetch,
        _TMP_BUILD:  tmpBuild.path,
        _TMP_GIT:    tmpGit.path,
      })
    }
    // Run the build script
    const cmd  = this.runtime!
    const args = [this.script!, 'phase1', revision, crate ]
    const opts = { cwd: source.workspace, env: { ...process.env, ...env }, stdio: 'inherit' }
    const sub  = this.spawn(cmd, args, opts as any)
    await new Promise<void>((resolve, reject)=>{
      sub.on('exit', (code: number, signal: any) => {
        const build = `Build of ${source.crate} from ${$(source.workspace!).shortPath} @ ${source.revision}`
        if (code === 0) {
          resolve()
        } else if (code !== null) {
          const message = `${build} exited with code ${code}`
          this.log.error(message)
          throw Object.assign(new Error(message), { source, code })
        } else if (signal !== null) {
          const message = `${build} exited by signal ${signal}`
          this.log.warn(message)
        } else {
          throw new Error('Unreachable')
        }
      })
    })
    // If this was a non-HEAD build, remove the temporary Git dir used to do the checkout
    if (tmpGit   && tmpGit.exists())   tmpGit.delete()
    if (tmpBuild && tmpBuild.exists()) tmpBuild.delete()
    // Create an artifact for the build result
    const location = $(env._OUTPUT, artifactName(crate, sanitize(revision)))
    this.log.sub(source.crate).log('built', bold(location.shortPath))
    return Object.assign(source, {
      artifact: pathToFileURL(location.path),
      codeHash: this.hashPath(location.path)
    })
  }

  /** This implementation groups the passed source by workspace and ref,
    * in order to launch one build container per workspace/ref combination
    * and have it build all the crates from that combination in sequence,
    * reusing the container's internal intermediate build cache. */
  async buildMany (inputs: Buildable[]): Promise<Built[]> {
    const templates: Built[] = []
    for (const source of inputs) templates.push(await this.build(source))
    return templates
  }

  protected spawn (...args: Parameters<typeof spawn>) {
    return spawn(...args)
  }

  protected getGitDir (...args: Parameters<typeof getGitDir>) {
    return getGitDir(...args)
  }

}

export function getGitDir (template: Partial<Template<any>> = {}): DotGit {
  const { workspace } = template || {}
  if (!workspace) throw new Error("No workspace specified; can't find gitDir")
  return new DotGit(workspace)
}

/** Represents the real location of the Git data directory.
  * - In standalone repos this is `.git/`
  * - If the contracts workspace repository is a submodule,
  *   `.git` will be a file containing e.g. "gitdir: ../.git/modules/something" */
export class DotGit extends Path {
  log = new Console('@hackbg/fadroma: DotGit')
  /** Whether a .git is present */
  readonly present:     boolean
  /** Whether the workspace's repository is a submodule and
    * its .git is a pointer to the parent's .git/modules */
  readonly isSubmodule: boolean = false

  constructor (base: string|URL, ...fragments: string[]) {
    if (base instanceof URL) base = fileURLToPath(base)
    super(base, ...fragments, '.git')
    if (!this.exists()) {
      // If .git does not exist, it is not possible to build past commits
      this.log.warn(bold(this.shortPath), 'does not exist')
      this.present = false
    } else if (this.isFile()) {
      // If .git is a file, the workspace is contained in a submodule
      const gitPointer = this.as(TextFile).load().trim()
      const prefix = 'gitdir:'
      if (gitPointer.startsWith(prefix)) {
        // If .git contains a pointer to the actual git directory,
        // building past commits is possible.
        const gitRel  = gitPointer.slice(prefix.length).trim()
        const gitPath = $(this.parent, gitRel).path
        const gitRoot = $(gitPath)
        //this.log.info(bold(this.shortPath), 'is a file, pointing to', bold(gitRoot.shortPath))
        this.path      = gitRoot.path
        this.present   = true
        this.isSubmodule = true
      } else {
        // Otherwise, who knows?
        this.log.info(bold(this.shortPath), 'is an unknown file.')
        this.present = false
      }
    } else if (this.isDirectory()) {
      // If .git is a directory, this workspace is not in a submodule
      // and it is easy to build past commits
      this.present = true
    } else {
      // Otherwise, who knows?
      this.log.warn(bold(this.shortPath), `is not a file or directory`)
      this.present = false
    }
  }
  get rootRepo (): Path {
    return $(this.path.split(DotGit.rootRepoRE)[0])
  }
  get submoduleDir (): string {
    return this.path.split(DotGit.rootRepoRE)[1]
  }

  /* Matches "/.git" or "/.git/" */
  static rootRepoRE = new RegExp(`${Path.separator}.git${Path.separator}?`)
}

Object.assign(Builder.variants, {
  'container': BuildContainer,
  'Container': BuildContainer,
  'raw': BuildRaw,
  'Raw': BuildRaw
})

export class ContractCrate {
  constructor (
    readonly project: Project,
    /** Name of crate */
    readonly name: string,
    /** Features of the 'fadroma' dependency to enable. */
    readonly fadromaFeatures: string[] = [ 'scrt' ],
    /** Root directory of crate. */
    readonly dir: OpaqueDirectory = project.dirs.src.in(name).as(OpaqueDirectory),
    /** Crate manifest. */
    readonly cargoToml: TextFile = dir.at('Cargo.toml').as(TextFile),
    /** Directory containing crate sources. */
    readonly src: OpaqueDirectory = dir.in('src').as(OpaqueDirectory),
    /** Root module of Rust crate. */
    readonly libRs: TextFile = src.at('lib.rs').as(TextFile)
  ) {}
  create () {
    this.cargoToml.save([
      `[package]`,
      `name = "${this.name}"`,
      `version = "0.0.0"`,
      `edition = "2021"`,
      `authors = []`,
      `keywords = ["fadroma"]`,
      `description = ""`,
      `readme = "README.md"`, ``,
      `[lib]`, `crate-type = ["cdylib", "rlib"]`, ``,
      `[dependencies]`,
      `fadroma = { git = "https://github.com/hackbg/fadroma", branch = "master", features = ${JSON.stringify(this.fadromaFeatures)} }`,
      `serde = { version = "1.0.114", default-features = false, features = ["derive"] }`
    ].join('\n'))
    this.src.make()
    this.libRs.save([
      `//! Created by [Fadroma](https://fadroma.tech).`, ``,
      `#[fadroma::dsl::contract] pub mod contract {`,
      `    use fadroma::{*, dsl::*, prelude::*};`,
      `    impl Contract {`,
      `        #[init(entry_wasm)]`,
      `        pub fn new () -> Result<Response, StdError> {`,
      `            Ok(Response::default())`,
      `        }`,
      `        // #[execute]`,
      `        // pub fn my_tx_1 (arg1: String, arg2: Uint128) -> Result<Response, StdError> {`,
      `        //     Ok(Response::default())`,
      `        // }`,
      `        // #[execute]`,
      `        // pub fn my_tx_2 (arg1: String, arg2: Uint128) -> Result<Response, StdError> {`,
      `        //     Ok(Response::default())`,
      `        // }`,
      `        // #[query]`,
      `        // pub fn my_query_1 (arg1: String, arg2: Uint128) -> Result<(), StdError> {`,
      `        //     Ok(())`, '',
      `        // }`,
      `        // #[query]`,
      `        // pub fn my_query_2 (arg1: String, arg2: Uint128) -> Result<(), StdError> {`,
      `        //     Ok(())`, '',
      `        // }`,
      `    }`,
      `}`,
    ].join('\n'))
  }
}
