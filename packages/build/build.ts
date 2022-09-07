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

import * as Konzola from '@hackbg/konzola'
import * as Formati from '@hackbg/formati'
import * as Konfizi from '@hackbg/konfizi'
import * as Komandi from '@hackbg/komandi'
import * as Dokeres from '@hackbg/dokeres'
import * as Kabinet from '@hackbg/kabinet'
import $ from '@hackbg/kabinet'

import { Contract, Builder, Deployment } from '@fadroma/client'
import type { IntoContract } from '@fadroma/client'

import { default as simpleGit } from 'simple-git'

import { spawn                        } from 'child_process'
import { basename, resolve, dirname   } from 'path'
import { homedir, tmpdir              } from 'os'
import { pathToFileURL, fileURLToPath } from 'url'
import { readFileSync, mkdtempSync    } from 'fs'

export class BuilderConfig extends Konfizi.EnvConfig {

  constructor (
    readonly env: Konfizi.Env = process.env,
    readonly cwd: string      = process.cwd(),
    defaults: Partial<BuilderConfig> = {}
  ) {
    super(env, cwd)
    this.override(defaults)
  }

  /** Project root. Defaults to current working directory. */
  project:    string
    = this.getString ('FADROMA_PROJECT',          ()=>this.cwd)
  /** Whether to bypass Docker and use the toolchain from the environment. */
  buildRaw:   boolean
    = this.getBoolean('FADROMA_BUILD_RAW',        ()=>false)
  /** Whether to ignore existing build artifacts and rebuild contracts. */
  rebuild:    boolean
    = this.getBoolean('FADROMA_REBUILD',          ()=>false)
  /** Whether not to run `git fetch` during build. */
  noFetch:    boolean
    = this.getBoolean('FADROMA_NO_FETCH',         ()=>false)
  /** Which version of the Rust toolchain to use, e.g. `1.59.0` */
  toolchain:  string
    = this.getString ('FADROMA_RUST',             ()=>'')
  /** Docker image to use for dockerized builds. */
  image:      string
    = this.getString ('FADROMA_BUILD_SCRIPT',     ()=>DockerBuilder.image)
  /** Dockerfile to build the build image if not downloadable. */
  dockerfile: string
    = this.getString ('FADROMA_BUILD_IMAGE',      ()=>DockerBuilder.dockerfile)
  /** Script that runs the actual build, e.g. build.impl.mjs */
  script:     string
    = this.getString ('FADROMA_BUILD_DOCKERFILE', ()=>LocalBuilder.script)
}

export class BuildConsole extends Komandi.CommandsConsole {

  name = 'Fadroma Build'

  buildingFromCargoToml (file: Kabinet.Path|string) {
    this.info('Building from', bold($(file).shortPath))
  }

  buildingFromBuildScript (file: Kabinet.Path|string) {
    this.info('Running build script', bold($(file).shortPath))
  }

  buildingFromWorkspace (mounted: Kabinet.Path|string, ref: string = HEAD) {
    this.info(
      `Building contracts from workspace:`, bold(`${$(mounted).shortPath}/`),
      `@`, bold(ref)
    )
  }

  buildingOne (source: Contract, prebuilt: Contract|null) {
    if (prebuilt) {
      this.info('Reuse    ', bold($(prebuilt.artifact!).shortPath))
    } else {
      const { crate = '(unknown)', ref = 'HEAD' } = source
      if (ref === 'HEAD') {
        this.info('Building', bold(crate), 'from working tree')
      } else {
        this.info('Building', bold(crate), 'from Git reference', bold(ref))
      }
    }
  }

  buildingMany (sources: Contract[]) {
    for (const source of sources) {
      const { crate = '(unknown)', ref = 'HEAD' } = source
      if (ref === 'HEAD') {
        this.info('Building', bold(crate), 'from working tree')
      } else {
        this.info('Building', bold(crate), 'from Git reference', bold(ref))
      }
    }
    this.info()
  }

}

const bold = Konzola.bold

/** Get a builder based on the builder config. */
export function getBuilder (config: Partial<BuilderConfig> = new BuilderConfig()) {
  if (config.buildRaw) {
    return new RawBuilder({ ...config, caching: !config.rebuild })
  } else {
    return new DockerBuilder({ ...config, caching: !config.rebuild })
  }
}

/** The Git reference pointing to the currently checked out working tree */
export const HEAD = 'HEAD'

export function getGitDir ({ repo }: Contract): DotGit {
  if (!repo) throw new Error('Contract: no path when trying to access gitDir')
  return new DotGit(repo)
}

/** Represents the real location of the Git data directory.
  * - In standalone repos this is `.git/`
  * - If the contracts workspace repository is a submodule,
  *   `.git` will be a file containing e.g. "gitdir: ../.git/modules/something" */
export class DotGit extends Kabinet.Path {

  /* Matches "/.git" or "/.git/" */
  static rootRepoRE = new RegExp(`${Kabinet.Path.separator}.git${Kabinet.Path.separator}?`)

  constructor (base: string|URL, ...fragments: string[]) {

    if (base instanceof URL) base = fileURLToPath(base)

    super(base, ...fragments, '.git')

    if (!this.exists()) {
      // If .git does not exist, it is not possible to build past commits
      this.log.warn(bold(this.shortPath), 'does not exist')
      this.present = false

    } else if (this.isFile()) {
      // If .git is a file, the workspace is contained in a submodule
      const gitPointer = this.as(Kabinet.TextFile).load().trim()
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

  log = new BuildConsole(console, 'Fadroma.DotGit')

  readonly present:     boolean

  readonly isSubmodule: boolean = false

  get rootRepo (): Kabinet.Path {
    return $(this.path.split(DotGit.rootRepoRE)[0])
  }

  get submoduleDir (): string {
    return this.path.split(DotGit.rootRepoRE)[1]
  }

}

//@ts-ignore
export const buildPackage = dirname(fileURLToPath(import.meta.url))

export const artifactName = (crate: string, ref: string) => `${crate}@${sanitize(ref)}.wasm`

export const sanitize = (ref: string) => ref.replace(/\//g, '_')

export const codeHashForBlob = (blob: Uint8Array) =>
  Formati.Encoding.toHex(new Formati.Crypto.Sha256(blob).digest())

export const distinct = <T> (x: T[]): T[] => [...new Set(x) as any]

export interface LocalBuilderOptions {
  /** Script that implements the actual build procedure. */
  script:        string
  /** Don't run "git fetch" during build. */
  noFetch:       boolean
  /** Name of output directory. */
  outputDirName: string
  /** Which version of the language toolchain to use. */
  toolchain:     string
  /** Whether to enable caching and reuse contracts from artifacts directory. */
  caching: boolean
}

export interface DockerBuilderOptions extends LocalBuilderOptions {
  /** Path to Docker API endpoint. */
  socketPath: string
  /** Docker API client instance. */
  docker:     Dokeres.Engine
  /** Build image. */
  image:      string|Dokeres.Image
  /** Dockerfile for building the build image. */
  dockerfile: string
}

/** Can perform builds.
  * Will only perform a build if a contract is not built yet or FADROMA_REBUILD=1 is set. */
export abstract class LocalBuilder extends Builder {

  readonly id: string = 'local'

  /** Default build script */
  static script = resolve(buildPackage, 'build.impl.mjs')

  constructor (options: Partial<LocalBuilder> = {}) {
    super()
    this.override(options)
  }

  /** The build script. */
  script:        string      = LocalBuilder.script

  /** Whether to set _NO_FETCH=1 in build script's environment and skip "git fetch" calls */
  noFetch:       boolean     = false

  /** Name of directory where build artifacts are collected. */
  outputDirName: string      = 'artifacts'

  /** Version of Rust toolchain to use. */
  toolchain:     string|null = null

  /** Whether the build process should print more detail to the console. */
  verbose:       boolean     = false

  /** Whether to enable caching. */
  caching:       boolean     = true

  /** Check if artifact exists in local artifacts cache directory.
    * If it does, don't rebuild it but return it from there. */
  protected prebuild (
    outputDir: string, crate?: string, ref: string = HEAD
  ): Contract|null {
    if (this.caching && crate) {
      const location = $(outputDir, artifactName(crate, ref))
      if (location.exists()) {
        const artifact = location.url
        const codeHash = this.codeHashForPath(location.path)
        return new Contract({ crate, ref, artifact, codeHash })
      }
    }
    return null
  }

  codeHashForPath = codeHashForPath

}

export const codeHashForPath = (location: string) => codeHashForBlob(readFileSync(location))

/** This build mode looks for a Rust toolchain in the same environment
  * as the one in which the script is running, i.e. no build container. */
export class RawBuilder extends LocalBuilder {

  readonly id = 'raw-local'

  log = new BuildConsole(console, 'Fadroma.RawBuilder')

  runtime = process.argv[0]

  /** Build a Source into a Template */
  async build (source: Contract): Promise<Contract> {
    const { workspace, ref = HEAD, crate } = source
    if (!workspace) throw new Error('no workspace')
    if (!crate)     throw new Error('no crate')

    // Temporary dirs used for checkouts of non-HEAD builds
    let tmpGit, tmpBuild

    // Most of the parameters are passed to the build script
    // by way of environment variables.
    const env = {
      _BUILD_GID: process.getgid(),
      _BUILD_UID: process.getuid(),
      _OUTPUT:    $(workspace).in('artifacts').path,
      _REGISTRY:  '',
      _TOOLCHAIN: this.toolchain,
    }

    if ((ref ?? HEAD) !== HEAD) {
      const gitDir = getGitDir(source)
      // Provide the build script with the config values that ar
      // needed to make a temporary checkout of another commit
      if (!gitDir?.present) {
        const error = new Error("Fadroma Build: could not find Git directory for source.")
        throw Object.assign(error, { source })
      }
      // Create a temporary Git directory. The build script will copy the Git history
      // and modify the refs in order to be able to do a fresh checkout with submodules
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
    const cmd = [this.runtime, this.script, 'phase1', ref, crate ]
    const opts = { cwd: source.workspace, env: { ...process.env, ...env }, stdio: 'inherit' }
    const sub  = spawn(cmd.shift() as string, cmd, opts as any)
    await new Promise<void>((resolve, reject)=>{
      sub.on('exit', (code: number, signal: any) => {
        const build = `Build of ${source.crate} from ${$(source.workspace!).shortPath} @ ${source.ref}`
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
    const location = $(env._OUTPUT, artifactName(crate, sanitize(ref)))
    this.log.info('Build ok:', bold(location.shortPath))
    return Object.assign(new Contract(source), {
      artifact: pathToFileURL(location.path),
      codeHash: this.codeHashForPath(location.path)
    })
  }

  /** This implementation groups the passed source by workspace and ref,
    * in order to launch one build container per workspace/ref combination
    * and have it build all the crates from that combination in sequence,
    * reusing the container's internal intermediate build cache. */
  async buildMany (inputs: Contract[]): Promise<Contract[]> {
    const templates: Contract[] = []
    for (const source of inputs) templates.push(await this.build(source))
    return templates
  }

}

/** This builder launches a one-off build container using Dockerode. */
export class DockerBuilder extends LocalBuilder {

  readonly id = 'docker-local'

  static image = 'ghcr.io/hackbg/fadroma:unstable'

  static dockerfile = resolve(buildPackage, 'build.Dockerfile')

  constructor (opts: Partial<DockerBuilderOptions> = {}) {
    super(opts)
    // Set up Docker API handle
    if (opts.socketPath) {
      this.docker = new Dokeres.Engine(this.socketPath = opts.socketPath)
    } else if (opts.docker) {
      this.docker = opts.docker
    }
    if (opts.image instanceof Dokeres.Image) {
      this.image = opts.image
    } else if (opts.image) {
      this.image = new Dokeres.Image(this.docker, opts.image)
    } else {
      this.image = new Dokeres.Image(this.docker, 'ghcr.io/hackbg/fadroma:unstable')
    }
    // Set up Docker image
    this.dockerfile ??= opts.dockerfile!
    this.script     ??= opts.script!
  }

  log = new BuildConsole(console, 'Fadroma.DockerBuilder')

  /** Used to launch build container. */
  socketPath: string  = '/var/run/docker.sock'

  /** Used to launch build container. */
  docker:     Dokeres.Engine = new Dokeres.Engine(this.socketPath)

  /** Tag of the docker image for the build container. */
  image:      Dokeres.Image

  /** Path to the dockerfile to build the build container if missing. */
  dockerfile: string

  /** Build a Source into a Template */
  async build (source: Contract): Promise<Contract> {
    return (await this.buildMany([source]))[0]
  }

  /** This implementation groups the passed source by workspace and ref,
    * in order to launch one build container per workspace/ref combination
    * and have it build all the crates from that combination in sequence,
    * reusing the container's internal intermediate build cache. */
  async buildMany (inputs: Contract[]): Promise<Contract[]> {

    const longestCrateName = inputs
      .map(source=>source.crate?.length||0)
      .reduce((x,y)=>Math.max(x,y),0)

    for (const source of inputs) {
      const { repo, crate, ref } = source
      if (!repo) throw new Error('missing repo path in source')
      const outputDir = $(repo).resolve(this.outputDirName)
      const prebuilt  = this.prebuild(outputDir, source.crate, source.ref)
      this.log.buildingOne(source, prebuilt)
    }

    // Collect a mapping of workspace path -> Workspace object
    const workspaces: Record<string, Contract> = {}
    for (const source of inputs) {
      const { repo, workspace } = source
      const gitDir = getGitDir(source)
      if (!repo)      throw new Error('missing repo path in source')
      if (!workspace) throw new Error('missing workspace in source')
      workspaces[workspace] = new Contract(workspace)
      // No way to checkout non-`HEAD` ref if there is no `.git` dir
      if (source.ref !== HEAD && !gitDir?.present) {
        const error = new Error("Fadroma Build: could not find Git directory for source.")
        throw Object.assign(error, { source })
      }
    }

    // Here we will collect the build outputs
    const outputs: Contract[] = inputs.map(input=>new Contract({ ...input, builder: this }))

    // Get the distinct workspaces and refs by which to group the crate builds
    const roots: string[] = distinct(inputs.map(source=>source.workspace!))
    const refs:  string[] = distinct(inputs.map(source=>source.ref??HEAD))

    // For each workspace/ref pair
    for (const path of roots) for (const ref of refs) {
      await buildFor.call(this, path, ref)
    }

    return outputs

    const self = this
    async function buildFor (this: typeof self, path: string, ref: string) {
      let mounted = $(path)
      if (this.verbose) this.log.buildingFromWorkspace(mounted, ref)
      if (ref !== HEAD) {
        const gitDir = getGitDir(workspaces[path])
        mounted = gitDir.rootRepo
        //console.info(`Using history from Git directory: `, bold(`${mounted.shortPath}/`))
        await simpleGit(gitDir.path)
          .fetch(process.env.FADROMA_PREFERRED_REMOTE || 'origin')
      }
      // Create a list of sources for the container to build,
      // along with their indices in the input and output arrays
      // of this function.
      const crates: [number, string][] = []
      for (let index = 0; index < inputs.length; index++) {
        const source = inputs[index]
        if (source.workspace === path && source.ref === ref) {
          crates.push([index, source.crate!])
        }
      }
      // Build the crates from each same workspace/ref pair and collect the results.
      // sequentially in the same container.
      // Collect the templates built by the container
      const results = await this.runBuildContainer(
        mounted.path,
        mounted.relative(path),
        ref,
        crates,
        (ref !== HEAD)
          ? (gitDir=>gitDir.isSubmodule?gitDir.submoduleDir:'')(getGitDir(workspaces[path]))
          : ''
      )
      for (const index in results) {
        if (!results[index]) continue
        outputs[index] = new Contract({ ...results[index], ...inputs[index] })
      }
    }

  }

  protected async runBuildContainer (
    root:      string,
    subdir:    string,
    ref:       string,
    crates:    [number, string][],
    gitSubdir: string = '',
    outputDir: string = $(root, subdir, this.outputDirName).path,
  ): Promise<(Contract|null)[]> {
    // Create output directory as user if it does not exist
    $(outputDir).as(Kabinet.OpaqueDirectory).make()

    // Output slots. Indices should correspond to those of the input to buildMany
    const templates:   (Contract|null)[] = crates.map(()=>null)

    // Whether any crates should be built, and at what indices they are in the input and output.
    const shouldBuild: Record<string, number> = {}

    // Collect cached templates. If any are missing from the cache mark them as buildable.
    for (const [index, crate] of crates) {
      const prebuilt = this.prebuild(outputDir, crate, ref)
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
    const command = [ 'node', buildScript, 'phase1', ref, ...cratesToBuild ]
    const extra   = { Tty: true, AttachStdin: true, }
    const options = { remove: true, readonly, writable, cwd: '/src', env, extra }

    //console.info('Building with command:', bold(command.join(' ')))
    //console.debug('Building in a container with this configuration:', options)
    // Prepare the log output stream
    const buildLogPrefix = `[${ref}]`.padEnd(16)
    const transformLine  = (line:string)=>`[Fadroma Build] ${buildLogPrefix} ${line}`
    const logs = new Dokeres.LineTransformStream(transformLine)
    logs.pipe(process.stdout)

    // Run the build container
    const rootName       = sanitize(basename(root))
    const buildName      = `fadroma-build-${rootName}@${ref}`
    const buildContainer = await this.image.run(buildName, options, command, '/usr/bin/env', logs)
    const {Error: err, StatusCode: code} = await buildContainer.wait()

    // Throw error if launching the container failed
    if (err) {
      throw new Error(`[@fadroma/build] Docker error: ${err}`)
    }

    // Throw error if the build failed
    if (code !== 0) {
      const crateList = cratesToBuild.join(' ')
      this.log.error(
        'Build of crates:',   bold(crateList),
        'exited with status', bold(code)
      )
      throw new Error(
        `[@fadroma/build] Build of crates: "${crateList}" exited with status ${code}`
      )
    }

    // Return a sparse array of the resulting artifacts
    return outputWasms.map(location =>
      (location === null) ? null : new Contract({
        artifact: $(location).url,
        codeHash: this.codeHashForPath(location)
      }))

  }

}

type CargoTOML = Kabinet.TOMLFile<{ package: { name: string } }>

export class BuildCommands extends Deployment {

  constructor (options: Partial<BuildCommands> = {}) {
    super({ name: 'build' })
    this.config ??= new BuilderConfig(this.env, this.cwd, options.config)
    this.builder = getBuilder(this.config)
    this.command('one', 'build one crate from working tree', this.buildOne)
  }

  /** Setting for the build context. */
  config:    BuilderConfig

  project:   string = ''

  /** Knows how to build contracts for a target. */
  builder:   Builder

  buildOne = (
    [buildPath, ...buildArgs] = process.argv.slice(2),
    buildSpec = $(buildPath)
  ) => {
    
    if (buildSpec.isDirectory()) {
      return this.buildFromDirectory(buildSpec.as(Kabinet.OpaqueDirectory))
    } else if (buildSpec.isFile()) {
      return this.buildFromFile(buildSpec.as(Kabinet.OpaqueFile), buildArgs)
    } else {
      return this.printUsage()
    }
  }

  buildFromCargoToml = async (
    cargoToml: CargoTOML,
    repo      = process.env.FADROMA_BUILD_REPO_ROOT      || cargoToml.parent,
    workspace = process.env.FADROMA_BUILD_WORKSPACE_ROOT || cargoToml.parent
  ) => {
    this.log.info('Build manifest:', bold(cargoToml.shortPath))
    const source = new Contract({
      repo,
      workspace,
      crate: (cargoToml.as(Kabinet.TOMLFile).load() as any).package.name
    })
    try {
      (this.builder as LocalBuilder).caching = false
      const result = await this.builder.build(source)
      const { artifact, codeHash } = result
      this.log.info('Built:    ', bold($(artifact!).shortPath))
      this.log.info('Code hash:', bold(codeHash!))
      this.exit(0)
      return result
    } catch (e) {
      this.log.error(`Build failed.`)
      this.log.error(e)
      this.exit(5)
    }
  }

  buildFromBuildScript = async (
    buildScript: Kabinet.OpaqueFile,
    buildArgs:   string[] = []
  ) => {
    const buildSetName = buildArgs.join(' ')
    this.log.info('Build script:', bold(buildScript.shortPath))
    this.log.info('Build set:   ', bold(buildSetName || '(none)'))
    //@ts-ignore
    const {default: buildSets} = await import(buildScript.path)
    if (buildArgs.length > 0) {
      const buildSet = buildSets[buildSetName]
      if (!buildSet) {
        this.log.error(`No build set ${bold(buildSetName)}.`)
        this.listBuildSets(buildSets)
        this.exit(1)
      } else if (!(buildSet instanceof Function)) {
        this.log.error(`Invalid build set ${bold(buildSetName)} - must be function, got: ${typeof buildSet}`)
        this.exit(2)
      } else {
        const buildSources = buildSet()
        if (!(buildSources instanceof Array)) {
          this.log.error(`Invalid build set ${bold(buildSetName)} - must return Array<Source>, got: ${typeof buildSources}`)
          this.exit(3)
        }
        const T0 = + new Date()
        try {
          const config = { ...new BuilderConfig(), rebuild: true }
          await getBuilder(config).buildMany(buildSources)
          const T1 = + new Date()
          this.log.info(`Build complete in ${T1-T0}ms.`)
          this.exit(0)
        } catch (e) {
          this.log.error(`Build failed.`)
          this.log.error(e)
          this.exit(4)
        }
      }
    } else {
      this.log.warn(bold('No build set specified.'))
      this.listBuildSets(buildSets)
    }
  }

  listBuildSets = (buildSets: Record<string, ()=>Contract[]>) => {
    //this.log.log('Available build sets:')
    //for (let [name, getSources] of Object.entries(buildSets)) {
      //this.log.log(`\n  ${name}`)
      //const sources = getSources()
      //for (const source of sources as Array<Contract>) {
        //this.log.log(`    ${bold(source.crate!)} @ ${source.ref}`)
      //}
    //}
  }

  buildFromDirectory = (dir: Kabinet.OpaqueDirectory) => {
    const cargoToml = dir.at('Cargo.toml').as(Kabinet.TOMLFile)
    if (cargoToml.exists()) {
      this.log.info('Building from', bold(cargoToml.shortPath))
      return this.buildFromCargoToml(cargoToml as CargoTOML)
    } else {
      this.printUsage()
    }
  }

  buildFromFile = async (
    file:      Kabinet.TOMLFile<unknown>|Kabinet.OpaqueFile,
    buildArgs: string[] = []
  ) => {
    if (file.name === 'Cargo.toml') {
      this.log.buildingFromCargoToml(file)
      return this.buildFromCargoToml(file as CargoTOML)
    } else {
      this.log.buildingFromBuildScript(file)
      return this.buildFromBuildScript(file as Kabinet.OpaqueFile, buildArgs)
    }
  }

  printUsage = () => {
    this.log.info(`
      Usage:
        fadroma-build path/to/crate
        fadroma-build path/to/Cargo.toml
        fadroma-build buildConfig.{js|ts}`)
    this.exit(6)
    return true
  }

  log = new BuildConsole(console, 'Fadroma.BuildCommands')

}

export default new BuildCommands()
