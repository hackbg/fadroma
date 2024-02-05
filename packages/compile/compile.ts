/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Core, Program } from '@fadroma/agent'
import * as OCI from '@fadroma/oci'

import { Config } from '@hackbg/conf'
import { DotGit } from '@hackbg/repo'
import { Path, SyncFS, FileFormat } from '@hackbg/file'

import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, sep } from 'node:path'
import { homedir } from 'node:os'
import { randomBytes } from 'node:crypto'

import { packageRoot, console } from './package'

const { bold } = Core

export const Compiler = Program.Compiler

export function getCompiler ({
  config = new Config(),
  useContainer = !config.getFlag('FADROMA_BUILD_RAW', ()=>false),
  ...options
}: |({ useContainer?: false } & Partial<RawLocalRustCompiler>)
   |({ useContainer:  true  } & Partial<ContainerizedLocalRustCompiler>) = {}
): Program.Compiler { // class dispatch, ever awkward
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

const slashes = new RegExp("/", "g")

/** @returns a filename-friendly version of a Git ref */
export const sanitize = (ref: string) =>
  ref.replace(slashes, '_')

const dashes = new RegExp("-", "g")

/** @returns an unambiguous crate name (dashes to underscores) */
const fumigate = (x: string) =>
  x.replace(dashes, "_")

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
  /** Whether the build process should print more detail to the console. */
  verbose: boolean = this.config.getFlag('FADROMA_BUILD_VERBOSE', ()=>false)
  /** Whether the build log should be printed only on error, or always */
  quiet: boolean = this.config.getFlag('FADROMA_BUILD_QUIET', ()=>false)
  /** The build script. */
  script?: string = this.config.getString('FADROMA_BUILD_SCRIPT', ()=>{
    return new Path(packageRoot, 'compile.script.mjs').absolute
  })
  /** Whether to skip any `git fetch` calls in the build script. */
  noFetch: boolean = this.config.getFlag('FADROMA_NO_FETCH', ()=>false)
  /** Name of directory where build artifacts are collected. */
  outputDir: SyncFS.Directory = new SyncFS.Directory(
    this.config.getString('FADROMA_ARTIFACTS',
      ()=>new Path(process.cwd(), 'wasm').absolute)
  )
  /** Version of Rust toolchain to use. */
  toolchain: string|null = this.config.getString('FADROMA_RUST', ()=>'')
  /** Default Git reference from which to build sources. */
  revision: string = Program.HEAD
  /** Owner uid that is set on build artifacts. */
  buildUid?: number = (process.getuid ? process.getuid() : undefined) // process.env.FADROMA_BUILD_UID
  /** Owner gid that is set on build artifacts. */
  buildGid?: number = (process.getgid ? process.getgid() : undefined) // process.env.FADROMA_BUILD_GID
  /** Whether to enable caching and reuse contracts from artifacts directory. */
  caching: boolean =
    !this.config.getFlag('FADROMA_REBUILD', ()=>false)

  constructor (options?: Partial<LocalRustCompiler>) {
    super()
    Core.assign(this, options, [
      'noFetch', 'toolchain', 'verbose', 'quiet', 'outputDir', 'script'
    ])
  }

  /** @returns a fully populated RustSourceCode from the original. */
  protected resolveSource (source: string|Partial<Program.RustSourceCode>): Partial<Program.RustSourceCode> {
    if (typeof source === 'string') {
      source = { cargoCrate: source }
    }
    if (source.cargoWorkspace && !source.cargoCrate) {
      throw new Error("missing crate name")
    }
    return source
  }

  /** Compile a single contract. */
  async build (contract: string|Partial<Program.RustSourceCode>): Promise<Program.CompiledCode> {
    return (await this.buildMany([contract]))[0]
  }

  /** This implementation groups the passed source by workspace and ref,
    * in order to launch one build container per workspace/ref combination
    * and have it build all the crates from that combination in sequence,
    * reusing the container's internal intermediate build cache. */
  async buildMany (
    contracts: (string|(Partial<Program.RustSourceCode>))[],
    // options: { parallel?: boolean } // TODO
  ): Promise<Program.CompiledCode[]> {
    const results: Program.CompiledCode[] = []
    // Group contracts by source root, source ref, and cargo workspace.
    const batches = this.collectBatches(contracts.map(
      x => (typeof x === 'string') ? { sourcePath: x } : x
    ) as Partial<Program.RustSourceCode>[])
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

  protected collectBatches (contracts: Array<Partial<Program.RustSourceCode>>): CompileBatches {
    // Batch by sourcePath, then by sourceRef, then group by workspace
    const batches: CompileBatches = {}
    // Assign each contract to its appropriate branch and group
    for (let buildIndex = 0; buildIndex < contracts.length; buildIndex++) {
      const contract = contracts[buildIndex]
      let { cargoToml, cargoWorkspace, cargoCrate, sourcePath = '.', sourceRef = 'HEAD', } = contract
      sourcePath = new Path(sourcePath).absolute
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
        workspaceTask ??= {
          cargoWorkspace: cargoWorkspace,
          cargoCrates: []
        }
        workspaceTask.cargoCrates.push({ buildIndex, cargoCrate })
      } else {
        if (!cargoToml) {
          throw new Error('When cargoWorkspace is not set, you must specify cargoToml')
        }
        const { package: { name: cargoCrate } } = new SyncFS.File(sourcePath, cargoToml)
          .setFormat(FileFormat.TOML)
          .load() as CargoTOML
        batches[sourcePath][sourceRef].tasks.add({
          buildIndex,
          cargoToml,
          cargoCrate
        } as CompileCrateTask)
      }
    }
    return batches
  }

  /** Check if codePath exists in local artifacts cache directory.
    * If it does, don't rebuild it but return it from there. */
  protected tryGetCached (
    outputDir: string,
    { sourceRef, cargoCrate }: Partial<Program.RustSourceCode>
  ): Program.CompiledCode|null {
    if (this.caching && cargoCrate) {
      const location = new SyncFS.File(
        outputDir, codePathName(cargoCrate, sourceRef||Program.HEAD)
      )
      if (location.exists()) {
        return new Program.CompiledCode({
          codePath: location.url,
          codeHash: location.sha256()
        })
      }
    }
    return null
  }

  protected async populateBatchResults ({
    outputDir, sourceRef, tasks,
  }: {
    outputDir: string, sourceRef: string, tasks: Set<CompileTask>
  }): Promise<Record<number, Program.CompiledCode>> {
    const results: Record<number, Program.CompiledCode> = {}
    for (const task of tasks) {
      if ((task as CompileWorkspaceTask).cargoWorkspace) {
        for (const { buildIndex, cargoCrate } of (task as CompileWorkspaceTask).cargoCrates) {
          const wasmName = `${sanitize(cargoCrate)}@${sanitize(sourceRef)}.wasm`
          const compiled = await new Program.LocalCompiledCode({
            codePath: new Path(outputDir, wasmName).absolute
          }).computeHash()
          results[buildIndex] = compiled
        }
      } else if ((task as CompileCrateTask).cargoCrate) {
        const wasmName = `${sanitize((task as CompileCrateTask).cargoCrate)}@${sanitize(sourceRef)}.wasm`
        const compiled = await new Program.LocalCompiledCode({
          codePath: new Path(outputDir, wasmName).absolute
        }).computeHash()
        results[(task as CompileCrateTask).buildIndex] = compiled
      } else {
        throw new Error("invalid task in compile batch")
      }
    }
    if (Object.keys(results).length > 0) {
      this.log.log('Compiled the following:\n ', Object.values(results)
        .map(x=>`${x.codeHash} ${bold(new Path(x.codePath!).short)}`)
        .join('\n  '))
    } else {
      this.log('Nothing to compile.')
    }
    return results
  }

  protected abstract buildBatch (batch: CompileBatch):
    Promise<Record<number, Program.CompiledCode>>

  protected logStart (sourcePath: string, sourceRef: string, tasks: Set<CompileTask>) {
    this.log.log(
      'Compiling from', bold(sourcePath), '@', bold(sourceRef),
      '\n ', [...tasks].map(task=>JSON.stringify(task)).join('\n  ')
    )
  }
}

/** Runs the build script in the current envionment. */
export class RawLocalRustCompiler extends LocalRustCompiler {

  /** Node.js runtime that runs the build subprocess.
    * Defaults to the same one that is running this script. */
  runtime = process.argv[0]

  protected async buildBatch (
    batch: CompileBatch, options: { outputDir?: string, buildScript?: string|Path } = {}
  ): Promise<Record<number, Program.CompiledCode>> {
    const { sourcePath, sourceRef, tasks } = batch
    const safeRef  = sanitize(sourceRef)
    const { outputDir = this.outputDir.absolute, buildScript = this.script } = options
    if (!buildScript) {
      throw new Error('missing build script')
    }
    this.logStart(sourcePath, sourceRef, tasks)
    // Standalone crates get built with:
    // - cargo build --manifest-path /path/to/Cargo.toml --target-dir /path/to/output/dir
    // Workspace crates get built with:
    // - cargo build --manifest-path /path/to/workspace/Cargo.toml -p crate1 crate2 crate3
    // Create stream for collecting build logs
    // Create output directory as user if it does not exist
    new SyncFS.Directory(outputDir).make()
    // Run the build container
    const buildProcess = this.spawn(this.runtime!, [ this.script!, 'phase1' ], {
      cwd: new Path(sourcePath).absolute,
      env: {
        ...process.env,
        FADROMA_OUTPUT:      new Path(process.cwd(), 'wasm').absolute,
        FADROMA_VERBOSE:     String(this.verbose),
        FADROMA_SRC_REF:     sourceRef||'HEAD',
        FADROMA_BUILD_TASKS: JSON.stringify([...tasks]),
        FADROMA_BUILD_UID:   String(this.buildUid),
        FADROMA_BUILD_GID:   String(this.buildGid),
      }, stdio: 'inherit'
    })
    await new Promise<void>((resolve)=>buildProcess.on('exit', (code: number, signal: any) => {
      if (code === 0) {
        resolve()
      } else if (code !== null) {
        throw new Error(`build ${buildProcess.pid} exited with code ${code}`)
      } else if (signal !== null) {
        throw new Error(`build ${buildProcess.pid} exited by signal ${signal}`)
      } else {
        throw new Error(`build ${buildProcess.pid} exited without code or signal ${signal}`)
      }
    }))
    return await this.populateBatchResults({ outputDir, sourceRef, tasks })
  }

  /** Overridable for testing. */
  protected spawn (...args: Parameters<typeof spawn>) {
    return spawn(...args)
  }
}

const DEFAULT_ENGINE_SOCKET = '/var/run/docker.sock'

/** Runs the build script in a container. */
export class ContainerizedLocalRustCompiler extends LocalRustCompiler {
  /** Used to launch build container. */
  engine:             OCI.Connection
  /** Path to Docker API endpoint. */
  engineSocket:       string =
    this.config.getString('FADROMA_DOCKER', ()=>DEFAULT_ENGINE_SOCKET)
  /** Tag of the docker image for the build container. */
  buildImage:         OCI.Image
  /** Docker image to use for dockerized builds. */
  buildImageTag:      string =
    this.config.getString('FADROMA_BUILD_IMAGE', ()=>'ghcr.io/hackbg/fadroma:master')
  /** Path to the dockerfile for the build container if missing. */
  buildImageManifest: string =
    this.config.getString('FADROMA_BUILD_DOCKERFILE',
      ()=>new Path(packageRoot, 'Dockerfile').absolute)
  /** Owner uid that is set on build artifacts. */
  outputUid:          string|undefined =
    this.config.getString('FADROMA_BUILD_UID', () => undefined)
  /** Owner gid that is set on build artifacts. */
  outputGid:          string|undefined =
    this.config.getString('FADROMA_BUILD_GID', () => undefined)

  constructor (options?: Partial<ContainerizedLocalRustCompiler>) {
    super(options as Partial<LocalRustCompiler>)
    // Set up Docker API handle
    if (options?.engineSocket) {
      this.engine = new OCI.Connection({ url: options.engineSocket })
    } else if (options?.engine) {
      this.engine = options.engine
    } else {
      this.engine = new OCI.Connection()
    }
    if ((options?.buildImageTag as unknown) instanceof OCI.Image) {
      this.buildImage = options?.buildImageTag as unknown as OCI.Image
    } else if (options?.buildImageTag) {
      this.buildImage = this.engine.image(options.buildImageTag)
    } else {
      this.buildImage = this.engine.image('ghcr.io/hackbg/fadroma:master')
    }
    // Set up Docker image
    this.buildImageManifest ??= options?.buildImageManifest!
    this.script ??= options?.script!
    const color = Core.randomColor({ luminosity: 'dark', seed: this.buildImage.name })
    this.log.label = Core.colors.whiteBright.bgHex(color)(` ${this.buildImage.name} `)
    //this.docker.log.label = this.log.label
    //this.image.log.label = this.log.label
  }

  get [Symbol.toStringTag]() {
    return `${this.buildImage?.name??'-'} -> ${this.outputDir?.shortPath??'-'}`
  }

  protected async buildBatch (

    {
      sourcePath,
      sourceRef,
      tasks
    }: CompileBatch,

    {
      outputDir   = this.outputDir.absolute,
      buildScript = this.script
    }: { outputDir?: string, buildScript?: string|Path } = {}

  ): Promise<Record<number, Program.CompiledCode>> {
    const safeRef = sanitize(sourceRef)
    if (!buildScript) {
      throw new Error('missing build script')
    }
    this.logStart(sourcePath, sourceRef, tasks)
    // Standalone crates get built with:
    // - cargo build --manifest-path /path/to/Cargo.toml --target-dir /path/to/output/dir
    // Workspace crates get built with:
    // - cargo build --manifest-path /path/to/workspace/Cargo.toml -p crate1 crate2 crate3
    // Create stream for collecting build logs
    let buildLogs = ''
    const logs = this.getLogStream(sourceRef, (data) => {buildLogs += data})
    // Create output directory as user if it does not exist
    new SyncFS.Directory(outputDir).make()
    // Run the build container
    const buildContainer = await this.buildImage.run({
      name: `fadroma-build-${randomBytes(3).toString('hex')}`,
      command: [
        'node',
        new Path(`/`, new Path(buildScript).name).absolute,
        'phase1',
      ],
      entrypoint: '/usr/bin/env',
      options: {
        remove: true,
        // Readonly mounts:
        readonly: {
          // - Script that will run in the container
          [new Path(buildScript).absolute]: new Path(`/`, new Path(buildScript).name).absolute,
        },
        // Writable mounts:
        writable: {
          // - Repo root, containing real .git
          // (FIXME: need readonly only for updating lockfile)
          [new Path(sourcePath).absolute]:  '/src',
          // - Output path for final artifacts:
          [outputDir]: `/output`,
          // - Persist cache to make future rebuilds faster. May be unneccessary.
          [`fadroma_cargo_cache_${safeRef}`]: `/usr/local/cargo`
          //[`fadroma_build_cache_${safeRef}`]: `/tmp/target`,
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
      },
      outputStream: logs
    })
    // If this process is terminated, the build container should be killed
    // FIXME: flaky
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
    return await this.populateBatchResults({ outputDir, sourceRef, tasks })
  }

  protected getLogStream (revision: string, cb: (data: string)=>void) {
    let log = new Core.Console(`compiling in container(${bold(this.buildImage.name)})`)
    if (revision && revision !== Program.HEAD) {
      log = log.sub(`(from ${bold(revision)})`)
    }
    // This stream collects the output from the build container, i.e. the build logs.
    const buildLogStream = new OCI.LineTransformStream((!this.quiet)
      // In normal and verbose mode, build logs are printed to the console in real time,
      // with an addition prefix to show what is being built.
      ? (line:string)=>this.log.log(line)
      // In quiet mode the logs are collected into a string as-is,
      // and are only printed if the build fails.
      : (line:string)=>line)
    // In quiet mode, build logs are collected in a string
    // In non-quiet mode, build logs are piped directly to the console;
    if (this.quiet) buildLogStream.on('data', cb)
    return buildLogStream
  }
}

export default function main (...args: any) {
}
