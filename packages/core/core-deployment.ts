import { timestamp }      from '@hackbg/konzola'
import { CommandContext } from '@hackbg/komandi'
import type { Task }      from '@hackbg/komandi'

import { ClientError, ClientConsole } from './core-events'
import { hide, defineDefault } from './core-fields'
import { mapAsync } from './core-fields'
import { buildMany } from './core-build'
import { uploadMany } from './core-upload'
import { ClientError as Error, ClientConsole as Console } from './core-events'
import { assertAgent } from './core-agent'
import { defineContract } from './core-contract'
import { into, intoRecord, defineTask, call } from './core-fields'
import { writeLabel } from './core-labels'

import type {
  Contract, AnyContract, DeployContract, DeployAnyContract,
  Buildable, Uploadable, Instantiable, Instantiated
} from './core-contract'
import type { Agent } from './core-agent'
import type { Builder } from './core-build'
import type { Chain } from './core-chain'
import type { Class, Many, Name, Named, IntoRecord } from './core-fields'
import type { Client } from './core-client'
import type { Uploader } from './core-upload'

/** The collection of contracts that constitute a deployment. */
export type DeploymentState = Record<string, Task<DeployContract<any>, AnyContract>>

/** A constructor for a Deployment subclass. */
export interface DeploymentClass<D extends Deployment> extends Class<
  D, ConstructorParameters<typeof Deployment>
>{}

export async function defineDeployment <D extends Deployment> (
  options: Partial<D> = {},
  $D: DeploymentClass<D> = Deployment as DeploymentClass<D>
): Promise<D> {
  return new $D(options)
}

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

  constructor (context: Partial<Deployment> = {}) {
    super(context.name ?? 'Deployment')
    this.log.name  = this.name ?? this.log.name
    // These propertied are inherited by default
    for (const field of [
      'name', 'state', 'agent', 'chain', 'builder', 'uploader', 'workspace', 'revision'
    ]) {
      defineDefault(this, context, field as keyof Partial<Deployment>)
    }
    // Hidden properties
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

  /** Print the status of this deployment. */
  async showStatus () {
    this.log.deployment(this)
  }

  /** Number of contracts in deployment. */
  get size (): number {
    return Object.keys(this.state).length
  }

  /** @returns true if the chain is a devnet or mocknet */
  get devMode   (): boolean {
    return this.chain?.devMode   ?? false
  }

  /** @returns true if the chain is a mainnet */
  get isMainnet (): boolean {
    return this.chain?.isMainnet ?? false
  }

  /** @returns true if the chain is a testnet */
  get isTestnet (): boolean {
    return this.chain?.isTestnet ?? false
  }

  /** @returns true if the chain is a devnet */
  get isDevnet  (): boolean {
    return this.chain?.isDevnet  ?? false
  }

  /** @returns true if the chain is a mocknet */
  get isMocknet (): boolean {
    return this.chain?.isMocknet ?? false
  }

  config?: { build?: { project?: any } }

  /** Specify a contract.
    * @returns a callable `Contract` with the specified parameters. */
  defineContract <C extends Client> (
    /** Parameters of the contract. */
    opts: Partial<Contract<C>> = {}
  ): DeployContract<C> {
    opts.agent ??= this.agent
    if (opts.id && this.hasContract(opts.id)) {
      return this.getContract(opts.id)!.context!
    } else {
      const contract = defineContract({
        workspace: this.config?.build?.project,
        ...opts,
        prefix:  this.name,
        context: this
      })
      this.addContract(contract.name!, contract)
      return contract
    }
  }

  /** Specify a group of heterogeneous contracts.
    * @returns a callable key-value map of `Contract`s with the specified parameters. */
  defineContractGroup <A extends unknown[]> (
    /** Function that returns the contracts belonging to an instance of the group. */
    getContracts: (...args: A)=>Many<AnyContract>
  ): (...args: A) => ContractGroup<A> {
    return (...args: A) => new ContractGroup(this, getContracts(...args))
  }

  /** Check if the deployment contains a contract with a certain name. */
  hasContract (id: Name) {
    return !!this.state[id]
  }

  /** Get the Contract corresponding to a given name. */
  getContract (id: Name) {
    return this.state[id]
  }

  /** @returns one contracts from this contract's deployment which matches
    * this contract's properties, as well as an optional predicate function. */
  findContract <C extends Client> (
    predicate: (meta: Partial<Contract<C>>) => boolean = (x) => true
  ): Contract<C>|null {
    return this.findContracts(predicate)[0]
  }

  /** @returns all contracts from this contract's deployment
    * that match this contract's properties, as well as an optional predicate function. */
  findContracts <C extends Client> (
    predicate: (meta: Partial<Contract<C>>) => boolean = (x) => true
  ): Contract<C>[] {
    const contracts = Object.values(this.state).map(task=>task.context)
    return contracts.filter(contract=>predicate(contract!))
  }

  /** Set the Contract corresponding to a given name,
    * attaching it to this deployment. */
  addContract <C extends Client> (id: Name, contract: Contract<C>) {
    contract.context = this
    //defineDefault(contract, this, 'log')
    defineDefault(contract, this, 'agent')
    defineDefault(contract, this, 'builder')
    defineDefault(contract, this, 'uploader')
    defineDefault(contract, this, 'repository')
    defineDefault(contract, this, 'revision')
    defineDefault(contract, this, 'workspace')
    setPrefix(this.name)
    this.state[id] = contract
    this.save()
    return contract

    function setPrefix (value: string) {
      Object.defineProperty(contract, 'prefix', {
        enumerable: true,
        get () { return contract.context?.name },
        set (v: string) {
          if (v !== contract.context?.name) {
            contract.log!.warn(`BUG: Overriding prefix from "${contract.context?.name}" to "${v}"`)
          }
          setPrefix(v)
        }
      })
    }
  }

  /** Add multiple contracts to this deployment. */
  addContracts (contracts: AnyContract[]|Named<AnyContract>) {
    throw new Error('TODO')
    for (const [name, receipt] of Object.entries(contracts)) {
      this.state[name] = receipt
    }
    this.save()
    return this
  }

  /** Throw if a contract with the specified name is not found in this deployment. */
  expectContract (id: Name, message?: string) {
    message ??= `${id}: no such contract in deployment`
    if (!this.hasContract(id)) throw new Error(message)
    return this.getContract(id)
  }

  /** Compile multiple contracts. */
  buildContracts (contracts: (string|AnyContract)[]) {
    return buildMany(contracts as unknown as Buildable[], this)
  }

  /** Upload multiple contracts. */
  uploadContracts (contracts: AnyContract[]) {
    return uploadMany(contracts as unknown as Uploadable[], this)
  }

  /** Implemented by Deployer subclass in @fadroma/deploy
    * to allow saving deployment data to the DeployStore. */
  save () { /*nop*/ }

  /** Create an instance of `new ctor(this, ...args)` and attach it
    * to the command tree under `name`, with usage description `info`.
    * See the documentation of `interface Subsystem` for more info.
    * @returns an instance of `ctor` */
  defineSubsystem <X extends Deployment>(
    name: string,
    info: string,
    ctor: Subsystem<X, typeof this>,
    ...args: unknown[]
  ): X {
    return this.attachSubsystem(new ctor(this, ...args) as X, name, info)
  }

  attachSubsystem <X extends Deployment> (
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

type MatchPredicate =
  (meta: Partial<AnyContract>) => boolean|undefined

type DefineContracts<D extends Deployment> =
  (contracts: Many<AnyContract>) => Task<D, Many<Client>>

export class ContractGroup<A extends unknown[]> {

  constructor (
    public readonly context:   Deployment,
    public readonly contracts: Many<AnyContract>
  ) {}

  /** Deploy an instance of this contract group. */
  async deploy (...args: A) {
    await buildMany(Object.values(this.contracts) as unknown as Buildable[], this.context)
    await uploadMany(Object.values(this.contracts) as unknown as Uploadable[], this.context)
    return await mapAsync(this.contracts, (contract: AnyContract)=>contract.deployed)
  }

  /** Prepare multiple instances of this contract group for deployment. */
  many (instances: Many<A>) {
    /** Define a contract group corresponding to each member of `instances` */
    const groups = mapAsync(
      instances,
      defineContractGroup as unknown as (x:A[0])=>ContractGroup<A>
    )
    /** Deploy the specified contract groups. */
    return async function deployContractGroups (...args: A) {
      return await mapAsync(
        /** Reify the specified contract groups */
        await groups,
        /** Deploy each contract group. */
        function deployContractGroup (group: ContractGroup<A>) {
          return group.deploy(...args)
        }
      )
    }
    /** Defines a new contract group. */
    function defineContractGroup (...args: A) {
      return new ContractGroup(self, getContracts(...args))
    }
  }

}

/** This function attaches a contract representation object to a deployment.
  * This sets the contract prefix to the deployment name, and provides defaults. */
export function attachToDeployment <T extends { context?: Deployment, log?: { warn: Function } }> (
  self: T, context: Deployment
): T {


}
