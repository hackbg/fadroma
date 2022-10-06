import { bold } from '@hackbg/konzola'
import $ from '@hackbg/kabinet'
import type { Path } from '@hackbg/kabinet'
import { EnvConfig } from '@hackbg/konfizi'
import type { Env } from '@hackbg/konfizi'

import { Connector, ConnectConfig } from '@fadroma/connect'
import { Chain, Agent, Deployment, Uploader, DeployStore, override } from '@fadroma/client'
import type { Class, Client, Contract, DeploymentFormat, DeployStoreClass } from '@fadroma/client'

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
  async getDeployStore <D extends DeployStore> (
    $D: DeployStoreClass<D>|undefined = this.DeployStore as DeployStoreClass<D>
  ): Promise<D> {
    const { chain, agent } = await super.getConnector()
    if (!chain) throw new Error('Missing chain')
    const uploader = new FSUploader(agent, this.uploads)
    if (!$D) throw new Error('Missing deployment store constructor')
    return new $D(this.deploys, {
      chain,
      agent: agent??undefined/*l8r*/,
      uploader
    })
  }
  /** Create a new populated Deployer, with the specified DeployStore.
    * @returns Deployer */
  async getDeployer <D extends Deployer> (
    $D: DeployerClass<D> = Deployer as DeployerClass<D>
  ): Promise<D> {
    const store = await this.getDeployStore()
    const { chain, agent, uploader } = store.defaults
    if (!chain) throw new Error('Missing chain')
    const defaults = { chain, agent: agent??undefined/*l8r*/, uploader }
    return new $D({ config: this, agent, uploader, store })
  }
}

/** Constructor for a subclass of Deployer that
  * maintains the original constructor signature. */
export interface DeployerClass<D extends Deployer> extends Class<D, [
  Partial<Deployer>
]>{}

/** A deployment with associated agent and storage.
  * Can switch to another set of receipts to represent
  * another group of contracts with the same relations. */
export class Deployer extends Connector {
  constructor (options: Partial<Deployer> = { config: new DeployConfig() }) {
    const { store } = options
    super(options as Partial<Connector>)
    this.config = new DeployConfig(this.env, this.cwd, options.config)
    this.store  = options.store ?? this.store
    Object.defineProperty(this, 'log', { enumerable: false, writable: true })
    this
      .addCommand('deployments', 'print a list of all deployments on this chain',
                  this.listDeployments.bind(this))
      .addCommand('create', `create a new empty deployment on this chain`,
                  this.createDeployment.bind(this))
      .addCommand('switch', `select another deployment on this chain`,
                  this.selectDeployment.bind(this))
      .addCommand('contracts', 'show the contracts in the current deployment',
                  this.listContracts.bind(this))
  }
  /** Logger. */
  log = new DeployConsole('Fadroma Deploy')
  /** Configuration. */
  config: DeployConfig
  /** Where the receipts are stored. */
  store?: DeployStore
  /** Throws is deployment store is missing. */
  async provideStore (store?: DeployStore): Promise<DeployStore> {
    const self = `${this.constructor.name} ${this.name}`
    if (this.store) {
      if (store) {
        this.log.warn(`Overriding store for ${self}`)
      } else {
        // nop
      }
    } else {
      if (store) {
        this.store = store
      } else {
        this.store = await this.config.getDeployStore()
      }
    }
    if (!this.store) {
      throw new Error(`Could not provide deploy store for ${self}`) 
    }
    return this.store
  }
  async save () {
    const store = await this.provideStore()
    this.log.saving(this.name, this.state)
    store.set(this.name, this.state)
  }
  /** Path to root of project directory. */
  get project (): Path|undefined {
    if (typeof this.config.project !== 'string') return undefined
    return $(this.config.project)
  }
  /** Currently selected deployment. */
  //get deployment (): Deployment|null { return this.store?.active || null }
  /** Print a list of deployments on the selected chain. */
  async listDeployments (): Promise<DeployStore> {
    const store = await this.provideStore()
    this.log.deploymentList(this.chain?.id??'(unspecified)', store)
    return store
  }
  /** Create a new deployment and add it to the command context. */
  async createDeployment (name: string = this.timestamp): Promise<Deployer> {
    const store = this.store ??= await this.config.getDeployStore()
    await store.create(name)
    return await this.selectDeployment(name)
  }
  /** Make a new deployment the active one. */
  async selectDeployment (id: string): Promise<Deployer> {
    const store = await this.provideStore()
    const list  = store.list()
    if (list.length < 1) this.log.info('No deployments.')
    const deployment = await store.select(id)
    if (deployment) Object.assign(this, {
      name:  deployment.name,
      state: deployment.state
    })
    return this
  }
  /** Print the contracts contained in a deployment receipt. */
  async listContracts (id?: string): Promise<void> {
    const store      = await this.provideStore()
    const deployment = id ? store.get(id) : store.active
    if (deployment) {
      this.log.deployment({ deployment })
    } else {
      this.log.info('No selected deployment.')
    }
  }
}
