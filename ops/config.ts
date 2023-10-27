/**
  Fadroma: copyright (C) 2023 Hack.bg, licensed under GNU AGPLv3 or exception.
  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/
import { Devnet } from './devnet'
import type { DevnetPlatform } from './devnet'

import {
  Deployment as BaseDeployment,
  Error, Builder, ConnectConfig, UploadStore, DeployStore,
} from '@fadroma/connect'
import type { Environment, Class, DeployStoreClass, DeploymentClass } from '@fadroma/connect'

import $, { JSONFile } from '@hackbg/file'
import type { Path } from '@hackbg/file'

import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Path to this package. Used to find the build script, dockerfile, etc.
  * WARNING: Keep the ts-ignore otherwise it might break at publishing the package. */
export const thisPackage =
  //@ts-ignore
  dirname(dirname(fileURLToPath(import.meta.url)))

export const { version } =
  $(thisPackage, 'package.json').as(JSONFile)
    .load() as { version: string }

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
      'FADROMA_BUILD_PODMAN', () =>
        this.getFlag('FADROMA_PODMAN', ()=>false)),
    /** Path to Docker API endpoint. */
    dockerSocket: this.getString(
      'FADROMA_DOCKER', ()=>'/var/run/docker.sock'),
    /** Docker image to use for dockerized builds. */
    dockerImage: this.getString(
      'FADROMA_BUILD_IMAGE', ()=>'ghcr.io/hackbg/fadroma:master'),
    /** Dockerfile to build the build image if not downloadable. */
    dockerfile: this.getString(
      'FADROMA_BUILD_DOCKERFILE', ()=>$(thisPackage).at('Dockerfile').path),
    /** Owner uid that is set on build artifacts. */
    outputUid: this.getString(
      'FADROMA_BUILD_UID', () => undefined),
    /** Owner gid that is set on build artifacts. */
    outputGid: this.getString(
      'FADROMA_BUILD_GID', () => undefined),
    /** Used for historical builds. */
    preferredRemote: this.getString(
      'FADROMA_PREFERRED_REMOTE', () => undefined),
    /** Used to authenticate Git in build container. */
    sshAuthSocket: this.getString(
      'SSH_AUTH_SOCK', () => undefined),
  }

  /** @returns the Builder class exposed by the config */
  get Builder () {
    return Builder.variants[this.build.raw ? 'Raw' : 'Container']
  }

  /** @returns a configured builder. */
  getBuilder (Builder?: Class<Builder, any>): Builder {
    return new (Builder ??= this.Builder)(this.build)
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

  getUploadStore () {
    return new UploadStore({})
  }

  /** Deploy options. */
  deploy = {

    /** Whether to generate unsigned transactions for manual multisig signing. */
    multisig: this.getFlag('FADROMA_MULTISIG',
      () => false),

    /** Directory to store the receipts for the deployed contracts. */
    storePath: this.getString('FADROMA_DEPLOY_STATE',
      () => this.chainId
        ? $(this.root).in('state').in(this.chainId).in('deploy').path
        : null),

    /** Which implementation of the receipt store to use. */
    format: this.getString('FADROMA_DEPLOY_FORMAT',
      () => 'v1') as DeploymentFormat

  }

  /** @returns DeployStoreClass selected by `this.deploy.format` (`FADROMA_DEPLOY_FORMAT`). */
  get DeployStore (): DeployStoreClass<DeployStore>|undefined {
    return DeployStore
  }

  /** @returns DeployStore or subclass instance */
  getDeployStore <T extends DeployStore> (
    DeployStore?: DeployStoreClass<T> = this.DeployStore
  ): T {
    return new DeployStore({})
    //DeployStore ??= this.DeployStore as DeployStoreClass<T>
    //if (!DeployStore) throw new Error.Missing.DeployStoreClass()
    //return new DeployStore(this.deploy.storePath)
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
    if (!args[0].chain) throw new Error.Missing.Chain()
    args[0].agent     ||= this.getAgent()
    args[0].builder   ||= this.getBuilder()
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
      'FADROMA_DEVNET_PLATFORM', ()=>'scrt_1.9'),
    deleteOnExit: this.getFlag(
      'FADROMA_DEVNET_REMOVE_ON_EXIT', ()=>false),
    keepRunning: this.getFlag(
      'FADROMA_DEVNET_KEEP_RUNNING', ()=>true),
    host: this.getString(
      'FADROMA_DEVNET_HOST', ()=>undefined),
    port: this.getString(
      'FADROMA_DEVNET_PORT', ()=>undefined),
    podman: this.getFlag(
      'FADROMA_DEVNET_PODMAN', ()=>
        this.getFlag('FADROMA_PODMAN', ()=>false)),
    dontMountState: this.getFlag(
      'FADROMA_DEVNET_DONT_MOUNT_STATE', ()=>false)
  }

  /** @returns Devnet */
  getDevnet = (options: Partial<Devnet> = {}) =>
    new Devnet({ ...this.devnet, ...options })

}

