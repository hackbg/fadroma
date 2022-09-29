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
  /** Create a new populated Deployer, with the specified DeployStore.
    * @returns Deployer */
  async getDeployer <D extends Deployer> (
    $D: DeployerClass<D> = Deployer as DeployerClass<D>
  ): Promise<Deployer> {
    const { chain, agent } = await super.getConnector()
    if (!chain) throw new Error('Missing chain')
    if (!this.DeployStore) throw new Error('Missing deployment store constructor')
    const uploader = new FSUploader(agent, this.uploads)
    const defaults = { chain, agent: agent??undefined/*l8r*/, uploader }
    const store    = new this.DeployStore(defaults, this.deploys)
    const name     = store.active?.name
    const state    = store.active?.state
    return new $D({ config: this, agent, uploader, store, name, state })
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
    if (store && store.active?.name) options.name = store.active.name
    super(options as Partial<Connector>)
    this.config = new DeployConfig(this.env, this.cwd, options.config)
    this.store  = options.store ?? this.store
    Object.defineProperty(this, 'log', { enumerable: false, writable: true })
  }
  /** Logger. */
  log = new DeployConsole('Fadroma Deploy')
  /** Configuration. */
  config: DeployConfig
  /** Where the receipts are stored. */
  store?: DeployStore
  /** Throws is deployment store is missing. */
  private expectStore (): DeployStore {
    if (!this.store) {
      throw new Error('Deployment store not found')
    }
    return this.store
  }
  save () {
    const store = this.expectStore()
    //this.log.log('Saving:  ', bold(this.name))
    //this.log.log(Object.keys(this.state).join(', '))
    //this.log.br()
    store.set(this.name, this.state)
  }
  /** Path to root of project directory. */
  get project (): Path|undefined {
    return this.config?.project ? $(this.config.project) : undefined
  }
  /** Currently selected deployment. */
  //get deployment (): Deployment|null { return this.store?.active || null }
  /** Print a list of deployments on the selected chain. */
  listDeployments = this.command('deployments', `print a list of all deployments on this chain`,
    (): DeployStore => {
      const store = this.expectStore()
      this.log.deploymentList(this.chain?.id??'(unspecified)', store)
      return store
    })
  /** Create a new deployment and add it to the command context. */
  createDeployment = this.command('create', `create a new empty deployment on this chain`,
    async (name: string = this.timestamp): Promise<void> => {
      const store = this.expectStore()
      await store.create(name)
      await this.selectDeployment(name)
    })
  /** Make a new deployment the active one. */
  selectDeployment = this.command('switch', `select another deployment on this chain`,
    async (id?: string): Promise<void> => {
      const store = this.expectStore()
      const list = store.list()
      if (list.length < 1) {
        this.log.info('No deployments.')
      }
      if (id) {
        const { name, state } = await store.select(id)
        this.name  = name
        this.state = state
      }
    })
  /** Print the contracts contained in a of a deployment. */
  listContracts = this.command('contracts', 'show the contracts in the current deployment',
    async (id?: string): Promise<void> => {
      const store = this.expectStore()
      const deployment  = id ? store.get(id) : store.active
      if (deployment) {
        this.log.deployment({ deployment })
      } else {
        this.log.info('No selected deployment.')
      }
    })
}
