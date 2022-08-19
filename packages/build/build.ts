/*
  Fadroma Build System
  Copyright (C) 2022 Hack.bg

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/

import { Artifact, SourceHandle } from '@fadroma/client'
import { Console, bold } from '@hackbg/konzola'
import { toHex, Sha256 } from '@hackbg/formati'
import { envConfig, CommandContext, Lazy } from '@hackbg/komandi'
import { Dokeres, DokeresImage, LineTransformStream } from '@hackbg/dokeres'
import { default as simpleGit } from 'simple-git'
import $, {
  Path,
  TextFile,
  OpaqueFile,
  OpaqueDirectory,
  TOMLFile
} from '@hackbg/kabinet'
import { spawn                        } from 'child_process'
import { basename, resolve, dirname   } from 'path'
import { homedir, tmpdir              } from 'os'
import { pathToFileURL, fileURLToPath } from 'url'
import { readFileSync, mkdtempSync    } from 'fs'

const console = Console('Fadroma Build')

/** Function to get builder settings from process runtime environment. */
export const getBuilderConfig = envConfig(({Str, Bool}, cwd): BuilderConfig => ({
  project:    Str ('FADROMA_PROJECT',          ()=>cwd)                      as string,
  buildRaw:   Bool('FADROMA_BUILD_RAW',        ()=>false)                    as boolean,
  rebuild:    Bool('FADROMA_REBUILD',          ()=>false)                    as boolean,
  noFetch:    Bool('FADROMA_NO_FETCH',         ()=>false)                    as boolean,
  toolchain:  Str ('FADROMA_RUST',             ()=>'')                       as string,
  script:     Str ('FADROMA_BUILD_SCRIPT',     ()=>Builder.script)           as string,
  image:      Str ('FADROMA_BUILD_IMAGE',      ()=>DockerBuilder.image)      as string,
  dockerfile: Str ('FADROMA_BUILD_DOCKERFILE', ()=>DockerBuilder.dockerfile) as string,
}))
/** Builder settings definitions. */
export interface BuilderConfig {
  /** Project root. Defaults to current working directory. */
  project:    string
  /** Whether to bypass Docker and use the toolchain from the environment. */
  buildRaw:   boolean
  /** Whether to ignore existing build artifacts and rebuild contracts. */
  rebuild:    boolean
  /** Whether not to run `git fetch` during build. */
  noFetch:    boolean
  /** Which version of the Rust toolchain to use, e.g. `1.59.0` */
  toolchain:  string
  /** Docker image to use for dockerized builds. */
  image:      string
  /** Dockerfile to build the build image if not downloadable. */
  dockerfile: string
  /** Script that runs the actual build, e.g. build.impl.mjs */
  script:     string
}
/** Messages output by builder. */
export const BuildLogger = ({ info }: Console) => ({
  CargoToml (file: Path) {
    info('Building from', bold(file.shortPath))
  },
  BuildScript (file: Path) {
    info('Running build script', bold(file.shortPath))
  },
  BuildOne (source: Source, prebuilt: Artifact|null, longestCrateName: number) {
    if (prebuilt) {
      info('Reuse    ', bold($(prebuilt.url!).shortPath))
    } else {
      const { crate, workspace: { path, ref = 'HEAD' } } = source
      if (ref === 'HEAD') {
        info('Building', bold(source.crate), 'from working tree')
      } else {
        info('Building', bold(source.crate), 'from Git reference', bold(ref))
      }
    }
  },
  BuildMany (sources: Source[]) {
    for (const source of sources) {
      const { crate, workspace: { path, ref = 'HEAD' } } = source
      if (ref === 'HEAD') {
        info('Building', bold(source.crate), 'from working tree')
      } else {
        info('Building', bold(source.crate), 'from Git reference', bold(ref))
      }
    }
    info()
  },
  Workspace (mounted: Path, ref: string) {
    info(
      `Building contracts from workspace:`, bold(`${mounted.shortPath}/`),
      `@`, bold(ref)
    )
  }
})
/** Get a builder based on the builder config. */
export function getBuilder (config: Partial<BuilderConfig> = getBuilderConfig()) {
  if (config.buildRaw) {
    return new RawBuilder({ ...config, caching: !config.rebuild })
  } else {
    return new DockerBuilder({ ...config, caching: !config.rebuild })
  }
}
/** The nouns and verbs exposed to REPL and Commands. */
export interface BuildContext extends CommandContext {
  config:    BuilderConfig
  /** Cargo workspace of the current project. */
  workspace: Workspace
  /** Get a Source by crate name from the current workspace. */
  getSource: (source: IntoSource) => Source
  /** Knows how to build contracts for a target. */
  builder:   Builder
  /** Get an Artifact from Source or crate name. */
  build:     (source: IntoSource, ref?: string)         => Promise<Artifact>
  /** Get one or more Artifacts from Source or crate name */
  buildMany: (ref?: string, ...sources: IntoSource[][]) => Promise<Artifact[]>
}
/** Add build vocabulary to context of REPL and deploy scripts. */
export function getBuildContext (context: CommandContext & Partial<BuildContext>): BuildContext {
  const config = { ...getBuilderConfig(), ...context.config ?? {} }
  return {
    ...context,
    config,
    builder:   getBuilder(config),
    workspace: new Workspace(config.project),
    getSource (source: IntoSource, ref?: string): Source {
      let workspace = this.workspace
      if (ref) workspace = workspace.at(ref)
      if (typeof source === 'string') return this.workspace.crate(source)
      return source
    },
    async build (source: IntoSource, ref?: string): Promise<Artifact> {
      return await this.builder.build(this.getSource(source).at(ref))
    },
    async buildMany (ref?: string, ...sources: IntoSource[][]): Promise<Artifact[]> {
      sources = [sources.reduce((s1, s2)=>[...new Set([...s1, ...s2])], [])]
      return await this.builder.buildMany(sources[0].map(source=>this.getSource(source)))
    }
  }
}
/** Base class for class-based deploy procedure. Adds progress logging. */
export class BuildTask<X> extends Lazy<X> {
  constructor (public readonly context: BuildContext, getResult: ()=>X) {
    let self: this
    super(()=>{
      console.info()
      console.info('Task     ', this.constructor.name ? bold(this.constructor.name) : '')
      return getResult.bind(self)()
    })
    self = this
  }
  subtask <X> (cb: ()=>X|Promise<X>): Promise<X> {
    const self = this
    //@ts-ignore
    return new Lazy(()=>{
      console.info()
      console.info('Subtask  ', cb.name ? bold(cb.name) : '')
      return cb.bind(self)()
    })
  }
}

//@ts-ignore
export const __dirname = dirname(fileURLToPath(import.meta.url))

/** Can perform builds. */
export abstract class Builder {
  static script = resolve(__dirname, 'build.impl.mjs')
  verbose:       boolean     = false
  outputDirName: string      = 'artifacts'
  noFetch:       boolean     = false
  toolchain:     string|null = null
  script:        string      = Builder.script
  constructor (opts: Partial<BuilderOptions> = {}) {
    this.noFetch       = opts.noFetch       ?? this.noFetch
    this.outputDirName = opts.outputDirName ?? this.outputDirName
    this.script        = opts.script        ?? this.script
  }
  buildMany (sources: Source[], ...args: unknown[]): Promise<Artifact[]> {
    return Promise.all(sources.map(source=>this.build(source, ...args)))
  }
  abstract build (source: SourceHandle, ...args: unknown[]): Promise<Artifact>
}

export interface BuilderOptions {
  /** The build script. */
  script:        string
  /** Whether to set _NO_FETCH=1 in build script's environment and skip "git fetch" calls */
  noFetch:       boolean
  /** Name of directory where build artifacts are collected. */
  outputDirName: string
  /** Version of Rust toolchain to use. */
  toolchain:     string
}

export interface CachingBuilderOptions extends BuilderOptions {
  /** Whether to enable caching and reuse contracts from artifacts directory. */
  caching: boolean
}

/** Will only perform a build if a contract is not built yet or FADROMA_REBUILD=1 is set. */
export abstract class CachingBuilder extends Builder {
  caching: boolean = true
  constructor (options: Partial<CachingBuilderOptions> = {}) {
    super(options)
    this.caching = options.caching ?? this.caching
  }
  /** Check if artifact exists in local artifacts cache directory.
    * If it does, don't rebuild it but return it from there. */ 
  protected prebuild (outputDir: string, crate: string, ref: string = HEAD): Artifact|null {
    if (!this.caching) {
      return null
    }
    const location = $(outputDir, artifactName(crate, ref))
    if (location.exists()) {
      return new Artifact(undefined, location.url, this.codeHashForPath(location.path))
    }
    return null
  }
  codeHashForPath = codeHashForPath
}

export const artifactName = (crate: string, ref: string) => `${crate}@${sanitize(ref)}.wasm`

export const sanitize = (ref: string) => ref.replace(/\//g, '_')

export const codeHashForPath = (location: string) => codeHashForBlob(readFileSync(location))

export const codeHashForBlob = (blob: Uint8Array) => toHex(new Sha256(blob).digest())

export interface DockerBuilderOptions extends CachingBuilderOptions {
  socketPath: string
  docker:     Dokeres
  image:      string|DokeresImage
  dockerfile: string
}

export const distinct = <T> (x: T[]): T[] => [...new Set(x) as any]

/** This builder launches a one-off build container using Dockerode. */
export class DockerBuilder extends CachingBuilder {
  static image      = 'ghcr.io/hackbg/fadroma:unstable'
  static dockerfile = resolve(__dirname, 'build.Dockerfile')
  constructor (opts: Partial<DockerBuilderOptions> = {}) {
    super(opts)
    // Set up Docker API handle
    if (opts.socketPath) {
      this.docker = new Dokeres(this.socketPath = opts.socketPath)
    } else if (opts.docker) {
      this.docker = opts.docker
    }
    if (opts.image instanceof DokeresImage) {
      this.image = opts.image
    } else if (opts.image) {
      this.image = new DokeresImage(this.docker, opts.image)
    } else {
      this.image = new DokeresImage(this.docker, 'ghcr.io/hackbg/fadroma:unstable')
    }
    // Set up Docker image
    this.dockerfile ??= opts.dockerfile!
    this.script     ??= opts.script!
  }
  /** Used to launch build container. */
  socketPath: string  = '/var/run/docker.sock'
  /** Used to launch build container. */
  docker:     Dokeres = new Dokeres(this.socketPath)
  /** Tag of the docker image for the build container. */
  image:      DokeresImage
  /** Path to the dockerfile to build the build container if missing. */
  dockerfile: string
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
    //console.info('Requested to build the following contracts:')
    const longestCrateName = sources.map(source=>source.crate.length).reduce((x,y)=>Math.max(x,y),0)
    for (const source of sources) {
      const outputDir = $(source.workspace.path).resolve(this.outputDirName)
      const prebuilt  = this.prebuild(outputDir, source.crate, source.workspace.ref)
      BuildLogger(console).BuildOne(source, prebuilt, longestCrateName)
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
        if (this.verbose) BuildLogger(console).Workspace(mounted, ref)
        if (ref !== HEAD) {
          mounted = gitDir.rootRepo
          //console.info(`Using history from Git directory: `, bold(`${mounted.shortPath}/`))
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
        const buildArtifacts = await this.runBuildContainer(
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
            artifacts[index] = Object.assign(artifact, {
              source: artifact.source ?? sources[index]
            })
          }
        }
      }
    }
    return artifacts
  }
  protected async runBuildContainer (
    root:      string,
    subdir:    string,
    ref:       string,
    crates:    [number, string][],
    gitSubdir: string = '',
    outputDir: string = $(root, subdir, this.outputDirName).path,
  ): Promise<(Artifact|null)[]> {
    // Create output directory as user if it does not exist
    $(outputDir).as(OpaqueDirectory).make()
    // Output slots. Indices should correspond to those of the input to buildMany
    const artifacts:   (Artifact|null)[] = crates.map(()=>null)
    // Whether any crates should be built, and at what indices they are in the input and output.
    const shouldBuild: Record<string, number> = {}
    // Collect cached artifacts. If any are missing from the cache mark them as buildable.
    for (const [index, crate] of crates) {
      const prebuilt = this.prebuild(outputDir, crate, ref)
      if (prebuilt) {
        const location = $(prebuilt.url!).shortPath
        //console.info('Exists, not rebuilding:', bold($(location).shortPath))
        artifacts[index] = prebuilt
      } else {
        shouldBuild[crate] = index
      }
    }
    // If there are no artifacts to build, this means everything was cached and we're done.
    if (Object.keys(shouldBuild).length === 0) {
      return artifacts
    }
    // Define the mounts and environment variables of the build container
    const buildScript   = `/${basename(this.script)}`
    const safeRef       = sanitize(ref)
    const knownHosts    = $(`${homedir()}/.ssh/known_hosts`)
    const etcKnownHosts = $(`/etc/ssh/ssh_known_hosts`)
    const readonly = {
      // The script that will run in the container
      [this.script]:                buildScript,
      // Root directory of repository, containing real .git directory
      [$(root).path]:              `/src`,
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
      if (ref !== HEAD) {
        throw new Error(
          'Fadroma Build: FADROMA_BUILD_WORKSPACE_ROOT can only' +
          'be used when building from working tree'
        )
      }
      writable[$(root).path] = readonly[$(root).path]
      delete readonly[$(root).path]
      readonly[$(process.env.FADROMA_BUILD_WORKSPACE_MANIFEST).path] = `/src/Cargo.toml`
    }
    // Variables used by the build script are prefixed with underscore
    // and variables used by the tools used by the build script are left as is
    const env = {
      _BUILD_USER:                  process.env.FADROMA_BUILD_USER || 'fadroma-builder',
      _BUILD_UID:                   process.env.FADROMA_BUILD_UID  || process.getuid(),
      _BUILD_GID:                   process.env.FADROMA_BUILD_GID  || process.getgid(),
      _GIT_REMOTE:                  process.env.FADROMA_PREFERRED_REMOTE||'origin',
      _GIT_SUBDIR:                  gitSubdir,
      _SUBDIR:                      subdir,
      _NO_FETCH:                    this.noFetch,
      CARGO_HTTP_TIMEOUT:           '240',
      CARGO_NET_GIT_FETCH_WITH_CLI: 'true',
      GIT_PAGER:                    'cat',
      GIT_TERMINAL_PROMPT:          '0',
      LOCKED:                       '',/*'--locked'*/
      SSH_AUTH_SOCK:                '/ssh_agent_socket',
      TERM:                         process.env.TERM,
    }
    // Pre-populate the list of expected artifacts.
    const outputWasms: Array<string|null> = [...new Array(crates.length)].map(()=>null)
    for (const [crate, index] of Object.entries(shouldBuild)) {
      outputWasms[index] = $(outputDir, artifactName(crate, safeRef)).path
    }
    // Pass the compacted list of crates to build into the container
    const cratesToBuild = Object.keys(shouldBuild)
    const command = ['node', buildScript, 'phase1', ref, ...cratesToBuild]
    const options = {
      remove: true,
      readonly,
      writable,
      cwd: '/src',
      env,
      extra: {
        Tty:         true,
        AttachStdin: true,
      }
    }
    //console.info('Building with command:', bold(command.join(' ')))
    //console.debug('Building in a container with this configuration:', options)
    // Prepare the log output stream
    const buildLogPrefix = `[${ref}]`.padEnd(16)
    const logs = new LineTransformStream((line:string)=>`[Fadroma Build] ${buildLogPrefix} ${line}`)
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
        return new Artifact(undefined, $(location).url, this.codeHashForPath(location))
      }
    })
  }
}

/** This build mode looks for a Rust toolchain in the same environment
  * as the one in which the script is running, i.e. no build container. */
export class RawBuilder extends CachingBuilder {
  /** Build a Source into an Artifact */
  async build (source: Source): Promise<Artifact> {
    return (await this.buildMany([source]))[0]
  }
  /** This implementation groups the passed source by workspace and ref,
    * in order to launch one build container per workspace/ref combination
    * and have it build all the crates from that combination in sequence,
    * reusing the container's internal intermediate build cache. */
  async buildMany (sources: Source[]): Promise<Artifact[]> {
    const artifacts: Artifact[] = []
    for (const source of sources) {
      let cwd = source.workspace.path
      // Temporary dirs used for checkouts of non-HEAD builds
      let tmpGit, tmpBuild
      // Most of the parameters are passed to the build script
      // by way of environment variables.
      const env = {
        _BUILD_GID: process.getgid(),
        _BUILD_UID: process.getuid(),
        _OUTPUT:    $(source.workspace.path).in('artifacts').path,
        _REGISTRY:  '',
        _TOOLCHAIN: this.toolchain,
      }
      if ((source.workspace.ref ?? HEAD) !== HEAD) {
        // Provide the build script with the config values that ar
        // needed to make a temporary checkout of another commit
        if (!source.workspace.gitDir?.present) {
          const error = new Error("Fadroma Build: could not find Git directory for source.")
          throw Object.assign(error, { source })
        }
        // Create a temporary Git directory. The build script will copy the Git history
        // and modify the refs in order to be able to do a fresh checkout with submodules
        const { gitDir } = source.workspace
        tmpGit   = $(mkdtempSync($(tmpdir(), 'fadroma-git-').path))
        tmpBuild = $(mkdtempSync($(tmpdir(), 'fadroma-build-').path))
        Object.assign(env, {
          _GIT_ROOT:   gitDir.path,
          _GIT_SUBDIR: gitDir.isSubmodule ? gitDir.submoduleDir : '',
          _NO_FETCH:   this.noFetch,
          _TMP_BUILD:  tmpBuild.path,
          _TMP_GIT:    tmpGit.path,
        })
      }
      // Run the build script
      const cmd = [
        this.runtime,
        this.script,
        'phase1',
        source.workspace.ref,
        source.crate
      ]
      const opts = { cwd, env: { ...process.env, ...env }, stdio: 'inherit' }
      const sub  = spawn(cmd.shift() as string, cmd, opts as any)
      await new Promise<void>((resolve, reject)=>{
        sub.on('exit', (code, signal) => {
          const build = `Build of ${source.crate} from ${$(source.workspace.path).shortPath} @ ${source.workspace.ref}`
          if (code === 0) {
            resolve()
          } else if (code !== null) {
            const message = `${build} exited with code ${code}`
            console.error(message)
            throw Object.assign(new Error(message), { source, code })
          } else if (signal !== null) {
            const message = `${build} exited by signal ${signal}`
            console.warn(message)
          } else {
            throw new Error('Unreachable')
          }
        })
      })
      // Create an artifact for the build result
      const location = $(env._OUTPUT, artifactName(source.crate, sanitize(source.workspace.ref)))
      console.info('Build ok:', bold(location.shortPath))
      const codeHash = this.codeHashForPath(location.path)
      artifacts.push(new Artifact(source, pathToFileURL(location.path), codeHash))
      // If this was a non-HEAD build, remove the temporary Git dir used to do the checkout
      if (tmpGit   && tmpGit.exists())   tmpGit.delete()
      if (tmpBuild && tmpBuild.exists()) tmpBuild.delete()
    }
    return artifacts
  }

  runtime = process.argv[0]
}

type CargoTOML = TOMLFile<{ package: { name: string } }>

export async function buildFromCargoToml (
  cargoToml: CargoTOML,
  workspace: Workspace = new Workspace(
    process.env.FADROMA_BUILD_WORKSPACE_ROOT||cargoToml.parent
  )
) {
  console.info('Build manifest:', bold(cargoToml.shortPath))
  const source = workspace.crate((cargoToml.as(TOMLFile).load() as any).package.name)
  try {
    const config   = { ...getBuilderConfig(), rebuild: true }
    const builder  = getBuilder(config)
    const artifact = await builder.build(source)
    console.info('Built:    ', bold($(artifact.url!).shortPath))
    console.info('Code hash:', bold(artifact.codeHash!))
    process.exit(0)
  } catch (e) {
    console.error(`Build failed.`)
    console.error(e)
    process.exit(5)
  }
}

export async function buildFromBuildScript (
  buildScript: OpaqueFile,
  buildArgs:   string[] = []
) {
  const buildSetName = buildArgs.join(' ')
  console.info('Build script:', bold(buildScript.shortPath))
  console.info('Build set:   ', bold(buildSetName || '(none)'))
  //@ts-ignore
  const {default: buildSets} = await import(buildScript.path)
  if (buildArgs.length > 0) {
    const buildSet = buildSets[buildSetName]
    if (!buildSet) {
      console.error(`No build set ${bold(buildSetName)}.`)
      listBuildSets(buildSets)
      process.exit(1)
    } else if (!(buildSet instanceof Function)) {
      console.error(`Invalid build set ${bold(buildSetName)} - must be function, got: ${typeof buildSet}`)
      process.exit(2)
    } else {
      const buildSources = buildSet()
      if (!(buildSources instanceof Array)) {
        console.error(`Invalid build set ${bold(buildSetName)} - must return Array<Source>, got: ${typeof buildSources}`)
        process.exit(3)
      }
      const T0 = + new Date()
      try {
        const config = { ...getBuilderConfig(), rebuild: true }
        await getBuilder(config).buildMany(buildSources)
        const T1 = + new Date()
        console.info(`Build complete in ${T1-T0}ms.`)
        process.exit(0)
      } catch (e) {
        console.error(`Build failed.`)
        console.error(e)
        process.exit(4)
      }
    }
  } else {
    console.warn(bold('No build set specified.'))
    listBuildSets(buildSets)
  }
}

export function listBuildSets (buildSets: Record<string, ()=>Source[]>) {
  console.log('Available build sets:')
  for (let [name, getSources] of Object.entries(buildSets)) {
    console.log(`\n  ${name}`)
    const sources = getSources()
    for (const source of sources as Array<Source>) {
      console.log(`    ${bold(source.crate)} @ ${source.workspace.ref}`)
    }
  }
}

/** A Source or a string to be passed to workspace.crate */
export type IntoSource   = Source|string

/** An Artifact or an IntoSource to be built */
export type IntoArtifact = Artifact|IntoSource

/** The Git reference pointing to the currently checked out working tree */
export const HEAD = 'HEAD'

/** Represents a crate in a workspace.
  * The workspace may be at HEAD (build from working tree)
  * or another ref (build from Git history). */
export class Source {
  constructor (
    public readonly workspace: Workspace,
    public readonly crate:     string,
  ) {}
  build (builder: Builder): Promise<Artifact> {
    return builder.build(this)
  }
  at (ref?: string): Source {
    if (!ref) return this
    return new Source(this.workspace.at(ref), this.crate)
  }
}

/** Represents a Cargo workspace containing multiple smart contract crates */
export class Workspace {
  constructor (
    public readonly path:   string,
    public readonly ref:    string = HEAD,
    public readonly gitDir: DotGit = new DotGit(path)
  ) {}
  /** Create a new instance of the same workspace that will
    * return Source objects pointing to a specific Git ref. */
  at (ref: string): this {
    interface WorkspaceCtor<W> { new (path: string, ref?: string, gitDir?: DotGit): W }
    return new (this.constructor as WorkspaceCtor<typeof this>)(this.path, ref, this.gitDir)
  }
  /** Get a Source object pointing to a crate from the current workspace and ref */
  crate (crate: string): Source {
    if (crate.indexOf('@') > -1) {
      const [name, ref] = crate.split('@')
      return new Source(this.at(ref), name)
    }
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
  constructor (base: string, ...fragments: string[]) {
    super(base, ...fragments, '.git')
    if (!this.exists()) {
      // If .git does not exist, it is not possible to build past commits
      console.warn(bold(this.shortPath), 'does not exist')
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
        //console.info(bold(this.shortPath), 'is a file, pointing to', bold(gitRoot.shortPath))
        this.path      = gitRoot.path
        this.present   = true
        this.isSubmodule = true
      } else {
        // Otherwise, who knows?
        console.info(bold(this.shortPath), 'is an unknown file.')
        this.present = false
      }
    } else if (this.isDirectory()) {
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

//@ts-ignore
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const config = { build: getBuilderConfig(process.cwd(), process.env as Record<string, string>) }
  const [buildPath, ...buildArgs] = process.argv.slice(2)
  const buildSpec = $(buildPath)
  if (buildSpec.isDirectory()) {
    buildFromDirectory(buildSpec.as(OpaqueDirectory))
  } else if (buildSpec.isFile()) {
    buildFromFile(buildSpec.as(OpaqueFile), buildArgs)
  } else {
    printUsage()
  }
}

export function printUsage () {
  console.log(`
    Usage:
      fadroma-build path/to/crate
      fadroma-build path/to/Cargo.toml
      fadroma-build buildConfig.{js|ts}`)
  process.exit(6)
}

export function buildFromDirectory (dir: OpaqueDirectory) {
  const cargoToml = dir.at('Cargo.toml').as(TOMLFile)
  if (cargoToml.exists()) {
    console.info('Building from', bold(cargoToml.shortPath))
    buildFromCargoToml(cargoToml as CargoTOML)
  } else {
    printUsage()
  }
}

export function buildFromFile (
  file:      TOMLFile<unknown>|OpaqueFile,
  buildArgs: string[] = []
) {
  if (file.name === 'Cargo.toml') {
    BuildLogger(console).CargoToml(file)
    buildFromCargoToml(file as CargoTOML)
  } else {
    BuildLogger(console).BuildScript(file)
    buildFromBuildScript(file as OpaqueFile, buildArgs)
  }
}
