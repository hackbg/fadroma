/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import {
  Config, Console, Error, Compiler, CompiledCode, HEAD, RustSourceCode, bold, assign,
} from '@fadroma/connect'
import type { Container } from '@hackbg/dock'
import { DotGit } from '@hackbg/repo'
import { Engine, Image, Docker, Podman, LineTransformStream } from '@hackbg/dock'
import $, { Path, OpaqueDirectory, TextFile, BinaryFile, TOMLFile } from '@hackbg/file'
import { default as simpleGit } from 'simple-git'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, sep } from 'node:path'
import { homedir } from 'node:os'
import { randomBytes } from 'node:crypto'

import { packageRoot, console } from './config'

export function getCompiler ({
  config = new Config(),
  useContainer = config.getFlag('FADROMA_BUILD_RAW', ()=>false),
  ...options
}: |({ useContainer?: false } & Partial<RawLocalRustCompiler>)
   |({ useContainer:  true  } & Partial<ContainerizedLocalRustCompiler>) = {}
): Compiler { // class dispatch, ever awkward
  if (useContainer) {
    return new ContainerizedLocalRustCompiler({
      config, ...options as Partial<ContainerizedLocalRustCompiler>
    })
  } else {
    return new RawLocalRustCompiler({
      config, ...options as Partial<RawLocalRustCompiler>
    })
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

/** A compiler that can take configuration values from the environment. */
export abstract class ConfiguredCompiler extends Compiler {
  config: Config
  constructor (options?: Partial<{ config: Config }>) {
    super()
    this.config = options?.config || new Config()
  }
}

type SourcePath = string

type SourceRef = string

type CompileBatches = Record<SourcePath, Record<SourceRef, CompileBatch>>

type CompileBatch = {
  sourcePath: string, sourceRef: string, tasks: Set<CompileTask>
}

type CompileTask = CompileCrateTask|CompileWorkspaceTask

type CompileCrateTask = {
  buildIndex: number, cargoToml: string, cargoCrate: string
}

type CompileWorkspaceTask = {
  cargoWorkspace: string, cargoCrates: Array<CompileWorkspaceCrateTask>
}

type CompileWorkspaceCrateTask = {
  buildIndex: number, cargoCrate: string
}

/** Can compile Rust smart contracts.
  * Will only perform a build if a contract is not built yet or FADROMA_REBUILD=1 is set. */
export abstract class LocalRustCompiler extends ConfiguredCompiler {
  readonly id: string = 'local'
  /** Logger. */
  log = new Console('build (local)')
  /** Whether the build process should print more detail to the console. */
  verbose: boolean = this.config.getFlag('FADROMA_BUILD_VERBOSE', ()=>false)
  /** Whether the build log should be printed only on error, or always */
  quiet: boolean = this.config.getFlag('FADROMA_BUILD_QUIET', ()=>false)
  /** The build script. */
  script?: string = this.config.getString('FADROMA_BUILD_SCRIPT', ()=>{
    return $(packageRoot).in('ops').at('build.impl.mjs').path
  })
  /** Whether to skip any `git fetch` calls in the build script. */
  noFetch: boolean = this.config.getFlag('FADROMA_NO_FETCH', ()=>false)
  /** Name of directory where build artifacts are collected. */
  outputDir: OpaqueDirectory = new OpaqueDirectory(
    this.config.getString('FADROMA_ARTIFACTS', ()=>$(process.cwd()).in('wasm').path)
  )
  /** Version of Rust toolchain to use. */
  toolchain: string|null = this.config.getString('FADROMA_RUST', ()=>'')
  /** Default Git reference from which to build sources. */
  revision: string = HEAD
  /** Owner uid that is set on build artifacts. */
  buildUid?: number = (process.getuid ? process.getuid() : undefined) // process.env.FADROMA_BUILD_UID
  /** Owner gid that is set on build artifacts. */
  buildGid?: number = (process.getgid ? process.getgid() : undefined) // process.env.FADROMA_BUILD_GID
  /** Whether to enable caching and reuse contracts from artifacts directory. */
  caching: boolean =
    !this.config.getFlag('FADROMA_REBUILD', ()=>false)

  constructor (options?: Partial<LocalRustCompiler>) {
    super()
    assign(this, options, [
      'noFetch', 'toolchain', 'verbose', 'quiet', 'outputDir', 'script'
    ])
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

  /** Compile a single contract. */
  async build (contract: string|Partial<RustSourceCode>): Promise<CompiledCode> {
    return (await this.buildMany([contract]))[0]
  }

  /** This implementation groups the passed source by workspace and ref,
    * in order to launch one build container per workspace/ref combination
    * and have it build all the crates from that combination in sequence,
    * reusing the container's internal intermediate build cache. */
  async buildMany (
    contracts: (string|(Partial<RustSourceCode>))[],
    // options: { parallel?: boolean } // TODO
  ): Promise<CompiledCode[]> {
    const results: CompiledCode[] = []
    // Group contracts by source root, source ref, and cargo workspace.
    const batches = this.collectBatches(contracts.map(
      x => (typeof x === 'string') ? { sourcePath: x } : x
    ) as Partial<RustSourceCode>[])
    // Run each root/ref pair in a container, executing one or more cargo build commands.
    for (const [root, refs] of Object.entries(batches)) {
      for (const [ref, batch] of Object.entries(refs)) {
        const batchResults = await this.buildBatch(batch)
        for (const [index, result] of Object.entries(batchResults)) {
          if (results[index as unknown as number]) {
            throw new Error(`already built #${index}`)
          }
          results[index as unknown as number] = result
        }
      }
    }
    return results
  }

  protected collectBatches (contracts: Array<Partial<RustSourceCode>>): CompileBatches {
    // Batch by sourcePath, then by sourceRef, then group by workspace
    const batches: CompileBatches = {}
    // Assign each contract to its appropriate branch and group
    for (let buildIndex = 0; buildIndex < contracts.length; buildIndex++) {
      const contract = contracts[buildIndex]
      let {
        cargoToml,
        cargoWorkspace,
        cargoCrate,
        sourcePath = cargoWorkspace
          ? $(cargoWorkspace).parent
          : cargoToml
            ? $(cargoToml).parent
            : undefined,
        sourceRef = 'HEAD',
      } = contract
      if (!sourcePath) {
        throw new Error('Missing source path')
      }
      batches[sourcePath] ??= {}
      batches[sourcePath][sourceRef] ??= { sourcePath, sourceRef, tasks: new Set() }
      if (cargoWorkspace && cargoToml) {
        throw new Error('When cargoWorkspace is set, use cargoCrate (name) instead of cargoToml (path)')
      }
      if (cargoWorkspace) {
        if (!cargoCrate) {
          throw new Error('When cargoWorkspace is set, you must specify cargoCrate')
        }
        let workspaceTask: CompileWorkspaceTask
        for (const task of batches[sourcePath][sourceRef].tasks) {
          if ((task as CompileWorkspaceTask).cargoWorkspace === cargoWorkspace) {
            workspaceTask = task as CompileWorkspaceTask
            break
          }
        }
        workspaceTask ??= { cargoWorkspace, cargoCrates: [] }
        workspaceTask.cargoCrates.push({ buildIndex, cargoCrate })
      } else {
        if (!cargoToml) {
          throw new Error('When cargoWorkspace is not set, you must specify cargoToml')
        }
        const cargoCrate = $(cargoToml)
          .as(TOMLFile<CargoTOML>)
          .load()!
          .package.name
        batches[sourcePath][sourceRef].tasks.add({
          buildIndex, cargoToml, cargoCrate
        } as CompileCrateTask)
      }
    }
    return batches
  }

  /** Check if codePath exists in local artifacts cache directory.
    * If it does, don't rebuild it but return it from there. */
  protected tryGetCached (
    outputDir: string,
    { sourceRef, cargoCrate }: Partial<RustSourceCode>
  ): CompiledCode|null {
    if (this.caching && cargoCrate) {
      const location = $(outputDir, codePathName(cargoCrate, sourceRef||HEAD))
      if (location.exists()) {
        const codePath = location.url
        const codeHash = $(location).as(BinaryFile).sha256
        return new CompiledCode({ codePath, codeHash })
      }
    }
    return null
  }

  protected abstract buildBatch (batch: CompileBatch):
    Promise<Record<number, CompiledCode>>
}

/** Runs the build script in the current envionment. */
export class RawLocalRustCompiler extends LocalRustCompiler {
  /** Logging handle. */
  log = new Console('build (raw)')

  /** Node.js runtime that runs the build subprocess.
    * Defaults to the same one that is running this script. */
  runtime = process.argv[0]

  protected async buildBatch (batch: CompileBatch): Promise<Record<number, CompiledCode>> {
    throw new Error("not implemented")
  }

  /** Compile a Source into a Template */
  async build (source: string|Partial<RustSourceCode>): Promise<CompiledCode> {
    if (typeof source === 'string') {
      source = new RustSourceCode({ sourcePath: source })
    }
    const {
      sourcePath,
      sourceRef = HEAD,
      cargoToml,
      cargoWorkspace,
      cargoCrate,
      cargoFeatures
    } = source
    if (!sourcePath) {
      throw new Error("can't build without at least sourcePath")
    }
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
      const gitDir = $(sourcePath, '.git')
      if (!gitDir.exists()) {
        throw new Error(`could not find ${gitDir.path}`)
      }
      const tmpGit = $.tmpDir('fadroma-git-')
      const tmpCompile = $.tmpDir('fadroma-build-')
      location = await this.runCompile(source, Object.assign(env, {
        FADROMA_GIT_ROOT:   gitDir.path,
        FADROMA_GIT_SUBDIR: gitDir.isSubmodule ? gitDir.submoduleDir : '',
        FADROMA_NO_FETCH:   this.noFetch,
        FADROMA_TMP_BUILD:  tmpCompile.path,
        FADROMA_TMP_GIT:    tmpGit.path,
      }))
      if (tmpGit.exists()) tmpGit.delete()
      if (tmpCompile.exists()) tmpCompile.delete()
    } else {
      // Compile from available source
      location = await this.runCompile(source, env)
    }
    // Create an codePath for the build result
    const codePath = pathToFileURL(location.path)
    const codeHash = $(location).as(BinaryFile).sha256
    return new CompiledCode({ codePath, codeHash })
  }

  protected runCompile (
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
        const build = `Compile of ${cargoCrate} from ${$(sourcePath!).shortPath} @ ${sourceRef}`
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

  /** Overridable for testing. */
  protected spawn (...args: Parameters<typeof spawn>) {
    return spawn(...args)
  }
}

/** Runs the build script in a container. */
export class ContainerizedLocalRustCompiler extends LocalRustCompiler {
  /** Logger */
  log = new Console('compiling in container')
  /** Used to launch build container. */
  docker: Engine
  /** Tag of the docker image for the build container. */
  image: Image
  /** Whether to use Podman instead of Docker to run the build container. */
  podman = this.config.getFlag('FADROMA_BUILD_PODMAN', () => {
    return this.config.getFlag('FADROMA_PODMAN', ()=>false)
  })
  /** Path to Docker API endpoint. */
  dockerSocket: string =
    this.config.getString('FADROMA_DOCKER', ()=>'/var/run/docker.sock')
  /** Docker image to use for dockerized builds. */
  dockerImage: string =
    this.config.getString('FADROMA_BUILD_IMAGE', ()=>'ghcr.io/hackbg/fadroma:master')
  /** Path to the dockerfile for the build container if missing. */
  dockerfile: string =
    this.config.getString('FADROMA_BUILD_DOCKERFILE', ()=>$(packageRoot).at('Dockerfile').path)
  /** Owner uid that is set on build artifacts. */
  outputUid: string|undefined =
    this.config.getString('FADROMA_BUILD_UID', () => undefined)
  /** Owner gid that is set on build artifacts. */
  outputGid: string|undefined =
    this.config.getString('FADROMA_BUILD_GID', () => undefined)

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

  protected async buildBatch (
    batch: CompileBatch, options: { outputDir?: string, buildScript?: string|Path } = {}
  ): Promise<Record<number, CompiledCode>> {
    const slashes  = new RegExp("/", "g")
    const sanitize = (x: string) => x.replace(slashes, "_")
    const dashes   = new RegExp("-", "g")
    const fumigate = (x: string) => x.replace(dashes, "_")
    const { sourcePath, sourceRef, tasks } = batch
    const safeRef  = sanitize(sourceRef)
    const { outputDir = this.outputDir.path, buildScript = this.script } = options
    if (!buildScript) {
      throw new Error('missing build script')
    }
    this.log.log('Building contracts from', bold(sourcePath), '@', bold(sourceRef))
    // Standalone crates get built with:
    // - cargo build --manifest-path /path/to/Cargo.toml --target-dir /path/to/output/dir
    // Workspace crates get built with:
    // - cargo build --manifest-path /path/to/workspace/Cargo.toml -p crate1 crate2 crate3
    // Create stream for collecting build logs
    let buildLogs = ''
    const logs = this.getLogStream(sourceRef, (data) => {buildLogs += data})
    // Create output directory as user if it does not exist
    $(outputDir).as(OpaqueDirectory).make()
    // Run the build container
    const buildContainer = await this.image.run(`fadroma-build-${randomBytes(3).toString('hex')}`, {
      remove: true,
      // Readonly mounts:
      readonly: {
        // - Script that will run in the container
        [$(buildScript).path]: $(`/`, $(buildScript).name).path,
        // - Repo root, containing real .git
        [$(sourcePath).path]:  '/src'
      },
      // Writable mounts:
      writable: {
        // - Output path for final artifacts:
        [outputDir]: `/output`,
        // - Persist cache to make future rebuilds faster. May be unneccessary.
        // [`project_cache_${safeRef}`]: `/tmp/target`,
        [`cargo_cache_${safeRef}`]: `/usr/local/cargo`
      },
      cwd: '/src',
      env: {
        FADROMA_VERBOSE:     String(this.verbose),
        FADROMA_IN_DOCKER:   'true',
        FADROMA_SRC_REF:     sourceRef||'HEAD',
        FADROMA_BUILD_TASKS: JSON.stringify([...tasks]),
        FADROMA_BUILD_UID:   String(this.buildUid),
        FADROMA_BUILD_GID:   String(this.buildGid),
        // Used by tools invoked by the build script:
        LOCKED:                       '',/*'--locked'*/
        CARGO_HTTP_TIMEOUT:           '240',
        CARGO_NET_GIT_FETCH_WITH_CLI: 'true',
        TERM:                         process?.env?.TERM||'',
      },
      extra: {
        Tty: true,
        AttachStdin: true
      }
    }, [
      'node', $(`/`, $(buildScript).name).path, 'phase1',
    ], '/usr/bin/env', logs)
    // If this process is terminated, the build container should be killed
    process.once('beforeExit', async () => {
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
    })
    // Wait for build to, hopefully, complete
    const {error, code} = await buildContainer.wait()
    // Throw error if launching the container failed
    if (error) {
      throw new Error(`cocker error: ${error}`)
    }
    // Throw error if the build failed
    if (code !== 0) {
      this.log.error(logs)
      throw new Error(`compile batch exited with status ${code}`)
    }
    const results: Record<number, CompiledCode> = {}
    const toResult = (buildIndex: number, crateName: string) => [
      buildIndex, $(outputDir, `${sanitize(crateName)}@${sanitize(sourceRef)}.wasm`)
    ]
    for (const task of tasks) {
      if ((task as CompileWorkspaceTask).cargoWorkspace) {
        for (const { buildIndex, cargoCrate } of (task as CompileWorkspaceTask).cargoCrates) {
          results[buildIndex] = new CompiledCode({
            codePath: $(
              outputDir, `${sanitize(cargoCrate)}@${sanitize(sourceRef)}.wasm`
            ).path
          })
        }
      } else if ((task as CompileCrateTask).cargoCrate) {
          results[(task as CompileCrateTask).buildIndex] = new CompiledCode({
            codePath: $(
              outputDir, `${sanitize((task as CompileCrateTask).cargoCrate)}@${sanitize(sourceRef)}.wasm`
            ).path
          })
      } else {
        throw new Error("invalid task in compile batch")
      }
    }
    return results
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

}
