/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import {
  Config, Console, Error, Compiler, CompiledCode, HEAD, RustSourceCode, bold, assign,
} from '@fadroma/connect'
import type { Container } from '@hackbg/dock'
import { Engine, Image, Docker, Podman, LineTransformStream } from '@hackbg/dock'
import $, { Path, OpaqueDirectory, TextFile, BinaryFile, TOMLFile } from '@hackbg/file'
import { default as simpleGit } from 'simple-git'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, sep } from 'node:path'
import { homedir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { thisPackage } from './config'

export function getCompiler ({
  config = new Config(), useContainer = config.getFlag('FADROMA_BUILD_RAW', ()=>false),
  ...options
}: |({ useContainer?: false } & Partial<RawLocalRustCompiler>)
   |({ useContainer:  true  } & Partial<ContainerizedLocalRustCompiler>) = {}
) {
  if (useContainer) {
    return new ContainerizedLocalRustCompiler({ config, ...options })
  } else {
    return new RawLocalRustCompiler({ config, ...options })
  }
}

export { Compiler }

export abstract class ConfiguredCompiler extends Compiler {
  config: Config
  constructor (options?: Partial<{ config: Config }>) {
    super()
    this.config = options?.config || new Config()
  }
}

/** Can perform builds.
  * Will only perform a build if a contract is not built yet or FADROMA_REBUILD=1 is set. */
export abstract class LocalRustCompiler extends ConfiguredCompiler {
  readonly id: string = 'local'
  /** Logger. */
  log = new Console('build (local)')
  /** Whether the build process should print more detail to the console. */
  verbose: boolean =
    this.config.getFlag('FADROMA_BUILD_VERBOSE', ()=>false)
  /** Whether the build log should be printed only on error, or always */
  quiet: boolean =
    this.config.getFlag('FADROMA_BUILD_QUIET', ()=>false)
  /** The build script. */
  script?: string =
    this.config.getString('FADROMA_BUILD_SCRIPT', ()=>{
      return $(thisPackage).in('ops').at('build.impl.mjs').path
    })
  /** Workspace root for project crates. This is the directory that contains the root `Cargo.toml`.
    * Defaults to parent directory of FADROMA_PROJECT. */
  workspace?: string =
    this.config.getString('FADROMA_WORKSPACE', ()=>process.cwd())
  /** Whether to skip any `git fetch` calls in the build script. */
  noFetch: boolean =
    this.config.getFlag('FADROMA_NO_FETCH', ()=>false)
  /** Name of directory where build artifacts are collected. */
  outputDir: OpaqueDirectory = new OpaqueDirectory(
    this.config.getString('FADROMA_ARTIFACTS', ()=>$(process.cwd()).in('wasm').path)
  )
  /** Version of Rust toolchain to use. */
  toolchain: string|null =
    this.config.getString('FADROMA_RUST', ()=>'')
  /** Default Git reference from which to build sources. */
  revision: string =
    HEAD
  /** Owner uid that is set on build artifacts. */
  buildUid?: number =
    (process.getuid ? process.getuid() : undefined) // process.env.FADROMA_BUILD_UID
  /** Owner gid that is set on build artifacts. */
  buildGid?: number =
    (process.getgid ? process.getgid() : undefined) // process.env.FADROMA_BUILD_GID
  /** Whether to enable caching and reuse contracts from artifacts directory. */
  caching: boolean =
    !this.config.getFlag('FADROMA_REBUILD', ()=>false)

  constructor (options?: Partial<LocalRustCompiler>) {
    super()
    assign(this, options, [
      'workspace', 'noFetch', 'toolchain', 'verbose', 'quiet', 'outputDir', 'script'
    ])
  }

  /** @returns the SHA256 hash of the file at the specified location */
  protected hashPath (location: string|Path) {
    return $(location).as(BinaryFile).sha256
  }

  /** @returns a fully populated RustSourceCode from the original. */
  protected resolveSource (source: string|Partial<RustSourceCode>): Partial<RustSourceCode> {
    if (typeof source === 'string') {
      source = { cargoCrate: source }
    }
    if (source.cargoWorkspace && !source.cargoCrate) {
      throw new Error("missing crate name")
    }
    return source
  }
}

/** Runs the build script in the current envionment. */
export class RawLocalRustCompiler extends LocalRustCompiler {
  readonly id = 'Raw'

  /** Logging handle. */
  log = new Console('build (raw)')

  /** Node.js runtime that runs the build subprocess.
    * Defaults to the same one that is running this script. */
  runtime = process.argv[0]

  /** Build a Source into a Template */
  async build (source: string|Partial<RustSourceCode>): Promise<CompiledCode> {
    if (typeof source === 'string') {
      source = new RustSourceCode({ sourcePath: source })
    }
    const { sourcePath, sourceRef = HEAD, cargoWorkspace, cargoCrate } = source
    const env = {
      FADROMA_BUILD_GID: String(this.buildGid),
      FADROMA_BUILD_UID: String(this.buildUid),
      FADROMA_OUTPUT:    $(process.env.FADROMA_OUTPUT||process.cwd()).in('wasm').path, // FIXME
      FADROMA_REGISTRY:  '',
      FADROMA_TOOLCHAIN: this.toolchain,
    }
    let location: Path
    if (sourceRef && (sourceRef !== HEAD)) {
      // Check out commit in temp directory
      const gitDir = new DotGit(sourcePath!)
      if (!gitDir?.present) {
        throw new Error('.git dir not found')
      }
      const tmpGit = $.tmpDir('fadroma-git-')
      const tmpBuild = $.tmpDir('fadroma-build-')
      location = await this.runBuild(source, Object.assign(env, {
        FADROMA_GIT_ROOT:   gitDir.path,
        FADROMA_GIT_SUBDIR: gitDir.isSubmodule ? gitDir.submoduleDir : '',
        FADROMA_NO_FETCH:   this.noFetch,
        FADROMA_TMP_BUILD:  tmpBuild.path,
        FADROMA_TMP_GIT:    tmpGit.path,
      }))
      if (tmpGit.exists()) tmpGit.delete()
      if (tmpBuild.exists()) tmpBuild.delete()
    } else {
      // Build from available source
      location = await this.runBuild(source, env)
    }
    // Create an codePath for the build result
    const codePath = pathToFileURL(location.path)
    const codeHash = this.hashPath(location.path)
    return new CompiledCode({ codePath, codeHash })
  }

  protected runBuild (
    source: Partial<RustSourceCode>, env: { FADROMA_OUTPUT: string }
  ): Promise<Path> {
    source = this.resolveSource(source)
    const { sourcePath, sourceRef = HEAD, cargoWorkspace, } = source
    let { cargoCrate } = source
    if (!sourcePath) {
      throw new Error("can't build: no source path specified")
    }
    if (!cargoCrate) {
      if (cargoWorkspace) {
        throw new Error("can't build: no crate selected from workspace")
      } else {
        cargoCrate = $(sourcePath).at('Cargo.toml').as(TOMLFile<CargoTOML>).load()!.package.name
      }
    }
    return new Promise((resolve)=>{
      const args = [ this.script!, 'phase1', sourceRef ]
      if (cargoCrate) {
        args.push(cargoCrate)
      }
      const spawned = this.spawn(this.runtime!, args, {
        cwd: sourcePath, env: { ...process.env, ...env }, stdio: 'inherit'
      })
      spawned.on('exit', (code: number, signal: any) => {
        const build = `Build of ${cargoCrate} from ${$(sourcePath!).shortPath} @ ${sourceRef}`
        if (code === 0) {
          resolve($(env.FADROMA_OUTPUT, codePathName(cargoCrate!, sanitize(sourceRef||'HEAD'))))
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
      })
    })
  }

  /** Overridable. */
  protected spawn (...args: Parameters<typeof spawn>) {
    return spawn(...args)
  }

  /** Overridable. */
  protected getGitDir (...args: ConstructorParameters<typeof DotGit>): DotGit {
    return new DotGit(...args)
  }
}


/** Runs the build script in a container. */
export class ContainerizedLocalRustCompiler extends LocalRustCompiler {
  readonly id = 'Container'
  /** Logger */
  log = new Console('build (container)')
  /** Used to launch build container. */
  docker: Engine
  /** Tag of the docker image for the build container. */
  image: Image
  /** Whether to use Podman instead of Docker to run the build container. */
  podman = this.config.getFlag('FADROMA_BUILD_PODMAN', () => {
    return this.config.getFlag('FADROMA_PODMAN', ()=>false)
  })
  /** Path to Docker API endpoint. */
  dockerSocket = this.config.getString('FADROMA_DOCKER', ()=>'/var/run/docker.sock')
  /** Docker image to use for dockerized builds. */
  dockerImage = this.config.getString('FADROMA_BUILD_IMAGE', ()=>'ghcr.io/hackbg/fadroma:master')
  /** Path to the dockerfile for the build container if missing. */
  dockerfile = this.config.getString('FADROMA_BUILD_DOCKERFILE', ()=>$(thisPackage).at('Dockerfile').path)
  /** Owner uid that is set on build artifacts. */
  outputUid = this.config.getString('FADROMA_BUILD_UID', () => undefined)
  /** Owner gid that is set on build artifacts. */
  outputGid = this.config.getString('FADROMA_BUILD_GID', () => undefined)
  /** Used for historical builds. */
  preferredRemote = this.config.getString('FADROMA_PREFERRED_REMOTE', () => 'origin')
  /** Used to authenticate Git in build container. */
  sshAuthSocket = this.config.getString('SSH_AUTH_SOCK', () => undefined)

  constructor (options?: Partial<ContainerizedLocalRustCompiler>) {
    super(options as Partial<LocalRustCompiler>)
    // Set up Docker API handle
    const Containers = options?.podman ? Podman : Docker
    if (options?.dockerSocket) {
      this.docker = new Containers.Engine(options.dockerSocket)
    } else if (options?.docker) {
      this.docker = options.docker
    } else {
      this.docker = new Containers.Engine()
    }
    if ((options?.dockerImage as unknown) instanceof Containers.Image) {
      this.image = options?.dockerImage as unknown as Image
    } else if (options?.dockerImage) {
      this.image = this.docker.image(options.dockerImage)
    } else {
      this.image = this.docker.image('ghcr.io/hackbg/fadroma:master')
    }
    // Set up Docker image
    this.dockerfile ??= options?.dockerfile!
    this.script ??= options?.script!
  }

  get [Symbol.toStringTag]() {
    return `${this.image?.name??'-'} -> ${this.outputDir?.shortPath??'-'}`
  }

  /** Build a single contract. */
  async build (contract: string|Partial<RustSourceCode>): Promise<CompiledCode> {
    return (await this.buildMany([contract]))[0]
  }

  /** This implementation groups the passed source by workspace and ref,
    * in order to launch one build container per workspace/ref combination
    * and have it build all the crates from that combination in sequence,
    * reusing the container's internal intermediate build cache. */
  async buildMany (inputs: (string|(Partial<RustSourceCode>))[]): Promise<CompiledCode[]> {
    // This copies the argument because we'll mutate its contents anyway
    inputs = inputs.map(source=>this.resolveSource(source))
    // Batch together inputs from the same repo+commit
    const [workspaces, revisions] = this.collectBatches(inputs as Partial<RustSourceCode>[])
    // For each repository/revision pair, build the inputs from it.
    for (const path of workspaces) {
      for (const revision of revisions) {
        await this.buildBatch(inputs as Partial<RustSourceCode>[], path, revision)
      }
    }
    return inputs as CompiledCode[]
  }

  /** Go over the list of inputs, filtering out the ones that are already built,
    * and collecting the source repositories and revisions. This will allow for
    * multiple crates from the same source checkout to be passed to a single build command. */
  protected collectBatches (inputs: Partial<RustSourceCode>[]) {
    const workspaces = new Set<string>()
    const revisions  = new Set<string>()
    for (let id in inputs) {
      // Contracts passed as strins are converted to object here
      const source = inputs[id]
      source.cargoWorkspace ??= this.workspace
      source.sourceRef ??= 'HEAD'
      // If the source is already built, don't build it again
      if (!this.getCached(this.outputDir.path, source)) {
        if (!source.sourceRef || (source.sourceRef === HEAD)) {
          this.log(`Building ${bold(source.cargoCrate)} from working tree`)
        } else {
          this.log(`Building ${bold(source.cargoCrate)} from revision ${bold(source.sourceRef)}`)
        }
        // Add the source repository of the contract to the list of inputs to build
        workspaces.add(source.cargoWorkspace!)
        revisions.add(source.sourceRef!)
      }
    }
    return [workspaces, revisions]
  }

  protected async buildBatch (inputs: Partial<RustSourceCode>[], path: string, rev: string = HEAD) {
    this.log.log('Building from', path, '@', rev)
    let root = $(path)
    let gitSubDir = ''
    let srcSubDir = ''
    const paths = new Set([ root.path ])

    // If building from history, make sure that full source is mounted, and fetch history
    if (rev !== HEAD) {
      const gitDir = new DotGit(path)
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

  protected getPathDependencies (input: Partial<RustSourceCode>): Set<string> {
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
  protected matchBatch (inputs: Partial<RustSourceCode>[], path: string, rev: string): [number, string][] {
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
      const prebuilt = this.getCached(outputDir, crate, revision)
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
  protected getCached (outputDir: string, { sourceRef, cargoCrate }: Partial<RustSourceCode>): CompiledCode|null {
    if (this.caching && cargoCrate) {
      const location = $(outputDir, codePathName(cargoCrate, sourceRef||HEAD))
      if (location.exists()) {
        const codePath = location.url
        const codeHash = this.hashPath(location)
        return new CompiledCode({ codePath, codeHash })
      }
    }
    return null
  }

  protected getOptions (options?: Partial<{
    subdir: string, gitSubdir: string, ro: Record<string, string>, rw: Record<string, string>,
  }>) {
    const remove = true
    const cwd = '/src'
    const env = {
      // Used by the build script itself:
      FADROMA_BUILD_UID:  String(this.buildUid),
      FADROMA_BUILD_GID:  String(this.buildGid),
      FADROMA_GIT_REMOTE: this.preferredRemote,
      FADROMA_GIT_SUBDIR: options?.gitSubdir,
      FADROMA_SRC_SUBDIR: options?.subdir,
      FADROMA_NO_FETCH:   String(this.noFetch),
      FADROMA_VERBOSE:    String(this.verbose),
      // Used by tools invoked by the build script:
      LOCKED:                       '',/*'--locked'*/
      CARGO_HTTP_TIMEOUT:           '240',
      CARGO_NET_GIT_FETCH_WITH_CLI: 'true',
      GIT_PAGER:                    'cat',
      GIT_TERMINAL_PROMPT:          '0',
      SSH_AUTH_SOCK:                '/ssh_agent_socket',
      TERM:                         process?.env?.TERM,
    }
    // Remove keys whose value is `undefined` from `buildEnv`
    for (const key of Object.keys(env)) {
      if (env[key as keyof typeof env] === undefined) {
        delete env[key as keyof typeof env]
      }
    }
    const extra = { Tty: true, AttachStdin: true }
    return {
      remove, readonly: options?.ro, writable: options?.rw, cwd, env, extra
    }
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
    if (!base) {
      throw new Error(
        'you need to pass a base directory in order to '+
        'compute the path of the corresponding.git datastore'
      )
    }
    if (base instanceof URL) {
      base = fileURLToPath(base)
    }
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
