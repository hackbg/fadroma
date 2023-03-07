import DeployConfig     from './DeployConfig'
import DeployConsole    from './DeployConsole'
import DeployerCommands from './DeployerCommands'
import DeployError      from './DeployError'

import type { Class, Deployment, DeployStore } from '@fadroma/core'
import { Connector } from '@fadroma/connect'

import $, { JSONFile, Path } from '@hackbg/file'
import type { CommandContext } from '@hackbg/cmds'
import { bold, timestamp } from '@hackbg/logs'

/** A deployment with associated agent and storage.
  * Can switch to another set of receipts to represent
  * another group of contracts with the same relations. */
export default class Deployer extends Connector {

  constructor (
    options: Partial<Deployer> = { config: new DeployConfig() }
  ) {
    const { store } = options
    if (store && store.active?.name) options.name = store.active.name
    super(options as Partial<Connector>)
    this.config   = new DeployConfig(options.config)
    this.store    = options.store    ?? this.store
    this.agent    = options.agent    ?? this.agent
    this.chain    = options.chain    ?? this.chain
    this.builder  = options.builder  ?? this.builder
    this.uploader = options.uploader ?? this.uploader
    Object.defineProperty(this, 'log', { enumerable: false, writable: true })
    const chain = this.chain?.id ? bold(this.chain.id) : 'this chain'
    const name  = this.name ? bold(this.name) : 'this deployment'
    //this.addCommands(
      //'deployment',
      //'manage deployments' + (this.name ? ` (current: ${bold(this.name)})` : ''),
      //new DeployerCommands(this) as CommandContext
    //)
  }

  /** Logger. */
  log = new DeployConsole(`@fadroma/deploy: ${this.name??this.constructor.name}`)

  /** Override this to set your project name. */
  projectName: string = 'Fadroma'

  /** Configuration. */
  config: DeployConfig

  /** Where the receipts are stored. */
  store?: DeployStore

  /** @throws if deployment store is missing. */
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

  /** Save current deployment state to deploy store. */
  async save () {
    if (this.chain && !this.chain.isMocknet) {
      const store = await this.provideStore()
      this.log.saving(this.name, this.state)
      store.set(this.name, this.state)
    }
  }

  /** Path to root of project directory. */
  get project (): Path|undefined {
    if (typeof this.config.project !== 'string') {
      return undefined
    }
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
  async createDeployment (name: string = timestamp()): Promise<Deployer> {
    const store = this.store ??= await this.config.getDeployStore()
    await store.create(name)
    return await this.selectDeployment(name)
  }

  /** Set a deployment as active for this deployer. */
  async selectDeployment (id?: string): Promise<Deployer> {
    const store = await this.provideStore()
    const list = store.list()
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
    const store = await this.provideStore()
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

  /** Print the status of this deployment. */
  async showStatus () {
    const store = await this.provideStore()
    console.log({store})
    const deployment = store.active
    if (!deployment) throw new DeployError.NoDeployment()
    this.log.deployment(this as Deployer)
  }

}

/** Constructor for a subclass of Deployer that
  * maintains the original constructor signature. */
export interface DeployerClass<D extends Deployer> extends Class<D, [
  Partial<Deployer>
]>{}
