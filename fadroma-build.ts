/**
  Fadroma Build
  Copyright (C) 2023 Hack.bg

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
import type Project from './fadroma'
import type { Class, BuilderClass, Buildable, Built, Template } from './fadroma'
import type { Container } from '@hackbg/dock'
import Config from './fadroma-config'
import { Builder, Contract, HEAD, Error as BaseError, Console, bold, colors } from '@fadroma/connect'
import { Engine, Image, Docker, Podman, LineTransformStream } from '@hackbg/dock'
import { hideProperties } from '@hackbg/hide'
import $, {
  Path, OpaqueDirectory, TextFile, BinaryFile, TOMLFile, OpaqueFile
} from '@hackbg/file'
import { default as simpleGit } from 'simple-git'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, sep } from 'node:path'
import { homedir } from 'node:os'
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
/** The parts of Cargo.toml which the builder needs to be aware of. */
export type CargoTOML = {
  package: { name: string },
  dependencies: Record<string, { path?: string }>
}
export { Builder }
/** Can perform builds.
  * Will only perform a build if a contract is not built yet or FADROMA_REBUILD=1 is set. */
export abstract class BuildLocal extends Builder {
  readonly id: string = 'local'
  /** Logger. */
  log = new BuildConsole('build (local)')
  /** The build script. */
  script?:    string
  /** The project workspace. */
  workspace?: string
  /** Whether to skip any `git fetch` calls in the build script. */
  noFetch:    boolean = false
  /** Name of directory where build artifacts are collected. */
  outputDir:  OpaqueDirectory
  /** Version of Rust toolchain to use. */
  toolchain:  string|null = null
  /** Whether the build process should print more detail to the console. */
  verbose:    boolean = false
  /** Whether the build log should be printed only on error, or always */
  quiet:      boolean = false
  /** Default Git reference from which to build sources. */
  revision:   string = HEAD
  /** Owner uid that is set on build artifacts. */
  buildUid?:  number = (process.getuid ? process.getuid() : undefined) // process.env.FADROMA_BUILD_UID
  /** Owner gid that is set on build artifacts. */
  buildGid?:  number = (process.getgid ? process.getgid() : undefined) // process.env.FADROMA_BUILD_GID

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
  protected prebuild (outputDir: string, crate?: string, revision: string = HEAD): Built|null {
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
  protected populatePrebuilt (buildable: Buildable & Partial<Built>): boolean {
    const { workspace, revision, crate } = buildable
    const prebuilt = this.prebuild(this.outputDir.path, crate, revision)
    if (prebuilt) {
      new BuildConsole(`build ${crate}`).found(prebuilt)
      buildable.artifact = prebuilt.artifact
      buildable.codeHash = prebuilt.codeHash
      return true
    }
    return false
  }
  /** @returns the SHA256 hash of the file at the specified location */
  protected hashPath (location: string|Path) {
    return $(location).as(BinaryFile).sha256
  }
  /** @returns a fully populated Buildable from the original */
  protected resolveSource (buildable: string|Buildable): Buildable {
    if (typeof buildable === 'string') buildable = { crate: buildable }
    let { crate, workspace = this.workspace, revision = 'HEAD' } = buildable
    if (!crate) throw new BaseError.Missing.Crate()
    // If the `crate` field contains a slash, this is a crate path and not a crate name.
    // Add the crate path to the workspace path, and set the real crate name.
    if (buildable.crate && buildable.crate.includes(sep)) {
      buildable.workspace = $(buildable.workspace||'', buildable.crate).shortPath
      const cargoTOML = $(buildable.workspace, 'Cargo.toml').as(TOMLFile<CargoTOML>).load()
      buildable.crate = cargoTOML.package.name
    }
    return buildable
  }
}
/** @returns an artifact filename name in the format CRATE@REF.wasm */
export const artifactName = (crate: string, ref: string) =>
  `${crate}@${sanitize(ref)}.wasm`
/** @returns a filename-friendly version of a Git ref */
export const sanitize = (ref: string) =>
  ref.replace(/\//g, '_')
/** @returns an array with duplicate elements removed */
export const distinct = <T> (x: T[]): T[] =>
  [...new Set(x) as any]
/** This builder launches a one-off build container using Dockerode. */
export class BuildContainer extends BuildLocal {
  readonly id = 'Container'
  /** Logger */
  log = new BuildConsole('build (container)')
  /** Used to launch build container. */
  docker: Engine
  /** Tag of the docker image for the build container. */
  image: Image
  /** Path to the dockerfile to build the build container if missing. */
  dockerfile: string
  /** Used to authenticate Git in build container. */
  sshAuthSocket?: string // process.env.SSH_AUTH_SOCK
  /** Used for historical builds. */
  preferredRemote: string = 'origin' // process.env.FADROMA_PREFERRED_REMOTE

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
    this.script ??= opts.script!
    hideProperties(this,
      'log', 'name', 'description', 'timestamp',
      'commandTree', 'currentCommand',
      'args', 'task', 'before')
  }
  get [Symbol.toStringTag]() {
    return `${this.image?.name??'-'} -> ${this.outputDir?.shortPath??'-'}`
  }
  /** Build a single contract. */
  async build (contract: string|Buildable): Promise<Built> {
    return (await this.buildMany([contract]))[0]
  }
  /** This implementation groups the passed source by workspace and ref,
    * in order to launch one build container per workspace/ref combination
    * and have it build all the crates from that combination in sequence,
    * reusing the container's internal intermediate build cache. */
  async buildMany (inputs: (string|(Buildable & Partial<Built>))[]): Promise<Built[]> {
    // This copies the argument because we'll mutate its contents anyway
    inputs = inputs.map(buildable=>this.resolveSource(buildable))
    // Batch together inputs from the same repo+commit
    const [workspaces, revisions] = this.collectBatches(inputs as Buildable[])
    // For each repository/revision pair, build the inputs from it.
    for (const path of workspaces)
      for (const revision of revisions)
        await this.buildBatch(inputs as Buildable[], path, revision)
    return inputs as Built[]
  }
  /** Go over the list of inputs, filtering out the ones that are already built,
    * and collecting the source repositories and revisions. This will allow for
    * multiple crates from the same source checkout to be passed to a single build command. */
  protected collectBatches (inputs: Buildable[]) {
    const workspaces = new Set<string>()
    const revisions  = new Set<string>()
    for (let id in inputs) {
      // Contracts passed as strins are converted to object here
      const buildable = inputs[id] as Buildable & Partial<Built>
      buildable.workspace ??= this.workspace
      buildable.revision  ??= 'HEAD'
      // If the buildable is already built, don't build it again
      if (!this.populatePrebuilt(buildable)) {
        this.log.one(buildable)
        // Set ourselves as the buildable's builder
        buildable.builder = this as unknown as Builder
        // Add the source repository of the contract to the list of inputs to build
        workspaces.add(buildable.workspace!)
        revisions.add(buildable.revision!)
      }
    }
    return [workspaces, revisions]
  }
  protected async buildBatch (inputs: Buildable[], path: string, rev: string = HEAD) {
    this.log.log('Building from', path, '@', rev)
    let root = $(path)
    let gitSubDir = ''
    let srcSubDir = ''
    const paths = new Set([ root.path ])
    // If building from history, make sure that full source is mounted, and fetch history
    if (rev !== HEAD) {
      const gitDir = getGitDir({ workspace: path })
      root = gitDir.rootRepo
      if (gitDir.isSubmodule) gitSubDir = gitDir.submoduleDir
      const remote = this.preferredRemote || 'origin'
      try {
        await this.fetch(gitDir, remote)
      } catch (e) {
        this.log.fetchFailed(remote, e)
      }
    }
    // If inputs contain path dependencies pointing to parent dirs
    // (e.g. fadroma/examples/foo pointing to ../../), make sure
    // those are mounted into the container.
    for (const input of inputs)
      for (const path of this.getPathDependencies(input))
        paths.add(path)
    ;([root, srcSubDir] = this.getSrcSubDir(paths, root))
    if (this.verbose) this.log.workspace(root.path, rev)
    const matched = this.matchBatch(inputs, path, rev)
    const results = await this.runContainer(root.path, root.relative(path), rev, matched, gitSubDir)
    // Using the previously collected indices, populate the values in each of the passed inputs.
    for (const index in results) {
      if (!results[index]) continue
      const input = inputs[index] as Buildable & Partial<Built>
      input.artifact = results[index]!.artifact
      input.codeHash = results[index]!.codeHash
    }
  }
  protected getPathDependencies (input: Buildable): Set<string> {
    const paths = new Set<string>()
    const cargoTOML = $(input.workspace!, 'Cargo.toml').as(TOMLFile<CargoTOML>).load()
    for (const [dep, ver] of Object.entries(cargoTOML.dependencies||[])) {
      if (ver.path) paths.add($(input.workspace!, ver.path).path)
    }
    return paths
  }
  protected getSrcSubDir (paths: Set<string>, root: Path): [Path, string] {
    const allPathFragments  = [...paths].sort().map(path=>path.split(sep))
    const basePathFragments = []
    const firstPath = allPathFragments[0]
    const lastPath  = allPathFragments[allPathFragments.length - 1]
    let i
    for (i = 0; i < firstPath.length; i++) {
      if (firstPath[i] === lastPath[i]) {
        basePathFragments.push(firstPath[i])
      } else {
        break
      }
    }
    const basePath = $(basePathFragments.join(sep))
    return [basePath, basePath.relative($('.', ...root.path.split(sep).slice(i)))]
  }
  protected async fetch (gitDir: Path, remote: string) {
    await simpleGit(gitDir.path).fetch(remote)
  }
  /** Match each crate from the current repo/ref pair
      with its index in the originally passed list of inputs. */
  protected matchBatch (inputs: Buildable[], path: string, rev: string): [number, string][] {
    const crates: [number, string][] = []
    for (let index = 0; index < inputs.length; index++) {
      const buildable = inputs[index] as Buildable & Partial<Built>
      const { crate, workspace, revision = 'HEAD' } = buildable
      if (workspace === path && revision === rev) crates.push([index, crate!])
    }
    return crates
  }
  /** Build the crates from each same workspace/revision pair and collect the results. */
  protected async runContainer (
    root: string, subdir: string, rev: string,
    crates: [number, string][], gitSubDir: string = '', outputDir: string = this.outputDir.path
  ): Promise<(Built|null)[]> {
    if (!this.script) throw new BuildError.ScriptNotSet()
    // Default to building from working tree.
    rev ??= HEAD
    // Collect crates to build
    const [templates, shouldBuild] = this.collectCrates(outputDir, rev, crates)
    // If there are no templates to build, this means everything was cached and we're done.
    if (Object.keys(shouldBuild).length === 0) return templates as Built[]
    // Define the mounts and environment variables of the build container
    const safeRef = sanitize(rev)
    // Pre-populate the list of expected artifacts.
    const outputs = new Array<string|null>(crates.length).fill(null)
    for (const [crate, index] of Object.entries(shouldBuild))
      outputs[index] = $(outputDir, artifactName(crate, safeRef)).path
    // Pass the compacted list of crates to build into the container
    const cratesToBuild = Object.keys(shouldBuild)
    // Rest of container config:
    const buildScript = $(`/`, $(this.script).name).path
    const command = [ 'node', buildScript, 'phase1', rev, ...cratesToBuild ]
    const buildEnv = this.getEnv(subdir, gitSubDir)
    const {readonly, writable} = this.getMounts(buildScript, root, outputDir, safeRef)
    const options = this.getOptions(subdir, gitSubDir, readonly, writable)
    let buildLogs = ''
    const logs = this.getLogStream(rev, (data) => {buildLogs += data})
    // Create output directory as user if it does not exist
    $(outputDir).as(OpaqueDirectory).make()
    // Run the build container
    this.log.container(root, rev, cratesToBuild)
    const name = `fadroma-build-${randomBytes(3).toString('hex')}`
    const buildContainer = await this.image.run(name, options, command, '/usr/bin/env', logs)
    // If this process is terminated, the build container should be killed
    process.once('beforeExit', () => this.killBuildContainer(buildContainer))
    const {error, code} = await buildContainer.wait()
    // Throw error if launching the container failed
    if (error) throw new BuildError(`[@hackbg/fadroma] Docker error: ${error}`)
    // Throw error if the build failed
    if (code !== 0) this.buildFailed(cratesToBuild, code, buildLogs)
    // Return a sparse array of the resulting artifacts
    return outputs.map(x=>this.locationToContract(x) as Built)
  }
  protected getMounts (buildScript: string, root: string, outputDir: string, safeRef: string) {
    if (!this.script) throw new BuildError.ScriptNotSet()
    const readonly: Record<string, string> = {}
    const writable: Record<string, string> = {}
    // Script that will run in the container
    readonly[this.script]  = buildScript 
    // Repo root, containing real .git
    readonly[$(root).path] = '/src'
    // For non-interactively fetching submodules over SSH, we need to propagate known_hosts:
    const userKnownHosts = $(homedir()).in('.ssh').at('known_hosts')
    if (userKnownHosts.isFile()) readonly[userKnownHosts.path] = '/root/.ssh/known_hosts'
    const globalKnownHosts = $(`/etc`).in('ssh').at('ssh_known_hosts')
    if (globalKnownHosts.isFile()) readonly[globalKnownHosts.path] = '/etc/ssh/ssh_known_hosts'
    // For fetching from private repos, we need to give the container access to ssh-agent:
    if (this.sshAuthSocket) readonly[this.sshAuthSocket] = '/ssh_agent_socket'
    // Output path for final artifacts:
    writable[outputDir] = `/output`
    // Persist cache to make future rebuilds faster. May be unneccessary.
    //[`project_cache_${safeRef}`]: `/tmp/target`,
    writable[`cargo_cache_${safeRef}`] = `/usr/local/cargo`
    return { readonly, writable }
  }
  protected collectCrates (outputDir: string, revision: string, crates: [number, string][]) {
    // Output slots. Indices should correspond to those of the input to buildMany
    const templates: Array<Built|null> = crates.map(()=>null)
    // Whether any crates should be built, and at what indices they are in the input and output.
    const shouldBuild: Record<string, number> = {}
    // Collect cached templates. If any are missing from the cache mark them as buildable.
    for (const [index, crate] of crates) {
      const prebuilt = this.prebuild(outputDir, crate, revision)
      if (prebuilt) {
        //const location = $(prebuilt.artifact!).shortPath
        //console.info('Exists, not rebuilding:', bold($(location).shortPath))
        templates[index] = prebuilt
      } else {
        shouldBuild[crate] = index
      }
    }
    return [ templates, shouldBuild ]
  }
  protected getOptions (
    subdir: string, gitSubdir: string, ro: Record<string, string>, rw: Record<string, string>,
  ) {
    const remove = true
    const cwd    = '/src'
    const env    = this.getEnv(subdir, gitSubdir)
    const extra  = { Tty: true, AttachStdin: true }
    return { remove, readonly: ro, writable: rw, cwd, env, extra }
  }
  protected getEnv (subdir: string, gitSubdir: string): Record<string, string> {
    const buildEnv = {
      // Vars used by the build script itself are prefixed with underscore:
      _BUILD_UID:  String(this.buildUid),
      _BUILD_GID:  String(this.buildGid),
      _GIT_REMOTE: this.preferredRemote,
      _GIT_SUBDIR: gitSubdir,
      _SRC_SUBDIR:     subdir,
      _NO_FETCH:   String(this.noFetch),
      _VERBOSE:    String(this.verbose),
      // Vars used by the tools invoked by the build script are left as is:
      LOCKED: '',/*'--locked'*/
      CARGO_HTTP_TIMEOUT: '240',
      CARGO_NET_GIT_FETCH_WITH_CLI: 'true',
      GIT_PAGER: 'cat',
      GIT_TERMINAL_PROMPT: '0',
      SSH_AUTH_SOCK: '/ssh_agent_socket',
      TERM: process?.env?.TERM,
    }
    // Remove keys whose value is `undefined` from `buildEnv`
    for (const key of Object.keys(buildEnv)) {
      if (buildEnv[key as keyof typeof buildEnv] === undefined) {
        delete buildEnv[key as keyof typeof buildEnv]
      }
    }
    return buildEnv as Record<string, string>
  }
  protected getLogStream (revision: string, cb: (data: string)=>void) {
    const log = new Console(`building from ${revision}`)
    // This stream collects the output from the build container, i.e. the build logs.
    const buildLogStream = new LineTransformStream((!this.quiet)
      // In normal and verbose mode, build logs are printed to the console in real time,
      // with an addition prefix to show what is being built.
      ? (line:string)=>log.log(line)
      // In quiet mode the logs are collected into a string as-is,
      // and are only printed if the build fails.
      : (line:string)=>line)
    // In quiet mode, build logs are collected in a string
    // In non-quiet mode, build logs are piped directly to the console;
    if (this.quiet) buildLogStream.on('data', cb)
    return buildLogStream
  }
  protected buildFailed (crates: string[], code: string|number, logs: string) {
    const crateList = crates.join(' ')
    this.log
      .log(logs)
      .error('Build of crates:', bold(crateList), 'exited with status', bold(String(code)))
    throw new BuildError(`[@hackbg/fadroma] Build of crates: "${crateList}" exited with status ${code}`)
  }
  protected locationToContract (location: any) {
    if (location === null) return null
    const artifact = $(location).url
    const codeHash = this.hashPath(location)
    return new Contract({ artifact, codeHash })
  }
  protected async killBuildContainer (buildContainer: Container) {
    if (this.verbose) this.log.log('killing build container', bold(buildContainer.id))
    try {
      await buildContainer.kill()
      this.log.log('killed build container', bold(buildContainer.id))
    } catch (e) {
      if (!e.statusCode) this.log.error(e)
      else if (e.statusCode === 404) {}
      else if (this.verbose) this.log.warn(
        'failed to kill build container', e.statusCode, `(${e.reason})`
      )
    }
  }
}
/** This build mode looks for a Rust toolchain in the same environment
  * as the one in which the script is running, i.e. no build container. */
export class BuildRaw extends BuildLocal {
  readonly id = 'Raw'
  /** Logging handle. */
  log = new BuildConsole('build (raw)')
  /** Node.js runtime that runs the build subprocess.
    * Defaults to the same one that is running this script. */
  runtime = process.argv[0]
  /** Build multiple Sources. */
  async buildMany (inputs: Buildable[]): Promise<Built[]> {
    const templates: Built[] = []
    for (const buildable of inputs) templates.push(await this.build(buildable))
    return templates
  }
  /** Build a Source into a Template */
  async build (buildable: Buildable): Promise<Built> {
    buildable.workspace ??= this.workspace
    buildable.revision  ??= HEAD
    const { workspace, revision, crate } = buildable
    if (!crate && !workspace) throw new BuildError.Missing.Crate()
    const { env, tmpGit, tmpBuild } = this.getEnvAndTemp(buildable, workspace, revision)
    // Run the build script as a subprocess
    const location = await this.runBuild(buildable, env)
    // If this was a non-HEAD build, remove the temporary Git dir used to do the checkout
    if (tmpGit && tmpGit.exists()) tmpGit.delete()
    if (tmpBuild && tmpBuild.exists()) tmpBuild.delete()
    // Create an artifact for the build result
    this.log.sub(buildable.crate).log('built', bold(location.shortPath))
    const artifact = pathToFileURL(location.path)
    const codeHash = this.hashPath(location.path)
    return Object.assign(buildable, { artifact, codeHash })
  }
  protected getEnvAndTemp (buildable: Buildable, workspace?: string, revision?: string) {
    // Temporary dirs used for checkouts of non-HEAD builds
    let tmpGit:   Path|null = null
    let tmpBuild: Path|null = null
    // Most of the parameters are passed to the build script
    // by way of environment variables.
    const env = {
      _BUILD_UID: String(this.buildUid),
      _BUILD_GID: String(this.buildGid),
      _OUTPUT:    $(workspace||process.cwd()).in('wasm').path,
      _REGISTRY:  '',
      _TOOLCHAIN: this.toolchain,
    }
    if ((revision ?? HEAD) !== HEAD) {
      const gitDir = getGitDir(buildable)
      // Provide the build script with the config values that ar
      // needed to make a temporary checkout of another commit
      if (!gitDir?.present) throw new BuildError.NoGitDir({ source: buildable })
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
    return {env, tmpGit, tmpBuild}
  }
  /** Overridable. */
  protected spawn (...args: Parameters<typeof spawn>) {
    return spawn(...args)
  }
  /** Overridable. */
  protected getGitDir (...args: Parameters<typeof getGitDir>) {
    return getGitDir(...args)
  }
  protected runBuild (buildable: Buildable, env: { _OUTPUT: string }): Promise<Path> {
    buildable = this.resolveSource(buildable)
    const { crate, workspace, revision = 'HEAD' } = buildable
    return new Promise((resolve, reject)=>this.spawn(
      this.runtime!, [ this.script!, 'phase1', revision, crate ],
      { cwd: workspace, env: { ...process.env, ...env }, stdio: 'inherit' } as any
    ).on('exit', (code: number, signal: any) => {
      const build = `Build of ${crate} from ${$(workspace!).shortPath} @ ${revision}`
      if (code === 0) {
        resolve($(env._OUTPUT, artifactName(crate, sanitize(revision||'HEAD'))))
      } else if (code !== null) {
        const message = `${build} exited with code ${code}`
        this.log.error(message)
        throw Object.assign(new BuildError(message), { source: buildable, code })
      } else if (signal !== null) {
        const message = `${build} exited by signal ${signal}`
        this.log.warn(message)
      } else {
        throw new BuildError('Unreachable')
      }
    }))
  }
}
// Expose builder implementations via the Builder.variants static property
Object.assign(Builder.variants, {
  'container': BuildContainer,
  'Container': BuildContainer,
  'raw': BuildRaw,
  'Raw': BuildRaw
})
// Try to determine where the .git directory is located
export function getGitDir (template: Partial<Template<any>> = {}): DotGit {
  const { workspace } = template || {}
  if (!workspace) throw new BuildError("No workspace specified; can't find gitDir")
  return new DotGit(workspace)
}
/** Represents the real location of the Git data directory.
  * - In standalone repos this is `.git/`
  * - If the contracts workspace repository is a submodule,
  *   `.git` will be a file containing e.g. "gitdir: ../.git/modules/something" */
export class DotGit extends Path {
  log = new Console('@hackbg/fadroma: DotGit')
  /** Whether a .git is present */
  readonly present: boolean
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
        const gitRel = gitPointer.slice(prefix.length).trim()
        const gitPath = $(this.parent, gitRel).path
        const gitRoot = $(gitPath)
        //this.log.info(bold(this.shortPath), 'is a file, pointing to', bold(gitRoot.shortPath))
        this.path = gitRoot.path
        this.present = true
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
/** Represents a crate containing a contract. */
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
      `[package]`, `name = "${this.name}"`, `version = "0.0.0"`, `edition = "2021"`,
      `authors = []`, `keywords = ["fadroma"]`, `description = ""`, `readme = "README.md"`, ``,
      `[lib]`, `crate-type = ["cdylib", "rlib"]`, ``,
      `[dependencies]`,
      `fadroma = { version = "0.8.7", features = ${JSON.stringify(this.fadromaFeatures)} }`,
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
/** Build console. */
class BuildConsole extends Console {
  one = ({ crate = '(unknown)', revision = 'HEAD' }: Partial<Template<any>>) => this.log(
    'Building', bold(crate), ...(revision === 'HEAD')
      ? ['from working tree']
      : ['from Git reference', bold(revision)])
  many = (inputs: Template<any>[]) =>
    inputs.forEach(buildable=>this.one(buildable))
  found = ({ artifact }: Built) =>
    this.log(`found at ${bold($(artifact!).shortPath)}`)
  workspace = (mounted: Path|string, ref: string = HEAD) => this.log(
    `building from workspace:`, bold(`${$(mounted).shortPath}/`),
    `@`, bold(ref))
  container = (root: string|Path, revision: string, cratesToBuild: string[]) => this.log(
    `started building from ${bold($(root).shortPath)} @ ${bold(revision)}:`,
    cratesToBuild.map(x=>bold(x)).join(', ')
  )
  fetchFailed = (remote: string, e: any) => this.warn(
    `Git fetch from remote ${remote} failed. Build may fail or produce an outdated result.`
  ).warn(e)
}
/** Build error. */
export class BuildError extends BaseError {
  static ScriptNotSet = this.define('ScriptNotSet',
    ()=>'build script not set')
  static NoHistoricalManifest = this.define('NoHistoricalManifest',
    ()=>'the workspace manifest option can only be used when building from working tree')
  static NoGitDir = this.define('NoGitDir',
    (args)=>'could not find .git directory',
    (err, args)=>Object.assign(err, args||{}))
}
