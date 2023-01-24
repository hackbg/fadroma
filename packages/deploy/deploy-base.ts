import { bold } from '@hackbg/logs'
import $, { JSONFile } from '@hackbg/file'
import type { Path } from '@hackbg/file'
import { EnvConfig } from '@hackbg/conf'
import type { Env } from '@hackbg/conf'

import { Connector, ConnectConfig } from '@fadroma/connect'
import { Chain, Agent, Deployment, Uploader, DeployStore, override } from '@fadroma/core'
import type {
  Class, Client, Contract, DeploymentFormat, DeployStoreClass, UploaderClass
} from '@fadroma/core'

import { FSUploader } from './upload'
import { DeployError, DeployConsole } from './deploy-events'

/** Deployment system configuration and Deployer factory. */
export class DeployConfig extends ConnectConfig {
  constructor (
    defaults: Partial<DeployConfig> = {},
    readonly env: Env    = process.env,
    readonly cwd: string = process.cwd(),
  ) {
    super(defaults as Partial<ConnectConfig>, env ?? process.env, cwd ?? process.cwd())
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
    () => $(this.project).in('dist').in('receipts').in(this.chainId).in('uploads').path)
  /** Directory to store the receipts for the deployed contracts. */
  deploys:  string  = this.getString ('FADROMA_DEPLOY_STATE',
    () => $(this.project).in('dist').in('receipts').in(this.chainId).in('deployments').path)
  /** Which implementation of the receipt store to use. */
  deploymentFormat  = this.getString('FADROMA_DEPLOY_STORE', () => 'YAML1') as DeploymentFormat
  /** The deploy receipt store implementation selected by `deploymentFormat`. */
  get DeployStore (): DeployStoreClass<DeployStore>|undefined {
    return DeployStore.variants[this.deploymentFormat]
  }
  async getDeployStore <S extends DeployStore> (
    $S: DeployStoreClass<S>|undefined = this.DeployStore as DeployStoreClass<S>
  ): Promise<S> {
    if (!$S) throw new Error('Missing deployment store constructor')
    return new $S(this.deploys)
  }
  /** Create a new populated Deployer, with the specified DeployStore.
    * @returns Deployer */
  async getDeployer <C extends Deployer, D extends DeployerClass<C>> (
    $D: D = Deployer as D, ...args: ConstructorParameters<D>
  ): Promise<C> {
    const { chain, agent } = await this.getConnector()
    const uploader = agent!.getUploader(FSUploader)
    const store = await this.getDeployStore()
    store.defaults.agent    = agent!
    store.defaults.chain    = chain!
    store.defaults.uploader = uploader
    if (!chain) throw new Error('Missing chain')
    args[0] = { config: this, agent, uploader, store, ...args[0] }
    //@ts-ignore
    const deployer = new $D(...args)
    return deployer as unknown as C
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
  constructor (
    options: Partial<Deployer> = { config: new DeployConfig() }
  ) {
    const { store } = options
    if (store && store.active?.name) options.name = store.active.name
    super(options as Partial<Connector>)
    this.config = new DeployConfig(options.config, this.env, this.cwd)
    this.store  = options.store ?? this.store
    Object.defineProperty(this, 'log', { enumerable: false, writable: true })
    const chain = this.chain?.id ? bold(this.chain.id) : 'this chain'
    const name  = this.name ? bold(this.name) : 'this deployment'
    this
      .addCommand('deployments', `print a list of all deployments on ${chain}`,
                  this.listDeployments.bind(this))
      .addCommand('create',      `create a new empty deployment on ${chain}`,
                  this.createDeployment.bind(this))
      .addCommand('switch',      `activate another deployment on ${chain}`,
                  this.selectDeployment.bind(this))
      .addCommand('status',      `list all contracts in ${name}`,
                  this.listContracts.bind(this))
      .addCommand('export',      `export current deployment to ${name}.json`,
                  this.exportContracts.bind(this))
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
        this.log.warnOverridingStore(self)
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
    if (this.chain && !this.chain.isMocknet) {
      const store = await this.provideStore()
      this.log.saving(this.name, this.state)
      store.set(this.name, this.state)
    }
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
  /** Set a deployment as active for this deployer. */
  async selectDeployment (id?: string): Promise<Deployer> {
    const store = await this.provideStore()
    const list  = store.list()
    if (list.length < 1) {
      throw new Error('No deployments in this store')
    }
    let deployment
    if (id) {
      deployment = await store.select(id)
    } else if (store.active) {
      deployment = store.active
    } else {
      throw new Error('No active deployment in this store and no name passed')
    }
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
      this.log.deployment(deployment)
    } else {
      this.log.info('No selected deployment.')
    }
  }
  async exportContracts (path?: string) {
    const deployment = (await this.provideStore()).active
    if (!deployment) throw new DeployError.NoDeployment()
    const state: Record<string, any> = JSON.parse(JSON.stringify(deployment.state))
    for (const [name, contract] of Object.entries(state)) {
      delete contract.workspace
      delete contract.artifact
      delete contract.log
      delete contract.initMsg
      delete contract.builderId
      delete contract.uploaderId
    }
    const file = $(path??'').at(`${deployment.name}.json`).as(JSONFile<typeof state>)
    file.save(state)
    this.log.info('Wrote', Object.keys(state).length, 'contracts to', bold(file.shortPath))
    this.log.br()
  }
}
