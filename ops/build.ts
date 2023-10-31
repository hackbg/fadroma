/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import {
  Config, Console, Error,
  Compiler, CompiledCode, ContractInstance, HEAD, SourceCode,
  bold, colors,
} from '@fadroma/connect'
import type { Class, UploadedCode, Environment } from '@fadroma/connect'

import type { Project } from './project'

import type { Container } from '@hackbg/dock'
import { Engine, Image, Docker, Podman, LineTransformStream } from '@hackbg/dock'
import { hideProperties } from '@hackbg/hide'
import $, { Path, OpaqueDirectory, TextFile, BinaryFile, TOMLFile, OpaqueFile } from '@hackbg/file'

import { default as simpleGit } from 'simple-git'

import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, sep } from 'node:path'
import { homedir } from 'node:os'
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

/** Path to this package. Used to find the build script, dockerfile, etc.
  * WARNING: Keep the ts-ignore otherwise it might break at publishing the package. */
const thisPackage =
  //@ts-ignore
  dirname(dirname(fileURLToPath(import.meta.url)))

/** @returns Compiler configured as per environment and options */
export function getCompiler (options: Partial<BuildConfig> = {}): Compiler {
  return new BuildConfig(options).getCompiler()
}

/** Configuration for compiler. */
export class BuildConfig extends Config {
  constructor (options: Partial<BuildConfig> = {}, environment?: Environment) {
    super(environment)
    this.override(options)
  }
  /** Workspace root for project crates. This is the directory that contains the root `Cargo.toml`.
    * Defaults to parent directory of FADROMA_PROJECT. */
  workspace = this.getString('FADROMA_WORKSPACE', ()=>this.root)
  /** Whether the build process should print more detail to the console. */
  verbose = this.getFlag('FADROMA_BUILD_VERBOSE', ()=>false)
  /** Whether the build log should be printed only on error, or always */
  quiet = this.getFlag('FADROMA_BUILD_QUIET', ()=>false)
  /** Whether to enable caching and reuse contracts from artifacts directory. */
  caching = !this.getFlag('FADROMA_REBUILD', ()=>false)
  /** Name of output directory. */
  outputDir = this.getString('FADROMA_ARTIFACTS', ()=>$(this.root).in('wasm').path)
  /** Script that runs inside the build container, e.g. build.impl.mjs */
  script = this.getString('FADROMA_BUILD_SCRIPT', ()=>$(thisPackage).at('build.impl.mjs').path)
  /** Which version of the Rust toolchain to use, e.g. `1.61.0` */
  toolchain = this.getString('FADROMA_RUST', ()=>'')
  /** Don't run "git fetch" during build. */
  noFetch = this.getFlag('FADROMA_NO_FETCH', ()=>false)
  /** Whether to bypass Docker and use the toolchain from the environment. */
  raw = this.getFlag('FADROMA_BUILD_RAW', ()=>false)
  /** Whether to use Podman instead of Docker to run the build container. */
  podman = this.getFlag('FADROMA_BUILD_PODMAN', () => this.getFlag('FADROMA_PODMAN', ()=>false))
  /** Path to Docker API endpoint. */
  dockerSocket = this.getString('FADROMA_DOCKER', ()=>'/var/run/docker.sock')
  /** Docker image to use for dockerized builds. */
  dockerImage = this.getString('FADROMA_BUILD_IMAGE', ()=>'ghcr.io/hackbg/fadroma:master')
  /** Dockerfile to build the build image if not downloadable. */
  dockerfile = this.getString('FADROMA_BUILD_DOCKERFILE', ()=>$(thisPackage).at('Dockerfile').path)
  /** Owner uid that is set on build artifacts. */
  outputUid = this.getString('FADROMA_BUILD_UID', () => undefined)
  /** Owner gid that is set on build artifacts. */
  outputGid = this.getString('FADROMA_BUILD_GID', () => undefined)
  /** Used for historical builds. */
  preferredRemote = this.getString('FADROMA_PREFERRED_REMOTE', () => undefined)
  /** Used to authenticate Git in build container. */
  sshAuthSocket = this.getString('SSH_AUTH_SOCK', () => undefined)
  /** @returns the Compiler class exposed by the config */
  get Compiler () {
    return this.raw ? RawLocalRustCompiler : ContainerizedLocalRustCompiler
  }
  /** @returns a configured compiler. */
  getCompiler = (Compiler?: Class<Compiler, any>): Compiler =>new (Compiler ??= this.Compiler)(this)
}

export { Compiler }

/** Can perform builds.
  * Will only perform a build if a contract is not built yet or FADROMA_REBUILD=1 is set. */
export abstract class LocalRustCompiler extends Compiler {
  readonly id: string = 'local'
  /** Logger. */
  log = new Console('build (local)')
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

  constructor (options: Partial<BuildConfig> = {}) {
    super()
    this.workspace = options.workspace ?? this.workspace
    this.noFetch   = options.noFetch   ?? this.noFetch
    this.toolchain = options.toolchain ?? this.toolchain
    this.verbose   = options.verbose   ?? this.verbose
    this.quiet     = options.quiet     ?? this.quiet
    this.outputDir = $(options.outputDir!).as(OpaqueDirectory)
    if (options.script) this.script = options.script
  }

  /** @returns the SHA256 hash of the file at the specified location */
  protected hashPath (location: string|Path) {
    return $(location).as(BinaryFile).sha256
  }

  /** @returns a fully populated Partial<SourceCode> from the original */
  protected resolveSource (source: string|Partial<SourceCode>): Partial<SourceCode> {
    if (typeof source === 'string') source = { crate: source }
    let { crate, workspace = this.workspace, revision = 'HEAD' } = source
    if (!crate) throw new Error.Missing.Crate()
    // If the `crate` field contains a slash, this is a crate path and not a crate name.
    // Add the crate path to the workspace path, and set the real crate name.
    if (source.crate && source.crate.includes(sep)) {
      source.workspace = $(source.workspace||'', source.crate).shortPath
      const cargoTOML = $(source.workspace, 'Cargo.toml').as(TOMLFile<CargoTOML>).load()
      source.crate = cargoTOML.package.name
    }
    return source
  }
}

/** The parts of Cargo.toml which the compiler needs to be aware of. */
export type CargoTOML = {
  package: { name: string },
  dependencies: Record<string, { path?: string }>
}

/** @returns an codePath filename name in the format CRATE@REF.wasm */
export const codePathName = (crate: string, ref: string) =>
  `${crate}@${sanitize(ref)}.wasm`

/** @returns a filename-friendly version of a Git ref */
export const sanitize = (ref: string) =>
  ref.replace(/\//g, '_')

/** @returns an array with duplicate elements removed */
export const distinct = <T> (x: T[]): T[] =>
  [...new Set(x) as any]

/** This compiler launches a one-off build container using Dockerode. */
export class ContainerizedLocalRustCompiler extends LocalRustCompiler {
  readonly id = 'Container'
  /** Logger */
  log = new Console('build (container)')
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

  constructor (opts: Partial<BuildConfig & { docker?: Engine }> = {}) {
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
  async build (contract: string|Partial<SourceCode>): Promise<CompiledCode> {
    return (await this.buildMany([contract]))[0]
  }

  /** This implementation groups the passed source by workspace and ref,
    * in order to launch one build container per workspace/ref combination
    * and have it build all the crates from that combination in sequence,
    * reusing the container's internal intermediate build cache. */
  async buildMany (inputs: (string|(Partial<SourceCode>))[]): Promise<CompiledCode[]> {
    // This copies the argument because we'll mutate its contents anyway
    inputs = inputs.map(source=>this.resolveSource(source))
    // Batch together inputs from the same repo+commit
    const [workspaces, revisions] = this.collectBatches(inputs as Partial<SourceCode>[])
    // For each repository/revision pair, build the inputs from it.
    for (const path of workspaces) {
      for (const revision of revisions) {
        await this.buildBatch(inputs as Partial<SourceCode>[], path, revision)
      }
    }
    return inputs as CompiledCode[]
  }

  /** Go over the list of inputs, filtering out the ones that are already built,
    * and collecting the source repositories and revisions. This will allow for
    * multiple crates from the same source checkout to be passed to a single build command. */
  protected collectBatches (inputs: Partial<SourceCode>[]) {
    const workspaces = new Set<string>()
    const revisions  = new Set<string>()
    for (let id in inputs) {
      // Contracts passed as strins are converted to object here
      const source = inputs[id]
      source.workspace ??= this.workspace
      source.revision  ??= 'HEAD'
      // If the source is already built, don't build it again
      if (!this.populatePrebuilt(source)) {
        if (!source.revision || (source.revision === HEAD)) {
          this.log(`Building ${bold(source.crate)} from working tree`)
        } else {
          this.log(`Building ${bold(source.crate)} from revision ${bold(source.revision)}`)
        }
        // Set ourselves as the source's compiler
        source.compiler = this as unknown as Compiler
        // Add the source repository of the contract to the list of inputs to build
        workspaces.add(source.workspace!)
        revisions.add(source.revision!)
      }
    }
    return [workspaces, revisions]
  }

  protected populatePrebuilt (source: Partial<CompiledCode>): boolean {
    const { workspace, revision, crate } = source
    const prebuilt = this.prebuild(this.outputDir.path, crate, revision)
    if (prebuilt) {
      new Console(`build ${crate}`).found(prebuilt)
      source.codePath = prebuilt.codePath
      source.codeHash = prebuilt.codeHash
      return true
    }
    return false
  }

  protected async buildBatch (inputs: Partial<SourceCode>[], path: string, rev: string = HEAD) {
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
        this.log
          .warn(`Git fetch from remote ${remote} failed.`)
          .warn(`The build may fail or produce an outdated result.`)
          .warn(e)
      }
    }

    // If inputs contain path dependencies pointing to parent dirs
    // (e.g. fadroma/examples/foo pointing to ../../), make sure
    // those are mounted into the container.
    for (const input of inputs) {
      for (const path of this.getPathDependencies(input)) {
        paths.add(path)
      }
    }

    ;([root, srcSubDir] = this.getSrcSubDir(paths, root))

    this.log.debug(`building from workspace:`, bold(`${$(root.path).shortPath}/`), `@`, bold(rev))
    const matched = this.matchBatch(inputs, path, rev)
    const results = await this.runContainer(root.path, root.relative(path), rev, matched, gitSubDir)

    // Using the previously collected indices, populate the values in each of the passed inputs.
    for (const index in results) {
      if (!results[index]) continue
      const input = inputs[index] as Partial<CompiledCode>
      input.codePath = results[index]!.codePath
      input.codeHash = results[index]!.codeHash
    }
  }

  protected getPathDependencies (input: Partial<SourceCode>): Set<string> {
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
  protected matchBatch (inputs: Partial<SourceCode>[], path: string, rev: string): [number, string][] {
    const crates: [number, string][] = []
    for (let index = 0; index < inputs.length; index++) {
      const source = inputs[index]
      const { crate, workspace, revision = 'HEAD' } = source
      if (workspace === path && revision === rev) crates.push([index, crate!])
    }
    return crates
  }

  /** Build the crates from each same workspace/revision pair and collect the results. */
  protected async runContainer (
    root: string, subdir: string, rev: string,
    crates: [number, string][], gitSubDir: string = '', outputDir: string = this.outputDir.path
  ): Promise<(CompiledCode|null)[]> {
    if (!this.script) throw new Error('missing build script')
    // Default to building from working tree.
    rev ??= HEAD
    // Collect crates to build
    const [templates, shouldBuild] = this.collectCrates(outputDir, rev, crates)
    // If there are no templates to build, this means everything was cached and we're done.
    if (Object.keys(shouldBuild).length === 0) return templates as CompiledCode[]
    // Define the mounts and environment variables of the build container
    const safeRef = sanitize(rev)
    // Pre-populate the list of expected artifacts.
    const outputs = new Array<string|null>(crates.length).fill(null)
    for (const [crate, index] of Object.entries(shouldBuild))
      outputs[index] = $(outputDir, codePathName(crate, safeRef)).path
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
    this.log(
      `started building from ${bold($(root).shortPath)} @ ${bold(rev)}:`,
      cratesToBuild.map(x=>bold(x)).join(', ')
    )
    const name = `fadroma-build-${randomBytes(3).toString('hex')}`
    const buildContainer = await this.image.run(name, options, command, '/usr/bin/env', logs)
    // If this process is terminated, the build container should be killed
    process.once('beforeExit', () => this.killContainerizedLocalRustCompiler(buildContainer))
    const {error, code} = await buildContainer.wait()
    // Throw error if launching the container failed
    if (error) throw new Error(`[@hackbg/fadroma] Docker error: ${error}`)
    // Throw error if the build failed
    if (code !== 0) this.buildFailed(cratesToBuild, code, buildLogs)
    // Return a sparse array of the resulting artifacts
    return outputs.map(x=>this.locationToContract(x) as CompiledCode)
  }

  protected getMounts (buildScript: string, root: string, outputDir: string, safeRef: string) {
    throw new Error('missing build script')
    const readonly: Record<string, string> = {}
    const writable: Record<string, string> = {}
    // Script that will run in the container
    readonly[this.script!]  = buildScript 
    // Repo root, containing real .git
    readonly[$(root).path] = '/src'
    // For non-interactively fetching submodules over SSH, we need to propagate known_hosts:
    const userKnownHosts = $(homedir()).in('.ssh').at('known_hosts')
    if (userKnownHosts.isFile()) readonly[userKnownHosts.path] = '/root/.ssh/known_hosts'
    const globalKnownHosts = $(`/etc`).in('ssh').at('ssh_known_hosts')
    if (globalKnownHosts.isFile()) readonly[globalKnownHosts.path] = '/etc/ssh/ssh_known_hosts'
    // For fetching from private repos, we need to give the container access to ssh-agent:
    if (this.sshAuthSocket) readonly[this.sshAuthSocket!] = '/ssh_agent_socket'
    // Output path for final artifacts:
    writable[outputDir] = `/output`
    // Persist cache to make future rebuilds faster. May be unneccessary.
    //[`project_cache_${safeRef}`]: `/tmp/target`,
    writable[`cargo_cache_${safeRef}`] = `/usr/local/cargo`
    return { readonly, writable }
  }

  protected collectCrates (outputDir: string, revision: string, crates: [number, string][]) {
    // Output slots. Indices should correspond to those of the input to buildMany
    const templates: Array<CompiledCode|null> = crates.map(()=>null)
    // Whether any crates should be built, and at what indices they are in the input and output.
    const shouldBuild: Record<string, number> = {}
    // Collect cached templates. If any are missing from the cache mark them as source.
    for (const [index, crate] of crates) {
      const prebuilt = this.prebuild(outputDir, crate, revision)
      if (prebuilt) {
        //const location = $(prebuilt.codePath!).shortPath
        //console.info('Exists, not rebuilding:', bold($(location).shortPath))
        templates[index] = prebuilt
      } else {
        shouldBuild[crate] = index
      }
    }
    return [ templates, shouldBuild ]
  }

  /** Check if codePath exists in local artifacts cache directory.
    * If it does, don't rebuild it but return it from there. */
  protected prebuild (outputDir: string, crate?: string, revision: string = HEAD): CompiledCode|null {
    if (this.caching && crate) {
      const location = $(outputDir, codePathName(crate, revision))
      if (location.exists()) {
        return new CompiledCode({
          crate,
          revision,
          codePath: location.url,
          codeHash: this.hashPath(location)
        })
      }
    }
    return null
  }

  protected getOptions (
    subdir: string, gitSubdir: string, ro: Record<string, string>, rw: Record<string, string>,
  ) {
    const remove = true
    const cwd = '/src'
    const env = this.getEnv(subdir, gitSubdir)
    const extra = { Tty: true, AttachStdin: true }
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
    throw new Error(`[@hackbg/fadroma] Build of crates: "${crateList}" exited with status ${code}`)
  }

  protected locationToContract (location: any) {
    if (location === null) return null
    const codePath = $(location).url
    const codeHash = this.hashPath(location)
    return new CompiledCode({
      codePath,
      codeHash
    })
  }

  protected async killContainerizedLocalRustCompiler (buildContainer: Container) {
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
export class RawLocalRustCompiler extends LocalRustCompiler {
  readonly id = 'Raw'

  /** Logging handle. */
  log = new Console('build (raw)')

  /** Node.js runtime that runs the build subprocess.
    * Defaults to the same one that is running this script. */
  runtime = process.argv[0]

  /** Build multiple Sources. */
  async buildMany (inputs: Partial<SourceCode>[]): Promise<CompiledCode[]> {
    const templates: CompiledCode[] = []
    for (const source of inputs) templates.push(await this.build(source))
    return templates
  }

  /** Build a Source into a Template */
  async build (source: Partial<SourceCode>): Promise<CompiledCode> {
    source.workspace ??= this.workspace
    source.revision  ??= HEAD
    const { workspace, revision, crate } = source
    if (!crate && !workspace) throw new Error.Missing.Crate()
    const { env, tmpGit, tmpBuild } = this.getEnvAndTemp(source, workspace, revision)
    // Run the build script as a subprocess
    const location = await this.runBuild(source, env)
    // If this was a non-HEAD build, remove the temporary Git dir used to do the checkout
    if (tmpGit && tmpGit.exists()) tmpGit.delete()
    if (tmpBuild && tmpBuild.exists()) tmpBuild.delete()
    // Create an codePath for the build result
    this.log.sub((crate||workspace)!).log('built', bold(location.shortPath))
    const codePath = pathToFileURL(location.path)
    const codeHash = this.hashPath(location.path)
    return new CompiledCode({ codePath, codeHash })
  }

  protected getEnvAndTemp (source: Partial<SourceCode>, workspace?: string, revision?: string) {
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
      const gitDir = getGitDir(source)
      // Provide the build script with the config values that ar
      // needed to make a temporary checkout of another commit
      if (!gitDir?.present) {
        throw new Error('.git dir not found')
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

  protected runBuild (source: Partial<SourceCode>, env: { _OUTPUT: string }): Promise<Path> {
    source = this.resolveSource(source)
    const { crate, workspace, revision = 'HEAD' } = source
    if (!crate) {
      throw new Error("can't build: no crate specified")
    }
    return new Promise((resolve, reject)=>this.spawn(
      this.runtime!, [ this.script!, 'phase1', revision, crate ],
      { cwd: workspace, env: { ...process.env, ...env }, stdio: 'inherit' } as any
    ).on('exit', (code: number, signal: any) => {
      const build = `Build of ${crate} from ${$(workspace!).shortPath} @ ${revision}`
      if (code === 0) {
        resolve($(env._OUTPUT, codePathName(crate, sanitize(revision||'HEAD'))))
      } else if (code !== null) {
        const message = `${build} exited with code ${code}`
        this.log.error(message)
        throw Object.assign(new Error(message), { source: source, code })
      } else if (signal !== null) {
        const message = `${build} exited by signal ${signal}`
        this.log.warn(message)
      } else {
        throw new Error('Unreachable')
      }
    }))
  }
}

// Try to determine where the .git directory is located
export function getGitDir (template: Partial<SourceCode> = {}): DotGit {
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
