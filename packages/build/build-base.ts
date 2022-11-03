import { Env, EnvConfig } from '@hackbg/konfizi'
import { Builder, Contract, HEAD } from '@fadroma/client'
import { bold } from '@hackbg/konzola'
import type { Class, Client } from '@fadroma/client'
import $, { Path, BinaryFile, TOMLFile, OpaqueFile, OpaqueDirectory } from '@hackbg/kabinet'

import { BuildConsole } from './build-events'

import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

/** Path to this package. Used to find the build script, dockerfile, etc. */
//@ts-ignore
export const buildPackage = dirname(fileURLToPath(import.meta.url))

export class BuilderConfig extends EnvConfig {
  constructor (
    readonly env: Env    = process.env,
    readonly cwd: string = process.cwd(),
    defaults: Partial<BuilderConfig> = {}
  ) {
    super(env, cwd)
    this.override(defaults)
  }

  /** Whether to print everything that happens during builds. */
  verbose:    boolean = this.getBoolean('FADROMA_BUILD_VERBOSE', ()=>false)

  /** Project root. Defaults to current working directory. */
  project:     string  = this.getString('FADROMA_PROJECT',    ()=>this.cwd)
  /** Whether to enable caching and reuse contracts from artifacts directory. */
  caching:     boolean = !this.getBoolean('FADROMA_REBUILD',  ()=>false)
  /** Name of output directory. */
  outputDir:   string  = this.getString('FADROMA_ARTIFACTS',
    ()=>$(this.project).in('artifacts').path)

  /** Script that runs inside the build container, e.g. build.impl.mjs */
  script:      string  = this.getString('FADROMA_BUILD_SCRIPT',
    ()=>$(buildPackage).at('build.impl.mjs').path)
  /** Which version of the Rust toolchain to use, e.g. `1.61.0` */
  toolchain:   string  = this.getString('FADROMA_RUST',       ()=>'')
  /** Don't run "git fetch" during build. */
  noFetch:     boolean = this.getBoolean('FADROMA_NO_FETCH',  ()=>false)

  /** Whether to bypass Docker and use the toolchain from the environment. */
  buildRaw:     boolean = this.getBoolean('FADROMA_BUILD_RAW', ()=>false)
  /** Path to Docker API endpoint. */
  dockerSocket: string  = this.getString('FADROMA_DOCKER', ()=>'/var/run/docker.sock')
  /** Docker image to use for dockerized builds. */
  dockerImage:  string  = this.getString('FADROMA_BUILD_IMAGE',
    ()=>'ghcr.io/hackbg/fadroma:unstable')
  /** Dockerfile to build the build image if not downloadable. */
  dockerfile:   string  = this.getString('FADROMA_BUILD_DOCKERFILE',
    ()=>$(buildPackage).at('build.Dockerfile').path)

  /** Get a configured builder. */
  getBuilder <B extends Builder> (
    $B: BuilderClass<B> = Builder.variants[this.buildRaw?'local-raw':'local-docker'] as unknown as BuilderClass<B>
  ): B {
    return new $B(this)
  }
}

/** Constructor for a subclass of Builder that
  * maintains the original constructor signature. */
export interface BuilderClass<B extends Builder> extends Class<B, [
  Partial<BuilderConfig>
]>{}

/** Can perform builds.
  * Will only perform a build if a contract is not built yet or FADROMA_REBUILD=1 is set. */
export abstract class LocalBuilder extends Builder {

  constructor (options: Partial<BuilderConfig>) {
    super('local builder', 'local builder')
    this.config = new BuilderConfig(this.env, this.cwd, options)
    this.noFetch   = options.noFetch   ?? this.noFetch
    this.toolchain = options.toolchain ?? this.toolchain
    this.verbose   = options.verbose   ?? this.verbose
    this.outputDir = $(options.outputDir!).as(OpaqueDirectory)
    if (options.script) this.script = options.script
  }
  /** Logger. */
  log = new BuildConsole('Local Builder')
  /** Settings. */
  config:     BuilderConfig
  /** The build script. */
  script?:    string
  /** Whether to set _NO_FETCH=1 in build script's environment and skip "git fetch" calls */
  noFetch:    boolean     = false
  /** Name of directory where build artifacts are collected. */
  outputDir:  OpaqueDirectory
  /** Version of Rust toolchain to use. */
  toolchain:  string|null = null
  /** Whether the build process should print more detail to the console. */
  verbose:    boolean     = false
  /** Whether to enable caching. */
  caching:    boolean     = true
  /** Git reference from which to build sources. */
  revision:   string = HEAD

  /** Defines a contract, outputting a new `Contract` instance:
    * works the same as Deployment#contract, but only populates
    * the `builder` property because we don't have chain or agent in build context. */
  contract (name?: string): Contract<Client>
  contract <C extends Client> (options?: Partial<Contract<C>>): Contract<C>
  contract <C extends Client> (arg?: string|Partial<Contract<C>>) {
    const options = {
      builder:    this as Builder,
      revision:   this.revision,
      workspace:  this.config.project,
      repository: this.config.project,
      gitDir:     `${this.config.project}/.git`,
      ...((typeof arg === 'string') ? { name: arg } : arg)
    }
    const contract = new Contract(options)
    return contract
  }

  /** Pass this a Cargo.toml or a directory containing one */
  buildOne = this.command('one', 'build one crate from working tree', (
    path: string|Path = process.argv[2],
    args: string[]    = process.argv.slice(3)
  ) => {
    path = $(path)
    if (path.isDirectory()) {
      path = path.at('Cargo.toml').as(TOMLFile)
    }
    if (path.exists() && path.isFile()) {
      return this.buildFromCargoToml(path as CargoTOML)
    }
    return this.printUsage()
  })

  buildFromCargoToml = async (
    cargoToml:   CargoTOML,
    repository?: string|Path,
    workspace?:  string|Path
  ) => {
    repository = $(repository ?? process.env.FADROMA_BUILD_REPO_ROOT      ?? cargoToml.parent)
    workspace  = $(workspace  ?? process.env.FADROMA_BUILD_WORKSPACE_ROOT ?? cargoToml.parent)
    this.log.buildingFromCargoToml(cargoToml)
    const source = new Contract({
      repository: repository.path,
      workspace:  workspace.path,
      crate: (cargoToml.as(TOMLFile).load() as any).package.name
    })
    try {
      this.caching = false
      const result = await this.build(source)
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

  buildFromModule = async (script: OpaqueFile, args: string[]) => {
    this.log.buildingFromBuildScript(script, args)
    const {default: BuildContext} = await import(script.path)
    const commands = new BuildContext(this)
    const T0 = + new Date()
    try {
      const result = await commands.run(args)
      const T1 = + new Date()
      this.log.info(`Build finished in ${T1-T0}msec.`)
      return result
    } catch (e: any) {
      const T1 = + new Date()
      this.log.error(`Build failed in ${T1-T0}msec: ${e.message}`)
      this.log.error(e)
      throw e
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

  readonly id: string = 'local'

  /** Check if artifact exists in local artifacts cache directory.
    * If it does, don't rebuild it but return it from there. */
  protected prebuild (
    outputDir: string, crate?: string, revision: string = HEAD
  ): Contract<any>|null {
    if (this.caching && crate) {
      const location = $(outputDir, artifactName(crate, revision))
      if (location.exists()) {
        const artifact = location.url
        const codeHash = this.hashPath(location)
        return new Contract({ crate, revision, artifact, codeHash })
      }
    }
    return null
  }

  hashPath = (location: string|Path) => $(location).as(BinaryFile).sha256

}

export const artifactName = (crate: string, ref: string) => `${crate}@${sanitize(ref)}.wasm`

export const sanitize = (ref: string) => ref.replace(/\//g, '_')

/** The parts of Cargo.toml which the builder needs to be aware of. */
export type CargoTOML = TOMLFile<{ package: { name: string } }>
