/**

  Fadroma Base Configuration
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

import { Devnet } from './fadroma-devnet'
import type { DevnetPlatform } from './fadroma-devnet'
import { FSUploader } from './fadroma-upload'
import { getBuilder } from './fadroma-build'

import {
  Builder, Deployment as BaseDeployment, DeployStore, ChainMode, Uploader,
  Error as BaseError, Console as BaseConsole, colors, bold, HEAD,
} from '@fadroma/agent'
import type {
  BuilderClass, Chain, ChainId, UploaderClass, Template, Built,
  DeploymentClass, DeploymentFormat, DeployStoreClass,
} from '@fadroma/agent'

import { Config as BaseConfig, ConnectConfig } from '@fadroma/connect'
import type { Environment } from '@fadroma/connect'

import $, { JSONFile } from '@hackbg/file'
import type { Path } from '@hackbg/file'

import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export * from '@fadroma/connect'
export type { Decimal } from '@fadroma/agent'

/** Path to this package. Used to find the build script, dockerfile, etc.
  * WARNING: Keep the ts-ignore otherwise it might break at publishing the package. */
//@ts-ignore
export const thisPackage = dirname(fileURLToPath(import.meta.url))

export const { version } = $(thisPackage, 'package.json').as(JSONFile).load() as any

export class Config extends ConnectConfig {

  /** License token. */
  license?: string = this.getString(
    'FADROMA_LICENSE', ()=>undefined)
  /** The topmost directory visible to Fadroma.
    * Usually the root of NPM package and Cargo workspace. */
  root: string = this.getString(
    'FADROMA_ROOT', ()=>$(process.cwd()).path)
  /** Project file. Defaults to `node_modules/fadroma/index.ts`, which just runs the Fadroma CLI
    * and can create a project. Projects are expected to set this var to their own root file,
    * which does `export default class MyProject extends Fadroma.Project { ... }` and points to
    * the Deployment class. */
  project: string = $(this.root, this.getString(
    'FADROMA_PROJECT', ()=>$(thisPackage, 'fadroma.ts').path)).path

  constructor (
    options:  Partial<ConnectConfig> & Partial<{
      build:  Partial<Config["build"]>,
      upload: Partial<Config["upload"]>,
      deploy: Partial<Config["deploy"]>,
      devnet: Partial<Config["devnet"]>
    }> = {},
    environment?: Environment
  ) {
    super({}, environment)
    const { build, upload, deploy, devnet, ...rest } = options
    this.override(rest)
    this.build  = { ...this.build, ...build }
    this.upload = { ...this.upload, ...upload }
    this.deploy = { ...this.deploy, ...deploy }
    this.devnet = { ...this.devnet, ...devnet }
  }

  /** Build options. */
  build = {
    /** Workspace root for project crates. This is the directory that contains the root `Cargo.toml`.
      * Defaults to parent directory of FADROMA_PROJECT. */
    workspace: this.getString(
      'FADROMA_WORKSPACE', ()=>this.root),
    /** Builder to use */
    builder: this.getString(
      'FADROMA_BUILDER', ()=>Object.keys(Builder.variants)[0]),
    /** Whether the build process should print more detail to the console. */
    verbose: this.getFlag(
      'FADROMA_BUILD_VERBOSE', ()=>false),
    /** Whether the build log should be printed only on error, or always */
    quiet: this.getFlag(
      'FADROMA_BUILD_QUIET', ()=>false),
    /** Whether to enable caching and reuse contracts from artifacts directory. */
    caching: !this.getFlag(
      'FADROMA_REBUILD', ()=>false),
    /** Name of output directory. */
    outputDir: this.getString(
      'FADROMA_ARTIFACTS', ()=>$(this.root).in('wasm').path),
    /** Script that runs inside the build container, e.g. build.impl.mjs */
    script: this.getString(
      'FADROMA_BUILD_SCRIPT', ()=>$(thisPackage).at('build.impl.mjs').path),
    /** Which version of the Rust toolchain to use, e.g. `1.61.0` */
    toolchain: this.getString(
      'FADROMA_RUST', ()=>''),
    /** Don't run "git fetch" during build. */
    noFetch: this.getFlag(
      'FADROMA_NO_FETCH', ()=>false),
    /** Whether to bypass Docker and use the toolchain from the environment. */
    raw: this.getFlag(
      'FADROMA_BUILD_RAW', ()=>false),
    /** Whether to use Podman instead of Docker to run the build container. */
    podman: this.getFlag(
      'FADROMA_BUILD_PODMAN', () => this.getFlag('FADROMA_BUILD_PODMAN', ()=>false)),
    /** Path to Docker API endpoint. */
    dockerSocket: this.getString(
      'FADROMA_DOCKER', ()=>'/var/run/docker.sock'),
    /** Docker image to use for dockerized builds. */
    dockerImage: this.getString(
      'FADROMA_BUILD_IMAGE', ()=>'ghcr.io/hackbg/fadroma:master'),
    /** Dockerfile to build the build image if not downloadable. */
    dockerfile: this.getString(
      'FADROMA_BUILD_DOCKERFILE', ()=>$(thisPackage).at('Dockerfile').path),
  }

  /** @returns the Builder class exposed by the config */
  get Builder () {
    return Builder.variants[this.build.raw ? 'Raw' : 'Container']
  }

  /** @returns a configured builder. */
  getBuilder <T extends Builder> (Builder?: BuilderClass<T>): T {
    Builder ??= this.Builder
    const builder = new Builder(this.build) as T
    return builder
  }

  /** Upload options. */
  upload = {
    /** Whether to always upload contracts, ignoring upload receipts that match. */
    reupload: this.getFlag(
      'FADROMA_REUPLOAD', () => false),
    /** Directory to store the receipts for the deployed contracts. */
    uploadState: this.getString(
      'FADROMA_UPLOAD_STATE', () => this.chainId
        ? $(this.root).in('state').in(this.chainId).in('upload').path
        : null),
    /** Variant of uploader to use */
    uploader: this.getString(
      'FADROMA_UPLOADER', () => 'FS')
  }

  /** @returns the Uploader class exposed by the config */
  get Uploader () {
    return Uploader.variants[this.upload.uploader]
  }

  /** @returns a configured uploader. */
  getUploader <T extends Uploader, U extends UploaderClass<T>> (
    Uploader?: U, ...args: ConstructorParameters<U>
  ): T {
    Uploader ??= this.Uploader as U
    args[0] ??= { agent: this.getAgent() }
    const uploader = new Uploader(...args)
    return uploader
  }

  /** Deploy options. */
  deploy = {
    /** Whether to generate unsigned transactions for manual multisig signing. */
    multisig: this.getFlag(
      'FADROMA_MULTISIG', () => false),
    /** Directory to store the receipts for the deployed contracts. */
    storePath: this.getString(
      'FADROMA_DEPLOY_STATE', () =>
      this.chainId ? $(this.root).in('state').in(this.chainId).in('deploy').path : null),
    /** Which implementation of the receipt store to use. */
    format: this.getString(
      'FADROMA_DEPLOY_FORMAT', () => 'v1') as DeploymentFormat
  }

  /** The deploy receipt store implementation selected by `format`. */
  get DeployStore (): DeployStoreClass<DeployStore>|undefined {
    return DeployStore.variants[this.deploy.format]
  }

  /** @returns an instance of the selected deploy store implementation. */
  getDeployStore <T extends DeployStore> (
    DeployStore?: DeployStoreClass<T>
  ): T {
    DeployStore ??= this.DeployStore as DeployStoreClass<T>
    if (!DeployStore) throw new Error('Missing deployment store constructor')
    return new DeployStore(this.deploy.storePath)
  }

  /** Create a new Deployment.
    * If a deploy store is specified, populate it with stored data (if present).
    * @returns Deployment or subclass */
  getDeployment <T extends BaseDeployment> (
    Deployment: DeploymentClass<T>,
    ...args: ConstructorParameters<typeof Deployment>
  ): T {
    Deployment ??= BaseDeployment as DeploymentClass<T>
    args = [...args]
    args[0] = ({ ...args[0] ?? {} })
    args[0].chain     ||= this.getChain()
    if (!args[0].chain) throw new Error('Missing chain')
    args[0].agent     ||= this.getAgent()
    args[0].builder   ||= getBuilder()
    args[0].uploader  ||= args[0].agent.getUploader(FSUploader)
    args[0].workspace ||= process.cwd()
    args[0].store     ||= this.getDeployStore()
    args[0].name      ||= args[0].store.activeName || undefined
    const deployment = args[0].store.getDeployment(Deployment, ...args)
    return deployment
  }

  /** Devnet options. */
  devnet: Partial<Devnet> = {
    chainId: this.getString(
      'FADROMA_DEVNET_CHAIN_ID', ()=>undefined),
    platform: this.getString(
      'FADROMA_DEVNET_PLATFORM', ()=>'scrt_1.8'),
    deleteOnExit: this.getFlag(
      'FADROMA_DEVNET_REMOVE_ON_EXIT', ()=>false),
    keepRunning: this.getFlag(
      'FADROMA_DEVNET_KEEP_RUNNING', ()=>true),
    host: this.getString(
      'FADROMA_DEVNET_HOST', ()=>undefined),
    port: this.getString(
      'FADROMA_DEVNET_PORT', ()=>undefined),
    podman: this.getFlag(
      'FADROMA_DEVNET_PODMAN', ()=>this.getFlag('FADROMA_PODMAN', ()=>false)),
    dontMountState: this.getFlag(
      'FADROMA_DEVNET_DONT_MOUNT_STATE', () => false)
  }

  /** @returns Devnet */
  getDevnet = (options: Partial<Devnet> = {}) =>
    new Devnet({ ...this.devnet, ...options })
}

export class Error extends BaseError {
  static Build:  typeof BuildError
  static Upload: typeof UploadError
  static Deploy: typeof DeployError
  static Devnet: typeof DevnetError
}

export class BuildError extends Error {}

export class UploadError extends Error {}

export class DeployError extends Error {
  static DeploymentAlreadyExists = this.define('DeploymentAlreadyExists', (name: string)=>
    `Deployment "${name}" already exists`)
  static DeploymentDoesNotExist = this.define('DeploymentDoesNotExist', (name: string)=>
    `Deployment "${name}" does not exist`)
}

export class DevnetError extends Error {
  static PortMode = this.define('PortMode',
    ()=>"Devnet#portMode must be either 'lcp' or 'grpcWeb'")
  static NoChainId = this.define('NoChainId',
    ()=>'Refusing to create directories for devnet with empty chain id')
  static NoContainerId = this.define('NoContainerId',
    ()=>'Missing container id in devnet state')
  static ContainerNotSet = this.define('ContainerNotSet',
    ()=>'Devnet#container is not set')
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
      self.warn(`deployment store does not exist`),
    warnOverridingStore: (x: string) =>
      self.warn(`overriding store for ${x}`),
    warnNoAgent: (name?: string) =>
      self.warn('no agent. authenticate by exporting FADROMA_MNEMONIC in your shell'),

  }))(this)

  devnet = ((self: Console)=>({

    loadingState: (chainId1: string, chainId2: string) =>
      self.info(`Loading state of ${chainId1} into Devnet with id ${chainId2}`),
    loadingFailed: (path: string) =>
      self.warn(`Failed to load devnet state from ${path}. Deleting it.`),
    loadingRejected: (path: string) =>
      self.log(`${path} does not exist.`),
    isNowRunning: ({ chainId, containerId, port }: Partial<Devnet>) => self
      .info(`running on port`, bold(String(port)))
      .info(`from container`, bold(containerId?.slice(0,8)))
      .info('manual reset with:').info(`$`,
        `docker kill`, containerId?.slice(0,8), `&&`,
        `docker rm`, containerId?.slice(0,8), `&&`,
        `sudo rm -rf state/${chainId??'fadroma-devnet'}`)

  }))(this)

}
