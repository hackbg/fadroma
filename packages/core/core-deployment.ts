import { timestamp }                    from '@hackbg/konzola'
import { CommandContext }               from '@hackbg/komandi'
import { hide }                         from './core-fields'
import { ClientError, ClientConsole }   from './core-events'
import { defineDeploymentContractAPI }  from './core-deployment-contract'
import { defineDeploymentContractsAPI } from './core-deployment-contracts'
import type { Class }           from './core-fields'
import type { Agent }           from './core-agent'
import type { Chain }           from './core-chain'
import type { Builder }         from './core-build'
import type { Uploader }        from './core-upload'
import type { DeploymentState } from './core-deploy-store'

/** A set of interrelated contracts, deployed under the same prefix.
  * - Extend this class in client library to define how the contracts are found.
  * - Extend this class in deployer script to define how the contracts are deployed. */
export class Deployment extends CommandContext {
  log = new ClientConsole('Fadroma.Deployment')

  /** Name of deployment. Used as label prefix of deployed contracts. */
  name:        string          = timestamp()
  /** Mapping of names to contract instances. */
  state:       DeploymentState = {}
  /** Default Git ref from which contracts will be built if needed. */
  repository?: string          = undefined
  /** Default Cargo workspace from which contracts will be built if needed. */
  workspace?:  string          = undefined
  /** Default Git ref from which contracts will be built if needed. */
  revision?:   string          = 'HEAD'
  /** Build implementation. Contracts can't be built from source if this is missing. */
  builder?:    Builder
  /** Agent to use when deploying contracts. */
  agent?:      Agent
  /** Chain on which operations are executed. */
  chain?:      Chain
  /** Upload implementation. Contracts can't be uploaded if this is missing --
    * except by using `agent.upload` directly, which does not cache or log uploads. */
  uploader?:   Uploader

  constructor (options: Partial<Deployment> & any = {}) {
    super(options.name ?? 'Deployment')
    this.name      = options.name         ?? this.name
    this.state     = options.state        ?? this.state
    this.agent     = options.agent        ?? this.agent
    this.chain     = options.agent?.chain ?? options.chain ?? this.chain
    this.builder   = options.builder      ?? this.builder
    this.uploader  = options.uploader     ?? this.uploader
    this.workspace = options.workspace    ?? this.workspace
    this.revision  = options.revision     ?? this.revision
    this.log.name  = this.name ?? this.log.name
    hide(this, [
      'log', 'state', 'name', 'description', 'timestamp',
      'commandTree', 'currentCommand',
      'args', 'task', 'before'
    ])
    this.addCommand('status', 'show the status of this deployment', this.showStatus.bind(this))
  }

  get [Symbol.toStringTag]() {
    return `${this.name??'-'}`
  }

  /** Number of contracts in deployment. */
  get size (): number {
    return Object.keys(this.state).length
  }

  /** True if the chain is a devnet or mocknet */
  get devMode   (): boolean {
    return this.chain?.devMode   ?? false
  }

  /** = chain.isMainnet */
  get isMainnet (): boolean {
    return this.chain?.isMainnet ?? false
  }

  /** = chain.isTestnet */
  get isTestnet (): boolean {
    return this.chain?.isTestnet ?? false
  }

  /** = chain.isDevnet */
  get isDevnet  (): boolean {
    return this.chain?.isDevnet  ?? false
  }

  /** = chain.isMocknet */
  get isMocknet (): boolean {
    return this.chain?.isMocknet ?? false
  }

  /** Print the status of this deployment. */
  async showStatus () {
    this.log.deployment(this)
  }

  /** Specify a contract.
    * @returns a callable `ContractInstance` with the specified parameters. */
  contract  = defineDeploymentContractAPI(this)

  /** Specify multiple contracts.
    * @returns a callable collection of `ContractInstance`s with the specified parameters. */
  contracts = defineDeploymentContractAPI(this)

  /** Implemented by Deployer subclass in @fadroma/deploy
    * to allow saving deployment data to the DeployStore. */
  save () { /*nop*/ }

  /** Create an instance of `new ctor(this, ...args)` and attach it
    * to the command tree under `name`, with usage description `info`.
    * See the documentation of `interface Subsystem` for more info.
    * @returns an instance of `ctor` */
  subsystem <X extends Deployment>(
    name: string,
    info: string,
    ctor: Subsystem<X, typeof this>,
    ...args: unknown[]
  ): X {
    return this.attach(new ctor(this, ...args) as X, name, info)
  }

  attach <X extends Deployment> (
    inst: X,
    name: string = inst.constructor.name,
    info: string = `(undocumented)`,
  ) {
    const context = this
    Object.defineProperty(inst, 'name', {
      enumerable: true,
      get () { return context.name }
    })
    Object.defineProperty(inst, 'state', {
      get () { return context.state }
    })
    Object.defineProperty(inst, 'save', {
      get () { return context.save.bind(context) }
    })
    this.addCommands(name, info, inst as any) // TODO
    return inst
  }

}

export class VersionedDeployment<V> extends Deployment {
  constructor (
    options: object = {},
    public version: V|undefined = (options as any)?.version
  ) {
    super(options as Partial<Deployment>)
    if (!this.version) throw new ClientError.NoVersion(this.constructor.name)
  }
}

/** A Subsystem is any class which extends Deployment (thus being able to manage Contracts),
  * and whose constructor takes a Deployer as first argument, as well as any number of
  * other arguments. This interface can be used to connect the main project class to individual
  * deployer classes for different parts of the project, enabling them to operate in the same
  * context (chain, agent, builder, uploader, etc). */
export interface Subsystem<D extends Deployment, E extends Deployment> extends Class<D, [
  E, ...unknown[]
]> {}
