import { timestamp }      from '@hackbg/logs'
import { CommandContext } from '@hackbg/cmds'
import type { Task }      from '@hackbg/task'

import { ClientError, ClientConsole } from './core-events'
import { hideProperties, defineDefault } from './core-fields'
import { mapAsync } from './core-fields'
import { buildMany } from './core-build'
import { uploadMany } from './core-upload'
import { ClientError as Error, ClientConsole as Console } from './core-events'
import { assertAgent } from './core-agent'
import { into, intoRecord, defineTask, call } from './core-fields'
import { writeLabel } from './core-labels'

import { Contract, ContractTemplate, ContractGroup } from './core-contract'
import type {
  AnyContract, Buildable, Uploadable, Instantiable, Instantiated
} from './core-contract'

import type { Agent } from './core-agent'
import type { Builder } from './core-build'
import type { Chain } from './core-chain'
import type { Class, Many, Name, Named, IntoRecord } from './core-fields'
import type { Client } from './core-client'
import type { Uploader } from './core-upload'

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
  /** Mapping of names to contract instances. */
  state:       Record<string, AnyContract> = {}
  /** Name of deployment. Used as label prefix of deployed contracts. */
  name:        string
  /** Default Git ref from which contracts will be built if needed. */
  repository?: string = undefined
  /** Default Cargo workspace from which contracts will be built if needed. */
  workspace?:  string = undefined
  /** Default Git ref from which contracts will be built if needed. */
  revision?:   string = 'HEAD'
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
    const name = context.name ?? timestamp()
    super(name)
    this.name = name
    this.log.label = this.name ?? this.log.label
    // These propertied are inherited by default
    for (const field of [
      'name', 'state', 'agent', 'chain', 'builder', 'uploader', 'workspace', 'revision'
    ]) {
      defineDefault(this, context, field as keyof Partial<Deployment>)
    }
    // Hidden properties
    hideProperties(this, ...[
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

  config?: { build?: { project?: any } } & any // FIXME

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
    predicate: (meta: AnyContract) => boolean = (x) => true
  ): Contract<C>|null {
    return this.findContracts<C>(predicate)[0]
  }

  /** @returns all contracts from this contract's deployment
    * that match this contract's properties, as well as an optional predicate function. */
  findContracts <C extends Client> (
    predicate: (meta: AnyContract) => boolean = (x) => true
  ): Contract<C>[] {
    return Object.values(this.state)
      .filter(contract=>predicate(contract!)) as unknown as Contract<C>[]
  }

  /** Set the Contract corresponding to a given name,
    * attaching it to this deployment. */
  addContract <C extends Client> (id: Name, contract: Contract<C>) {
    this.state[id] = contract as unknown as AnyContract
    this.save()
    return contract
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

  /** Specify a contract.
    * @returns a callable instance of `Contract` bearing the specified parameters.
    * Calling it will deploy the contract, or retrieve it if already deployed. */
  contract <C extends Client> (
    /** Parameters of the contract. */
    opts: Partial<Contract<C>> = {}
  ): Contract<C> {
    if (opts.name && this.hasContract(opts.name)) {
      return this.getContract(opts.name) as unknown as Contract<C>
    }
    return this.addContract(opts.name!, new Contract({
      workspace: this.config?.build?.project,
      revision:  this.revision ?? 'HEAD',
      agent:     this.agent,
      ...opts,
      prefix:    this.name,
      context:   this
    }))
  }

  /** Specify a contract template.
    * @returns a callable instance of `ContractTemplate` bearing the specified parameters.
    * Calling it will build and upload the template. */
  template <C extends Client> (
    opts: Partial<ContractTemplate<C>> = {}
  ): ContractTemplate<C> {
    return new ContractTemplate({
      workspace: this.config?.build?.project,
      revision:  this.revision ?? 'HEAD',
      ...opts,
      context:   this
    })
  }

  /** Specify a group of heterogeneous contracts.
    * @returns a callable instance of `ContractGroup` containing the specified contracts.
    * Calling it will deploy the contained contracts. */
  group <A extends unknown[]> (
    /** Function that returns the contracts belonging to an instance of the group. */
    getContracts: (...args: A)=>Many<AnyContract>
  ): ContractGroup<A> {
    return new ContractGroup(this, getContracts)
  }

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

  /** Implemented by Deployer subclass in @fadroma/deploy
    * to allow saving deployment data to the DeployStore. */
  save () { /*nop*/ }

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
