import Error   from './Error'
import Console from './Console'

import type { Chain } from './Chain'

import { assertAgent } from './Agent'
import type { Agent } from './Agent'

import type { Client, ClientClass } from './Client'

import { buildMany } from './Build'
import type { Builder } from './Build'

import { uploadMany } from './Upload'
import type { Uploader } from './Upload'

import { writeLabel } from './Labels'

import Template from './Template'
import type { Buildable, Uploadable } from './Template'

import { Contract, ContractGroup } from './Contract'
import type { AnyContract, Instantiable, Instantiated } from './Contract'

import { mapAsync, hideProperties, defineDefault, into, intoRecord, defineTask, call } from './Fields'
import type { Class, Many, Name, Named, IntoRecord } from './Fields'

import { timestamp }      from '@hackbg/logs'
import { CommandContext } from '@hackbg/cmds'
import type { Task }      from '@hackbg/task'

/** A constructor for a Deployment subclass. */
export interface DeploymentClass<D extends Deployment> extends Class<
  D, ConstructorParameters<typeof Deployment>
>{}

/** A set of interrelated contracts, deployed under the same prefix.
  * - Extend this class in client library to define how the contracts are found.
  * - Extend this class in deployer script to define how the contracts are deployed. */
export class Deployment {

  constructor (options: Partial<Deployment> = {}) {
    const name = options.name ?? timestamp()
    //super(name)
    this.name = name
    this.log.label = this.name ?? this.log.label
    this.state     ??= options.state ?? {}
    this.agent     ??= options.agent
    this.chain     ??= options.chain ?? options.agent?.chain
    this.builder   ??= options.builder
    this.uploader  ??= options.uploader
    this.workspace ??= options.workspace
    this.revision  ??= options.revision
    this.state     ??= {}

    // Hide non-essential properties
    hideProperties(this, ...[
      'args',
      'before',
      'commandTree',
      'currentCommand',
      'description',
      'log',
      'name',
      'state',
      'task',
      'timestamp',
    ])
  }

  log = new Console(this.constructor.name)

  /** Name of deployment. Used as label prefix of deployed contracts. */
  name:        string

  /** Mapping of contract names to contract instances. */
  state:       Record<string, AnyContract>

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

  get [Symbol.toStringTag]() {
    return `${this.name??'-'}`
  }

  /** Print the status of this deployment. */
  async showStatus () {
    this.log.deployment(this)
  }

  /** @returns the number of contracts in this deployment */
  get size (): number {
    return Object.keys(this.state).length
  }

  /** @returns true if the chain is a devnet or mocknet */
  get devMode (): boolean {
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

  /** Specify a contract.
    * @returns a callable instance of `Contract` bearing the specified parameters.
    * Calling it will deploy the contract, or retrieve it if already deployed. */
  contract <C extends Client> (
    /** Parameters of the contract. */
    opts: Partial<Contract<C>> = {}
  ): Contract<C> {
    if (opts.name && this.hasContract(opts.name)) {
      return this.getContract(opts.name, opts.client) as unknown as Contract<C>
    }
    return this.addContract(opts.name!, this.defineContract(opts))
  }

  /** Define a contract without adding it to the state.
    * @returns a Contract object belonging to this Deployment. */
  defineContract <C extends Client> (opts: Partial<Contract<C>> = {}): Contract<C> {
    return new Contract({
      workspace: this.config?.build?.project,
      revision:  this.revision ?? 'HEAD',
      agent:     this.agent,
      builder:   this.builder,
      uploader:  this.uploader,
      ...opts,
      prefix:    this.name,
      context:   this
    })
  }

  /** Check if the deployment contains a contract with a certain name.
    * @returns boolean */
  hasContract (name: Name): boolean {
    return !!(this.state||{})[name]
  }

  /** Get the Contract corresponding to a given name.
    * If the data is not a Contract instance, converts it internally to a Contract
    * @returns Contract */
  getContract <C extends Client> (name: Name, client?: ClientClass<C>) {
    let state = this.state[name] || {}
    if (state instanceof Contract) {
      return state
    } else {
      return this.state[name] = this.defineContract({
        ...this.state[name], name, client
      }) as unknown as AnyContract
    }
  }

  /** Find the first contract that matches the passed filter function.
    * @returns Contract or null */
  findContract <C extends Client> (
    predicate: (meta: AnyContract) => boolean = (x) => true
  ): Contract<C>|null {
    return this.findContracts<C>(predicate)[0]
  }

  /** Find all contracts that match the passed filter function.
    * @returns Array<Contract> */
  findContracts <C extends Client> (
    predicate: (meta: AnyContract) => boolean = (x) => true
  ): Contract<C>[] {
    return Object.values(this.state).filter(
      contract=>predicate(contract!)
    ) as unknown as Contract<C>[]
  }

  /** Set the Contract corresponding to a given name,
    * attaching it to this deployment. =
    * @returns the passed Contract */
  addContract <C extends Client> (id: Name, contract: Contract<C>) {
    this.state[id] = contract as unknown as AnyContract
    this.save()
    return contract
  }

  /** Throw if a contract with the specified name is not found in this deployment.
    * @returns the Contract instance, if present */
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

  /** Specify a contract template.
    * @returns a callable instance of `Template` bearing the specified parameters.
    * Calling it will build and upload the template. */
  template <C extends Client> (
    opts: Partial<Template<C>> = {}
  ): Template<C> {
    return new Template({
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
  subsystem <D extends Deployment>(
    name: string,
    info: string,
    $D: Subsystem<D, any>,
    ...args: unknown[]
  ): D {
    const inst: D = new $D(this, ...args)
    return this.attach(inst, name, info)
  }

  /** Create and attach a subsystem of class $D for each pair of version and configuration.
    * @returns Record<Version, T> */
  versioned <D extends Deployment, Version extends string, Config extends { version: Version }> (
    $D:      Class<D, [this, Config]>,
    configs: Record<Version, Config>
  ): Record<Version, D> {
    const versions: Partial<Record<Version, D>> = {}
    // Instantiate a deployment for each version
    for (let [version, config] of Object.entries(configs) as [Version, Config][]) {
      // Copy the passed config
      config = { ...config }
      // Set the version if missing
      config.version ??= version
      // Create an instance of $D with this config
      versions[version] = new $D(this, config)
    }
    return versions as Record<Version, D>
  }

  /** Attach another deployment to this one.
    * @returns the attached deployment */
  attach <X extends Deployment> (
    inst: X,
    name: string = inst.constructor.name,
    info: string = `(undocumented)`,
  ) {
    const context = this
    return Object.defineProperties(inst, {
      name:  { enumerable: true, get () { return context.name } },
      state: { get () { return context.state } },
      save:  { get () { return context.save.bind(context) } }
    })
    //return this.commands(name, info, inst as any) // TODO
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
    if (!this.version) throw new Error.NoVersion(this.constructor.name)
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
