import { bold } from '@hackbg/konzola'
import $ from '@hackbg/kabinet'
import type { Path } from '@hackbg/kabinet'
import { EnvConfig } from '@hackbg/konfizi'
import type { Env } from '@hackbg/konfizi'

import { Connector, ConnectConfig } from '@fadroma/connect'
import { Chain, Agent, Deployment, Uploader, override } from '@fadroma/client'
import type { Class } from '@fadroma/client'

import { FSUploader } from './upload'
import { DeployConsole } from './deploy-events'

/** Deployment system configuration and Deployer factory. */
export class DeployConfig extends ConnectConfig {
  constructor (
    readonly env: Env = {},
    readonly cwd: string = '',
    defaults: Partial<DeployConfig> = {}
  ) {
    super(env, cwd, defaults as Partial<ConnectConfig>)
    this.override(defaults)
  }
  /** Project root. Defaults to current working directory. */
  project:  string  = this.getString ('FADROMA_PROJECT',  () => this.cwd)
  /** Whether to generate unsigned transactions for manual multisig signing. */
  multisig: boolean = this.getBoolean('FADROMA_MULTISIG', () => false)
  /** Whether to always upload contracts, ignoring upload receipts that match. */
  reupload: boolean = this.getBoolean('FADROMA_REUPLOAD', () => false)
  /** Directory to store the receipts for the deployed contracts. */
  uploads:  string  = this.getString ('FADROMA_UPLOAD_STATE',
    () => $(this.project).in('receipts').in(this.chainId).in('uploads').path)
  /** Directory to store the receipts for the deployed contracts. */
  deploys:  string  = this.getString ('FADROMA_DEPLOY_STATE',
    () => $(this.project).in('receipts').in(this.chainId).in('deployments').path)
  /** Which implementation of the receipt store to use. */
  deploymentFormat  = this.getString('FADROMA_DEPLOY_STORE', () => 'YAML1') as DeploymentFormat
  /** The deploy receipt store implementation selected by `deploymentFormat`. */
  get DeployStore (): DeployStoreClass<DeployStore>|undefined {
    return DeployStore.variants[this.deploymentFormat]
  }
  /** Create a new populated Deployer, with the specified DeployStore.
    * @returns Deployer */
  async getDeployer <D extends Deployer> (
    $D: DeployerClass<D> = Deployer as DeployerClass<D>
  ): Promise<Deployer> {
    const { chain, agent } = await super.getConnector()
    if (!chain) throw new Error('Missing chain')
    if (!this.DeployStore) throw new Error('Missing deployment store constructor')
    const uploader    = new FSUploader(agent, this.uploads)
    const defaults    = { chain, agent: agent??undefined/*l8r*/, uploader }
    const deployments = new this.DeployStore(this.deploys, defaults)
    return new Deployer(this, agent, chain, deployments, uploader)
  }
}

/** Constructor for a subclass of Deployer that
  * maintains the original constructor signature. */
export interface DeployerClass<D extends Deployer> extends Class<D, [
  Partial<DeployConfig>, Agent?, Chain?, DeployStore?, Uploader?
]>{}

/** A deployment with associated agent and storage.
  * Can switch to another set of receipts to represent
  * another group of contracts with the same relations. */
export class Deployer extends Connector {
  constructor (
    /** A whole DeployConfig object, or just relevant options. */
    config:             Partial<DeployConfig> = new DeployConfig(),
    /** Agent to identify as. */
    public agent:       Agent|undefined       = undefined,
    /** Chain to connect to. */
    public chain:       Chain|undefined       = agent?.chain,
    /** Contains available deployments for the current chain. */
    public deployments: DeployStore|undefined = undefined,
    /** Implements uploading and upload reuse. */
    public uploader:    Uploader|undefined    = undefined,
  ) {
    super(config, agent, chain)
    this.config = new DeployConfig(this.env, this.cwd, config)
    Object.defineProperty(this, 'log', { enumerable: false, writable: true })
  }
  /** Logger. */
  log = new DeployConsole('Fadroma Deploy')
  /** Configuration. */
  config: DeployConfig
  /** Path to root of project directory. */
  get project (): Path|undefined {
    return this.config?.project ? $(this.config.project) : undefined
  }
  /** Currently selected deployment. */
  //get deployment (): Deployment|null { return this.deployments?.active || null }
  /** Print a list of deployments on the selected chain. */
  list = this.command('deployments', `print a list of all deployments on this chain`,
    (): DeployStore => {
      const deployments = this.expectStore()
      this.log.deploymentList(this.chain?.id??'(unspecified)', deployments)
      return deployments
    })
  /** Make a new deployment the active one. */
  select = this.command('select', `select another deployment on this chain`,
    async (id?: string): Promise<void> => {
      const deployments = this.expectStore()
      const list = deployments.list()
      if (list.length < 1) {
        this.log.info('\nNo deployments. Create one with `deploy new`')
      }
      if (id) {
        this.log.log(bold(`Selecting deployment:`), id)
        await deployments.select(id)
      }
      if (list.length > 0) {
        this.list()
      }
      if (deployments.active) {
        this.log.log(`Currently selected deployment:`, bold(deployments.active.name))
      } else {
        this.log.log(`No selected deployment.`)
      }
    })
  /** Create a new deployment and add it to the command context. */
  create = this.command('create', `create a new empty deployment on this chain`,
    async (name: string = this.timestamp): Promise<void> => {
      const deployments = this.expectStore()
      await deployments?.create(name)
      await deployments?.select(name)
    })
  /** Print the status of a deployment. */
  status = this.command('status', 'show the current deployment',
    async (id?: string): Promise<void> => {
      const deployments = this.expectStore()
      const deployment  = id ? deployments.get(id) : deployments.active
      if (deployment) {
        this.log.deployment({ deployment })
      } else {
        this.log.info('No selected deployment on chain:', bold(this.chain?.id??'(no chain)'))
      }
    })
  /** Throws is deployment store is missing. */
  private expectStore = (): DeployStore => {
    if (!(this.deployments instanceof DeployStore)) {
      //this.log.error('context.deployments was not populated')
      //this.log.log(context)
      throw new Error('Deployment strore not found')
    }
    return this.deployments
  }
}

/** We support several of those:
  *  - YAML1 is how the latest @fadroma/deploy stores data
  *  - YAML2 is how @aakamenov's custom Rust-based deployer stores data
  *  - JSON1 is the intended target format for the next major version;
  *    JSON can generally be parsed with fewer dependencies, and can be
  *    natively embedded in the API client library distribution,
  *    in order to enable a standard subset of receipt data
  *    (such as the up-to-date addresses and code hashes for your production deployment)
  *    to be delivered alongside your custom Client subclasses,
  *    making your API client immediately usable with no further steps necessary. */
export type DeploymentFormat = 'YAML1'|'YAML2'|'JSON1'

/** Mapping from deployment format ids to deployment store constructors. */
export type DeployStores = Partial<Record<DeploymentFormat, DeployStoreClass<DeployStore>>>

/** Constructor for the different varieties of DeployStore. */
export interface DeployStoreClass<D extends DeployStore> extends Class<D, [
  /** Path to where the receipts are stored. */
  string|Path,
  /** Defaults when creating Deployment instances from the store */
  Partial<Deployment>|undefined
]> {}

/** A deploy store collects receipts corresponding to individual instances of Deployment,
  * and can create Deployment objects with the data from the receipts. */ 
export abstract class DeployStore {
  /** Populated in deploy.ts with the constructor for each subclass. */
  static variants: DeployStores = {}
  /** Name of symlink marking active deployment. */
  KEY = '.active'
  /** Create a new deployment. */
  abstract create (name?: string): Promise<Deployment>
  /** Get a deployment by name, or null if such doesn't exist. */
  abstract get    (name: string):  Deployment|null
  /** Get the names of all stored deployments. */
  abstract list   ():              string[]
  /** Activate a new deployment, or throw if such doesn't exist. */
  abstract select (name: string):  Promise<Deployment>
  /** Get the active deployment, or null if there isn't one. */
  get active (): Deployment|null {
    return this.get(this.KEY)
  }
}
