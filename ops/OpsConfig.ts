import { DevnetContainer } from './devnet/index'
import type { DevnetPlatform } from './devnet/index'
import { FSUploader } from './upload/index'
import { getBuilder, buildPackage } from './build/index'

import {
  Builder, Deployment, DeployStore, ChainMode, Uploader
} from '@fadroma/agent'
import type {
  BuilderClass, Chain, ChainId, UploaderClass, DeploymentClass, DeploymentFormat, DeployStoreClass
} from '@fadroma/agent'

import { Config as BaseConfig, ConnectConfig } from '@fadroma/connect'
import type { Environment } from '@fadroma/connect'

import $ from '@hackbg/file'
import { Engine, Docker, Podman } from '@hackbg/dock'

import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export default class Config extends ConnectConfig {
  /** Project root. Defaults to current working directory. */
  project: string = this.getString('FADROMA_PROJECT', ()=>this.environment.cwd)
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
    this.build = new BuilderConfig(this.project, build, environment)
    this.upload = new UploadConfig(this.project, this.chainId, upload, environment)
    this.deploy = new DeployConfig(this.project, this.chainId, deploy, environment)
    this.devnet = new DevnetConfig(devnet, environment)
  }
  /** @returns a configured builder. */
  getBuilder <B extends Builder> ($B?: BuilderClass<B>): B {
    $B ??= Builder.variants[this.build.buildRaw?'Raw':'Container'] as unknown as BuilderClass<B>
    const builder = new $B(this.build) as B
    return builder
  }
  /** @returns a configured uploader. */
  getUploader <U extends Uploader> (
    $U: UploaderClass<U> = Uploader.variants[this.upload.uploader] as UploaderClass<U>
  ): U {
    return new $U(this.getAgent())
  }
  /** @returns an instance of the selected deploy store implementation. */
  getDeployStore <S extends DeployStore> (
    $S: DeployStoreClass<S>|undefined = this.deploy.Store as DeployStoreClass<S>
  ): S {
    if (!$S) throw new Error('Missing deployment store constructor')
    return new $S(this.deploy.deployState)
  }
  /** Create a new Deployment.
    * If a deploy store is specified, populate it with stored data (if present).
    * @returns Deployment or subclass */
  getDeployment <D extends Deployment> (
    $D: DeploymentClass<D> = Deployment as DeploymentClass<D>,
    ...args: ConstructorParameters<typeof $D>
  ): D {
    const chain = this.getChain()
    if (!chain) throw new Error('Missing chain')
    const agent = this.getAgent()
    const builder = getBuilder()
    const uploader = agent.getUploader(FSUploader)
    const workspace = process.cwd()
    const defaults = { config: this, chain, agent, builder, uploader, workspace }
    args[0] = Object.assign(defaults, args[0]??{})
    const deployment = this.getDeployStore().getDeployment($D, ...args)
    return deployment
  }
  /** @returns DevnetContainer */
  getDevnet (platform: DevnetPlatform = this.devnet.platform ?? 'scrt_1.8') {
    if (!platform) throw new Error('Devnet platform not specified')
    const Engine = this.devnet.podman ? Podman.Engine : Docker.Engine
    const containerEngine = new Engine()
    return DevnetContainer.getOrCreate(platform, containerEngine)
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
    $(this.project).in('artifacts').path)
  /** Script that runs inside the build container, e.g. build.impl.mjs */
  script: string = this.getString('FADROMA_BUILD_SCRIPT', ()=>
    $(buildPackage).at('build.impl.mjs').path)
  /** Which version of the Rust toolchain to use, e.g. `1.61.0` */
  toolchain: string = this.getString('FADROMA_RUST', ()=>'')
  /** Don't run "git fetch" during build. */
  noFetch: boolean = this.getFlag('FADROMA_NO_FETCH', ()=>false)
  /** Whether to bypass Docker and use the toolchain from the environment. */
  buildRaw: boolean = this.getFlag('FADROMA_BUILD_RAW', ()=>false)
  /** Whether to use Podman instead of Docker to run the build container. */
  podman: boolean = this.getFlag('FADROMA_BUILD_PODMAN', () =>
    this.getFlag('FADROMA_PODMAN', ()=>false))
  /** Path to Docker API endpoint. */
  dockerSocket: string = this.getString('FADROMA_DOCKER',
    ()=>'/var/run/docker.sock')
  /** Docker image to use for dockerized builds. */
  dockerImage: string = this.getString('FADROMA_BUILD_IMAGE',
    ()=>'ghcr.io/hackbg/fadroma:unstable')
  /** Dockerfile to build the build image if not downloadable. */
  dockerfile: string = this.getString('FADROMA_BUILD_DOCKERFILE',
    ()=>$(buildPackage).at('build.Dockerfile').path)

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
  deployState: string | null = this.getString('FADROMA_DEPLOY_STATE', () =>
    this.chainId ? $(this.project).in('receipts').in(this.chainId).in('deployments').path : null)
  /** Which implementation of the receipt store to use. */
  deploymentFormat = this.getString('FADROMA_DEPLOY_STORE', () => 'YAML1') as DeploymentFormat
  /** The deploy receipt store implementation selected by `deploymentFormat`. */
  get Store (): DeployStoreClass<DeployStore>|undefined {
    return DeployStore.variants[this.deploymentFormat]
  }

  constructor (
    readonly project: string,
    readonly chainId: ChainId|null,
    options: Partial<DeployConfig> = {},
    environment?: Environment
  ) {
    super(environment)
    this.override(options)
  }
}

/** Gets devnet settings from environment. */
export class DevnetConfig extends BaseConfig {
  /** Which kind of devnet to launch */
  platform: DevnetPlatform = this.getString('FADROMA_DEVNET_PLATFORM', ()=>'scrt_1.8') as DevnetPlatform
  /** Chain id for devnet .*/
  chainId: string = this.getString('FADROMA_DEVNET_CHAIN_ID', ()=>"fadroma-devnet")
  /** Whether to remove the devnet after the command ends. */
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
    this.chainId ? $(this.project).in('receipts').in(this.chainId).in('uploads').path : null)
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
