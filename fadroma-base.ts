import { DevnetContainer } from './devnet/devnet'
import type { DevnetPlatform } from './devnet/devnet'
import { FSUploader } from './fadroma-upload'
import { getBuilder } from './fadroma-build'

import {
  Builder, Deployment, DeployStore, ChainMode, Uploader,
  Error as BaseError, Console as BaseConsole, colors, bold, HEAD
} from '@fadroma/agent'
import type {
  BuilderClass, Chain, ChainId, UploaderClass, Template, Built,
  DeploymentClass, DeploymentFormat, DeployStoreClass,
} from '@fadroma/agent'

import { Config as BaseConfig, ConnectConfig } from '@fadroma/connect'
import type { Environment } from '@fadroma/connect'

import $ from '@hackbg/file'
import type { Path } from '@hackbg/file'
import { Engine, Docker, Podman } from '@hackbg/dock'

import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export * from '@fadroma/connect'
export type { Decimal } from '@fadroma/agent'

/** Path to this package. Used to find the build script, dockerfile, etc.
  * WARNING: Keep the ts-ignore otherwise it might break at publishing the package. */
//@ts-ignore 
export const thisPackage = dirname(fileURLToPath(import.meta.url))

export class Config extends ConnectConfig {
  /** Project file. Defaults to `node_modules/fadroma/index.ts`, which just runs the Fadroma CLI
    * and can create a project. Projects are expected to set this var to their own root file,
    * which does `export default class MyProject extends Fadroma.Project { ... }` and points to
    * the Deployment class. */
  project: string = this.getString('FADROMA_PROJECT', ()=>$(process.cwd(), 'ops.ts').path)
  /** Workspace root for project crates. This is the directory that contains the root `Cargo.toml`.
    * Defaults to parent directory of FADROMA_PROJECT. */
  workspace: string = this.getString('FADROMA_WORKSPACE', ()=>dirname(this.project))
  /** License token. */
  license: string = this.getString('FADROMA_LICENSE', ()=>'unlicensed')
  /** Build options. */
  build: BuilderConfig
  /** Upload options. */
  upload: UploadConfig
  /** Deploy options. */
  deploy: DeployConfig
  /** Devnet options. */
  devnet: DevnetConfig

  constructor (
    options: Partial<ConnectConfig> & Partial<{
      build: Partial<BuilderConfig>,
      upload: Partial<UploadConfig>,
      deploy: Partial<DeployConfig>,
      devnet: Partial<DevnetConfig>
    }> = {},
    environment?: Environment
  ) {
    super(environment)
    const { build, upload, deploy, devnet, ...rest } = options
    this.override(rest)
    this.build = new BuilderConfig(dirname(this.project), build, environment)
    this.upload = new UploadConfig(dirname(this.project), this.chainId, upload, environment)
    this.deploy = new DeployConfig(dirname(this.project), this.chainId, deploy, environment)
    this.devnet = new DevnetConfig(devnet, environment)
  }
  /** @returns a configured builder. */
  getBuilder <B extends Builder> ($B?: BuilderClass<B>): B {
    $B ??= Builder.variants[this.build.raw?'Raw':'Container'] as unknown as BuilderClass<B>
    const builder = new $B(this.build) as B
    return builder
  }
  /** @returns a configured uploader. */
  getUploader <U extends Uploader> (
    $U: UploaderClass<U> = Uploader.variants[this.upload.uploader] as UploaderClass<U>
  ): U {
    const agent = this.getAgent()
    return new $U({ agent })
  }
  /** @returns an instance of the selected deploy store implementation. */
  getDeployStore <S extends DeployStore> (
    $S: DeployStoreClass<S>|undefined = this.deploy.Store as DeployStoreClass<S>
  ): S {
    if (!$S) throw new Error('Missing deployment store constructor')
    return new $S(this.deploy.storePath)
  }
  /** Create a new Deployment.
    * If a deploy store is specified, populate it with stored data (if present).
    * @returns Deployment or subclass */
  getDeployment <D extends Deployment> (
    $D: DeploymentClass<D> = Deployment as DeploymentClass<D>,
    ...args: ConstructorParameters<typeof $D>
  ): D {
    args = [...args]
    args[0] = {...args[0] ?? {} }
    const chain     = args[0].chain     ||= this.getChain()
    if (!chain) throw new Error('Missing chain')
    const agent     = args[0].agent     ||= this.getAgent()
    const builder   = args[0].builder   ||= getBuilder()
    const uploader  = args[0].uploader  ||= agent.getUploader(FSUploader)
    const workspace = args[0].workspace ||= process.cwd()
    const store     = args[0].store     ||= this.getDeployStore()
    const name      = args[0].name      ||= store.activeName || undefined
    if (args[0]) args[0].config ||= this
    //args[0] = { config: this, chain, agent, builder, uploader, workspace, ...args }
    const deployment = store.getDeployment($D, ...args)
    return deployment
  }
  /** @returns DevnetContainer */
  getDevnet (platform: DevnetPlatform = this.devnet.platform ?? 'scrt_1.8') {
    if (!platform) throw new Error('Devnet platform not specified')
    const Engine = this.devnet.podman ? Podman.Engine : Docker.Engine
    const containerEngine = new Engine()
    const port = this.devnet.port ? Number(this.devnet.port) : undefined
    return DevnetContainer.getOrCreate(platform, containerEngine, port)
  }
}

export class BuilderConfig extends BaseConfig {
  /** Builder to use */
  builder: string = this.getString('FADROMA_BUILDER', ()=>Object.keys(Builder.variants)[0])
  /** Whether the build process should print more detail to the console. */
  verbose: boolean = this.getFlag('FADROMA_BUILD_VERBOSE', ()=>false)
  /** Whether the build log should be printed only on error, or always */
  quiet: boolean = this.getFlag('FADROMA_BUILD_QUIET', ()=>false)
  /** Whether to enable caching and reuse contracts from artifacts directory. */
  caching: boolean = !this.getFlag('FADROMA_REBUILD', ()=>false)
  /** Name of output directory. */
  outputDir: string = this.getString('FADROMA_ARTIFACTS', ()=>
    $(this.project).in('wasm').path)
  /** Script that runs inside the build container, e.g. build.impl.mjs */
  script: string = this.getString('FADROMA_BUILD_SCRIPT', ()=>
    $(thisPackage).at('build.impl.mjs').path)
  /** Which version of the Rust toolchain to use, e.g. `1.61.0` */
  toolchain: string = this.getString('FADROMA_RUST', ()=>'')
  /** Don't run "git fetch" during build. */
  noFetch: boolean = this.getFlag('FADROMA_NO_FETCH', ()=>false)
  /** Whether to bypass Docker and use the toolchain from the environment. */
  raw: boolean = this.getFlag('FADROMA_BUILD_RAW', ()=>false)
  /** Whether to use Podman instead of Docker to run the build container. */
  podman: boolean = this.getFlag('FADROMA_BUILD_PODMAN', () =>
    this.getFlag('FADROMA_BUILD_PODMAN', ()=>false))
  /** Path to Docker API endpoint. */
  dockerSocket: string = this.getString('FADROMA_DOCKER',
    ()=>'/var/run/docker.sock')
  /** Docker image to use for dockerized builds. */
  dockerImage: string = this.getString('FADROMA_BUILD_IMAGE',
    ()=>'ghcr.io/hackbg/fadroma:master')
  /** Dockerfile to build the build image if not downloadable. */
  dockerfile: string = this.getString('FADROMA_BUILD_DOCKERFILE',
    ()=>$(thisPackage).at('Dockerfile').path)

  constructor (
    readonly project: string,
    options: Partial<BuilderConfig> = {},
    environment?: Environment
  ) {
    super(environment)
    this.override(options)
  }
}

/** Deployment system configuration and factory for populated Deployments. */
export class DeployConfig extends BaseConfig {
  /** Whether to generate unsigned transactions for manual multisig signing. */
  multisig: boolean = this.getFlag('FADROMA_MULTISIG', () => false)
  /** Directory to store the receipts for the deployed contracts. */
  storePath: string | null = this.getString('FADROMA_DEPLOY_STATE', () =>
    this.chainId ? $(this.project).in('state').in(this.chainId).in('deploy').path : null)
  /** Which implementation of the receipt store to use. */
  format = this.getString('FADROMA_DEPLOY_FORMAT', () => 'v1') as DeploymentFormat

  constructor (
    readonly project: string,
    readonly chainId: ChainId|null,
    options: Partial<DeployConfig> = {},
    environment?: Environment
  ) {
    super(environment)
    this.override(options)
  }

  /** The deploy receipt store implementation selected by `format`. */
  get Store (): DeployStoreClass<DeployStore>|undefined {
    console.log(this.format, DeployStore.variants)
    return DeployStore.variants[this.format]
  }
}

/** Gets devnet settings from environment. */
export class DevnetConfig extends BaseConfig {
  /** Which kind of devnet to launch */
  platform: DevnetPlatform = this.getString('FADROMA_DEVNET_PLATFORM', ()=>'scrt_1.8') as DevnetPlatform
  /** Chain id for devnet .*/
  chainId: string = this.getString('FADROMA_DEVNET_CHAIN_ID', ()=>"fadroma-devnet")
  /** Whether the devnet should remain running after the command ends. */
  persistent: boolean = this.getFlag('FADROMA_DEVNET_PERSISTENT', ()=>true)
  /** Whether the devnet should be erased after the command ends. */
  ephemeral: boolean = this.getFlag('FADROMA_DEVNET_EPHEMERAL', ()=>false)
  /** Host for devnet. */
  host: string|null = this.getString('FADROMA_DEVNET_HOST', ()=>null)
  /** Port for devnet. */
  port: string|null = this.getString('FADROMA_DEVNET_PORT', ()=>null)
  /** Whether to use Podman instead of Docker to run the devnet container. */
  podman: boolean = this.getFlag('FADROMA_DEVNET_PODMAN', () => this.getFlag('FADROMA_PODMAN', ()=>false))

  constructor (
    options: Partial<DevnetConfig> = {},
    environment?: Environment
  ) {
    super(environment)
    this.override(options)
  }
}

export class UploadConfig extends BaseConfig {
  /** Whether to always upload contracts, ignoring upload receipts that match. */
  reupload: boolean = this.getFlag('FADROMA_REUPLOAD', () => false)
  /** Directory to store the receipts for the deployed contracts. */
  uploadState: string|null = this.getString('FADROMA_UPLOAD_STATE', () =>
    this.chainId ? $(this.project).in('state').in(this.chainId).in('upload').path : null)
  /** Variant of uploader to use */
  uploader: string = this.getString('FADROMA_UPLOADER', () => 'FS')

  constructor (
    readonly project: string,
    readonly chainId: ChainId|null,
    options: Partial<UploadConfig> = {},
    environment?: Environment
  ) {
    super(environment)
    this.override(options)
  }
}

export class Error extends BaseError {
  static Build:  typeof BuildError
  static Upload: typeof UploadError
  static Deploy: typeof DeployError
  static Devnet: typeof DevnetError
}

export class BuildError extends Error {
}

export class UploadError extends Error {
}

export class DeployError extends Error {
  static DeploymentAlreadyExists = this.define('DeploymentAlreadyExists', (name: string)=>
    `Deployment "${name}" already exists`)
  static DeploymentDoesNotExist = this.define('DeploymentDoesNotExist', (name: string)=>
    `Deployment "${name}" does not exist`)
}

export class DevnetError extends Error {
  static PortMode = this.define('PortMode',
    ()=>"DevnetContainer#portMode must be either 'lcp' or 'grpcWeb'")
  static NoChainId = this.define('NoChainId',
    ()=>'Refusing to create directories for devnet with empty chain id')
  static NoContainerId = this.define('NoContainerId',
    ()=>'Missing container id in devnet state')
  static ContainerNotSet = this.define('ContainerNotSet',
    ()=>'DevnetContainer#container is not set')
  static NoGenesisAccount = this.define('NoGenesisAccount',
    (name: string, error: any)=>
      `Genesis account not found: ${name} (${error})`)
}

Object.assign(Error, {
  Build:  BuildError,
  Upload: UploadError,
  Deploy: DeployError,
  Devnet: DevnetError
})

export { hideProperties } from '@fadroma/agent'

export { bold, colors }

export class Console extends BaseConsole {

  constructor (public label = '@hackbg/fadroma') {
    super()
  }

  build = ((self: Console)=>({

    one: ({ crate = '(unknown)', revision = 'HEAD' }: Partial<Template<any>>) => self.log(
      'Building', bold(crate), ...(revision === 'HEAD')
        ? ['from working tree']
        : ['from Git reference', bold(revision)]),
    many: (sources: Template<any>[]) =>
      sources.forEach(source=>self.build.one(source)),
    workspace: (mounted: Path|string, ref: string = HEAD) => self.log(
      `building from workspace:`, bold(`${$(mounted).shortPath}/`),
      `@`, bold(ref)),
    container: (root: string|Path, revision: string, cratesToBuild: string[]) => {
      root = $(root).shortPath
      const crates = cratesToBuild.map(x=>bold(x)).join(', ')
      self.log(`started building from ${bold(root)} @ ${bold(revision)}:`, crates) },
    found: ({ artifact }: Built) =>
      self.log(`found at ${bold($(artifact!).shortPath)}`),

  }))(this)

  deploy = ((self: Console)=>({

    creating: (name: string) =>
      self.log('creating', bold(name)),
    location: (path: string) =>
      self.log('location', bold(path)),
    activating: (name: string) =>
      self.log('activate', bold(name)),
    list: (chainId: string, deployments: DeployStore) => {
      const list = deployments.list()
      if (list.length > 0) {
        self.info(`deployments on ${bold(chainId)}:`)
        let maxLength = 0
        for (let name of list) {
          if (name === (deployments as any).KEY) continue
          maxLength = Math.max(name.length, maxLength)
        }
        for (let name of list) {
          if (name === (deployments as any).KEY) continue
          const deployment = deployments.load(name)!
          const count = Object.keys(deployment.state).length
          let info = `${bold(name.padEnd(maxLength))}`
          info = `${info} (${deployment.size} contracts)`
          if (deployments.activeName === name) info = `${info} ${bold('selected')}`
          self.info(` `, info)
        }
      } else {
        self.info(`no deployments on ${bold(chainId)}`)
      }
    },

    warnStoreDoesNotExist: (path: string) =>
      self.warn(`deployment store "${path}" does not exist.`),
    warnOverridingStore: (x: string) =>
      self.warn(`overriding store for ${x}`),
    warnNoAgent: (name?: string) =>
      self.warn('no agent. authenticate by exporting FADROMA_MNEMONIC in your shell.'),

  }))(this)

  devnet = ((self: Console)=>({

    loadingState: (chainId1: string, chainId2: string) =>
      self.info(`Loading state of ${chainId1} into Devnet with id ${chainId2}`),
    loadingFailed: (path: string) =>
      self.warn(`Failed to load devnet state from ${path}. Deleting it.`),
    loadingRejected: (path: string) =>
      self.log(`${path} does not exist.`),
    isNowRunning: ({ chainId, port, container: { id } }: any) => self
      .info(`running on port`, bold(String(port)))
      .info(`from container`, bold(id.slice(0,8)))
      .info('manual reset with:').info(`$`,
        `docker kill`, id.slice(0,8), `&&`,
        `docker rm`, id.slice(0,8), `&&`,
        `sudo rm -rf state/${chainId??'fadroma-devnet'}`)

  }))(this)

}
