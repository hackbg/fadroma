import type { 
  Chain, Agent, ClientClass, Builder, Uploader, Buildable, Uploadable, Class, Many, Name, Named,
  IntoRecord, CodeId, CodeHash, Hashed, Address, TxHash, ChainId, Message, Into, Built, Uploaded,
  Label, ContractLink
} from '../index'
import {
  Error, Console, mapAsync, hideProperties, defineDefault, into, intoRecord, call,
  timestamp, override, map,
} from '../util'

import { assertAgent } from './Agent'
import { FetchUploader } from './Upload'
import { Client, assertAddress, codeHashOf, writeLabel } from './Client'
import { assertBuilder } from './Build'

export type DeploymentFormat = 'YAML1'|'YAML2'|'JSON1'

export type DeploymentState = Record<string, Partial<AnyContract>>

/** Constructor for the different varieties of DeployStore. */
export interface DeployStoreClass<D extends DeployStore> extends Class<D, [
  /** Defaults when hydrating Deployment instances from the store. */
  unknown,
  (Partial<Deployment>|undefined)?,
]> {}

/** Mapping from deployment format ids to deployment store constructors. */
export type DeployStores = Partial<Record<DeploymentFormat, DeployStoreClass<DeployStore>>>

/** A deploy store collects receipts corresponding to individual instances of Deployment,
  * and can create Deployment objects with the data from the receipts. */
export abstract class DeployStore {
  /** Populated in deploy.ts with the constructor for each subclass. */
  static variants: DeployStores = {}
  /** Get the names of all stored deployments. */
  abstract list (): string[]
  /** Get a deployment by name, or null if such doesn't exist. */
  abstract load (name: string): DeploymentState|null
  /** Update a deployment's data. */
  abstract save (name: string, state?: DeploymentState): void
  /** Create a new deployment. */
  abstract create (name?: string): Promise<DeploymentState>
  /** Activate a new deployment, or throw if such doesn't exist. */
  abstract select (name: string): Promise<DeploymentState>
  /** Get the active deployment, or null if there isn't one. */
  abstract get active (): DeploymentState|null

  defaults: Partial<Deployment> = {}

  /** Create a new Deployment, and populate with stored data.
    * @returns Deployer */
  getDeployment <D extends Deployment> (
    $D: DeploymentClass<D> = Deployment as DeploymentClass<D>,
    ...args: ConstructorParameters<typeof $D>
  ): D {
    // If a name of a deployment is provided, try to load
    // stored data about this deployment from this store.
    // Otherwise, start with a blank slate.
    const { name } = args[0] ??= {}
    const state = (name && this.load(name)) || {}
    // Create a deployment of the specified class.
    // If this is a subclass of Deployment that defines
    // contracts (using this.contract), the `state`
    // property will be populated.
    const deployment = new $D(...args)
    // Update properties of each named contract defined in
    // the deployment with those from the loaded data.
    // If such a named contract is missing, define it.
    for (const name of Object.keys(state)) {
      if (deployment.state[name]) {
        Object.assign(deployment.state[name], state[name])
      } else {
        deployment.contract(state[name])
      }
    }
    return deployment
  }
}

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
    this.log.label = `Deployment: ${this.name ?? this.log.label}`
    this.state     ??= options.state ?? {}
    this.agent     ??= options.agent
    this.chain     ??= options.chain ?? options.agent?.chain
    this.builder   ??= options.builder
    this.uploader  ??= options.uploader ?? new FetchUploader(this.agent)
    this.workspace ??= options.workspace ?? this.config?.build?.project
    this.revision  ??= options.revision
    this.store     ??= options.store

    // Hide non-essential properties
    hideProperties(this, ...[
      'args', 'before', 'commandTree', 'currentCommand', 'description',
      'log', 'name', 'state', 'task', 'timestamp',
    ])
  }

  log = new Console(this.constructor.name)

  /** Name of deployment. Used as label prefix of deployed contracts. */
  name:        string

  /** Mapping of contract names to contract instances. */
  state:       Record<string, AnyContract>

  /** Default state store to which updates to this deployment's state will be saved. */
  store?:      DeployStore

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

  async deploy () {
    const log = new Console(`Deploying: ${this.name}`)
    const contracts = Object.values(this.state)
    if (contracts.length > 0) {
      await Promise.all(contracts.map(contract=>contract.deployed))
      log.log('Deployed', contracts.length, 'contracts')
    } else {
      log.warn('No contracts defined in deployment')
    }
    // FIXME PERF: bundle concurrent inits into a single transaction
    return this
  }

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
      workspace: this.workspace,
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
    if (!this.builder) throw new Error.NoBuilder()
    return this.builder.buildMany(contracts as unknown as Buildable[])
  }

  /** Upload multiple contracts. */
  uploadContracts (contracts: AnyContract[]) {
    if (!this.uploader) throw new Error.NoBuilder()
    return this.uploader.uploadMany(contracts as unknown as Uploadable[])
  }

  /** Specify a contract template.
    * @returns a callable instance of `Template` bearing the specified parameters.
    * Calling it will build and upload the template. */
  template <C extends Client> (opts: Partial<Template<C>> = {}): Template<C> {
    return new Template({
      workspace: this.workspace,
      revision:  this.revision ?? 'HEAD',
      agent:     this.agent,
      builder:   this.builder,
      uploader:  this.uploader,
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
      name:  {
        enumerable: true, get () { return context.name }
      },
      state: {
        get () { return context.state }
      },
      save:  {
        get () { return context.save.bind(context) }
      }
    })
    //return this.commands(name, info, inst as any) // TODO
  }

  /** Save current deployment state to deploy store. */
  async save (store: DeployStore|undefined = this.store) {
    if (!store) {
      this.log.warnSaveNoStore(this.name)
      return
    }
    if (!this.chain) {
      this.log.warnSaveNoChain(this.name)
      return
    }
    if (this.chain.isMocknet) {
      this.log.warnNotSavingMocknet(this.name)
      return
    }
    this.log.saving(this.name, this.state)
    store.save(this.name, this.state)
  }

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

/** A Subsystem is any class which extends Deployment (thus being able to manage Contracts)
  * and takes a parent Deployment as first constructor argument (thus being an sub-Deployment).
  * Attached subsystems share the context of the parent Deployment. */
export interface Subsystem<D extends Deployment, E extends Deployment> extends Class<D, [
  E,           // parent deployment
  ...unknown[] // other arguments
]> {}

/** Callable object: contract template.
  * Can build and upload, but not instantiate.
  * Can produce deployable Contract instances. */
export class Template<C extends Client> {
  log = new Console(this.constructor.name)
  /** The Client subclass that exposes the contract's methods.
    * @default the base Client class. */
  client?:     ClientClass<C> = undefined
  /** The deployment that this template belongs to. */
  context?:    Deployment = undefined
  /** URL pointing to Git repository containing the source code. */
  repository?: string|URL = undefined
  /** Branch/tag pointing to the source commit. */
  revision?:   string     = undefined
  /** Whether there were any uncommitted changes at build time. */
  dirty?:      boolean    = undefined
  /** Path to local Cargo workspace. */
  workspace?:  string     = undefined
  /** Name of crate in workspace. */
  crate?:      string     = undefined
  /** List of crate features to enable during build. */
  features?:   string[]   = undefined
  /** Build procedure implementation. */
  builder?:    Builder    = undefined
  /** Builder implementation that produces a Contract from the Source. */
  builderId?:  string     = undefined
  /** URL to the compiled code. */
  artifact?:   string|URL = undefined
  /** Code hash uniquely identifying the compiled code. */
  codeHash?:   CodeHash   = undefined
  /** ID of chain on which this contract is uploaded. */
  chainId?:    ChainId    = undefined
  /** Object containing upload logic. */
  uploaderId?: string     = undefined
  /** Upload procedure implementation. */
  uploader?:   Uploader   = undefined
  /** Address of agent that performed the upload. */
  uploadBy?:   Address    = undefined
  /** TXID of transaction that performed the upload. */
  uploadTx?:   TxHash     = undefined
  /** Code ID representing the identity of the contract's code on a specific chain. */
  codeId?:     CodeId     = undefined
  /** The Agent instance that will be used to upload and instantiate the contract. */
  agent?:      Agent      = undefined

  constructor (options: Partial<Template<C>> = {}) {
    // FIXME: just write it out ... >_>
    this.define(options)
    if (this.context) {
      defineDefault(this, this.context, 'agent')
      defineDefault(this, this.context, 'builder')
      defineDefault(this, this.context, 'uploader')
      defineDefault(this, this.context, 'repository')
      defineDefault(this, this.context, 'revision')
      defineDefault(this, this.context, 'workspace')
    }
    hideProperties(this, 'log')
  }

  /** Provide parameters for an existing instance.
    * @returns mutated self */
  define (options: Partial<Template<C>> = {}): this {
    // FIXME: just write it out ... >_>
    return override(this, options as object)
  }

  get info (): string {
    let name = 'Template'
    if (this.crate || this.revision || this.codeId) {
      name += ': '
      if (this.crate)    name += `crate ${this.crate}`
      if (this.revision) name += `@ ${this.revision}`
      if (this.codeId)   name += `(code id ${this.codeId})`
    }
    return name
  }

  get compiled (): Promise<this & Built> {
    return this.build()
  }

  /** Compile the source using the selected builder.
    * @returns this */
  build (builder: Builder|undefined = this.builder): Promise<this & Built> {
    const name = `compile ${this.crate ?? 'contract'}`
    const building = new Promise<this & Built>(async (resolve, reject)=>{
      if (!this.artifact) {
        if (!this.crate) throw new Error.NoCrate()
        builder ??= assertBuilder(this)
        const result = await builder!.build(this as Buildable)
        this.define(result as Partial<this>)
      }
      return resolve(this as this & Built)
    })
    Object.defineProperty(this, 'compiled', { get () { return building } })
    return building
  }

  /** One-shot deployment task. */
  get uploaded (): Promise<this & Uploaded> {
    return this.upload()
  }

  /** Upload compiled source code to the selected chain.
    * @returns task performing the upload */
  upload (uploader: Uploader|undefined = this.uploader): Promise<this & Uploaded> {
    const name = `upload ${this.artifact ?? this.crate ?? 'contract'}`
    const uploading = new Promise<this & Uploaded>(async (resolve, reject)=>{
      if (!this.codeId) {
        await this.compiled
        if (!uploader) throw new Error.NoUploader()
        const result = await uploader.upload(this as Uploadable)
        this.define(result as Partial<this>)
      }
      return resolve(this as this & Uploaded)
    })
    Object.defineProperty(this, 'uploaded', { get () { return uploading } })
    return uploading
  }

  /** @returns a Contract representing a specific instance of this Template. */
  instance (options?: Partial<Contract<C>>): Contract<C> {
    // Use values from Template as defaults for Contract
    options = { ...this as unknown as Partial<Contract<C>>, ...options }
    // Create the Contract
    const instance: Contract<C> = this.context
      ? this.context.contract(options)
      : new Contract(options)
    return instance
  }

  /** Get a collection of multiple clients to instances of this contract.
    * @returns task for deploying multiple contracts, resolving to their clients */
  instances (contracts: Many<Partial<Contract<C>>>): Task<this, Many<Promise<C>>> {
    type Self = typeof this
    const size = Object.keys(contracts).length
    const name = (size === 1) ? `deploy contract` : `deploy ${size} contracts`
    const tasks = map(contracts, contract=>this.instance(contract))
    //return this.task(name, async function deployManyContracts (
      //this: Self
    //): Promise<Many<Promise<C>>> {
      //return map(tasks, (task: Partial<Contract<C>>): Promise<C> => task.deployed!)
    //})
  }

  get asInfo (): ContractInfo {
    return {
      id:        this.codeId!,
      code_hash: this.codeHash!
    }
  }

}

type Task<T, U> = void // FIXME

/** @returns the data for saving a build receipt. */
export function toBuildReceipt (s: Partial<Built>) {
  return {
    repository: s.repository,
    revision:   s.revision,
    dirty:      s.dirty,
    workspace:  s.workspace,
    crate:      s.crate,
    features:   s.features?.join(', '),
    builder:    undefined,
    builderId:  s.builder?.id,
    artifact:   s.artifact?.toString(),
    codeHash:   s.codeHash
  }
}

/** @returns the data for saving an upload receipt. */
export function toUploadReceipt (t: Partial<Uploaded>) {
  return {
    ...toBuildReceipt(t),
    chainId:    t.chainId,
    uploaderId: t.uploader?.id,
    uploader:   undefined,
    uploadBy:   t.uploadBy,
    uploadTx:   t.uploadTx,
    codeId:     t.codeId
  }
}

/** Objects that have an address and code id. */
export type IntoInfo = Hashed & {
  address: Address
}

/** Reference to an instantiated smart contract, to be used by contracts. */
export interface ContractInfo {
  readonly id:        CodeId
  readonly code_hash: CodeHash
}

/** Parameters involved in instantiating a contract */
export interface Instantiable {
  chainId:   ChainId
  codeId:    CodeId
  codeHash?: CodeHash
  label?:    Label
  prefix?:   Name
  name?:     Name
  suffix?:   Name
  initMsg:   Message
}

/** Result of instantiating a contract */
export interface Instantiated {
  chainId:  ChainId
  address:  Address
  codeHash: CodeHash
  label:    Label
  prefix?:  Name
  name?:    Name
  suffix?:  Name
  initBy?:  Address
  initTx?:  TxHash
}

export type AnyContract = Contract<Client>

function getClientTo <C extends Client> (contract: Contract<C>): C {
  const $C = (contract.client ?? Client)
  //@ts-ignore
  const client = new $C(contract.agent, contract.address, contract.codeHash, contract as Contract<C>)
  return client as unknown as C
}

/** Callable object: contract.
  * Can build and upload, and instantiate itself. */
export class Contract<C extends Client> extends Template<C> {
  log: Console
  /** Address of agent that performed the init tx. */
  initBy?:  Address        = undefined
  /** Address of agent that performed the init tx. */
  initMsg?: Into<Message>  = undefined
  /** TXID of transaction that performed the init. */
  initTx?:  TxHash         = undefined
  /** Address of this contract instance. Unique per chain. */
  address?: Address        = undefined
  /** Full label of the instance. Unique for a given Chain. */
  label?:   Label          = undefined
  /** Prefix of the instance label.
    * Identifies which Deployment the instance belongs to, if any.
    * Prepended to contract label with a `/`: `PREFIX/NAME...` */
  prefix?:  Name           = undefined
  /** Proper name of the instance. Unique within the deployment.
    * If the instance is not part of a Deployment, this is equal to the label.
    * If the instance is part of a Deployment, this is used as storage key.
    * You are encouraged to store application-specific versioning info in this field. */
  name?:    Name
  /** Deduplication suffix.
    * Appended to the contract label with a `+`: `...NAME+SUFFIX`.
    * This field has sometimes been used to redeploy an new instance
    * within the same Deployment, taking the place of the old one.
    * TODO: implement this field's semantics: last result of **alphanumeric** sort of suffixes
    *       is "the real one" (see https://stackoverflow.com/a/54427214. */
  suffix?:  Name           = undefined

  constructor (options: Partial<Contract<C>> = {}) {
    super({})
    const self = this
    if (options.name) setName(options.name)
    if (this.context) setPrefix(this.context.name)
    this.log = new Console(`Contract: ${this.name ?? new.target.name}`)
    this.agent      = this.context?.agent      ?? this.agent
    this.builder    = this.context?.builder    ?? this.builder
    this.uploader   = this.context?.uploader   ?? this.uploader
    this.repository = this.context?.repository ?? this.repository
    this.revision   = this.context?.revision   ?? this.revision
    this.workspace  = this.context?.workspace  ?? this.workspace
    override(this, options)
    hideProperties(this, 'log')

    function setName (value: Name) {
      Object.defineProperty(self, 'name', {
        enumerable: true,
        configurable: true,
        get () { return value },
        set (v: string) { setName(v) }
      })
    }

    function setPrefix (value: Name) {
      Object.defineProperty(self, 'prefix', {
        enumerable: true,
        configurable: true,
        get () { return self.context?.name },
        set (v: string) {
          if (v !== self.context?.name) {
            self.log!.warn(`BUG: Overriding prefix from "${self.context?.name}" to "${v}"`)
          }
          setPrefix(v)
        }
      })
    }

  }

  /** One-shot deployment task. After the first call, `deploy` redefines it
    * to return the self-same deploying promise. Call `deploy` again to reset. */
  get deployed (): Promise<C> {
    return this.deploy()
  }

  /** Deploy the contract, or retrieve it if it's already deployed.
    * @returns promise of instance of `this.client`  */
  deploy (initMsg: Into<Message>|undefined = this.initMsg): Promise<C> {
    const name = `deploy ${this.name ?? 'contract'}`
    const deploying = new Promise<C>(async (resolve, reject)=>{
      // If address is missing, deploy contract
      // FIXME also check in deploy store
      if (!this.address) {
        if (!this.name) throw new Error.CantInit_NoName()
        if (!this.agent) throw new Error.CantInit_NoAgent(this.name)
        if (!this.initMsg) throw new Error.CantInit_NoMessage(this.name)
        // Construct the full unique label of the contract
        this.label = writeLabel(this)
        if (!this.label) throw new Error.CantInit_NoLabel(this.name)
        // Resolve the provided init message
        this.initMsg ??= await into(initMsg) as Message
        // Make sure the code is compiled and uploaded
        await this.uploaded
        if (!this.codeId) throw new Error.CantInit_NoCodeId(this.name)
        this.log?.beforeDeploy(this, this.label!)
        // Perform the instantiation transaction
        const instance = await this.agent!.instantiate(this)
        // Populate self with result of instantiation (address)
        override(this as Contract<C>, instance)
        this.log?.afterDeploy(this as Partial<Contract<C>>)
        // Add self to deployment (FIXME necessary?)
        if (this.context) this.context.addContract(this.name!, this)
      }
      // Create and return the Client instance used to interact with the contract
      return resolve(getClientTo(this))
    })
    Object.defineProperty(this, 'deployed', { get () { return deploying } })
    return deploying
  }

  /** @returns an instance of this contract's client
    * @throws tf the contract has no known address. */
  expect (): C {
    if (!this.address) {
      if (!this.name) {
        throw new Error(`Expected unnamed contract to be already deployed.`)
      } else {
        throw new Error(`Expected contract to be already deployed: ${this.name}`)
      }
    } else {
      return getClientTo(this)
    }
  }

  /** @returns true if the specified properties match the properties of this contract. */
  matches (predicate: Partial<Contract<C>>): boolean {
    for (const key in predicate) {
      if (this[key as keyof typeof predicate] !== predicate[key as keyof typeof predicate]) {
        return true
      }
    }
    return true
  }

  get asLink (): ContractLink {
    return {
      address:   this.address!,
      code_hash: this.codeHash!
    }
  }

}

/** Callable object: contract group.
  * Can build and upload, and instantiate multiple contracts. */
export class ContractGroup<A extends unknown[]> {

  constructor (
    public readonly context:      Deployment,
    public readonly getContracts: (...args: A)=>Many<AnyContract>
  ) {
  }

  /** Deploy an instance of this contract group. */
  async deploy (...args: A) {
    const contracts = this.getContracts.apply(this.context, args)
    if (!this.context.builder) throw new Error.NoBuilder()
    await this.context.builder.buildMany(Object.values(contracts) as unknown as Buildable[])
    if (!this.context.uploader) throw new Error.NoUploader()
    await this.context.uploader.uploadMany(Object.values(contracts) as unknown as Uploadable[])
    return await mapAsync(contracts, (contract: AnyContract)=>contract.deployed)
  }

  /** Prepare multiple instances of this contract group for deployment. */
  many (instances: Many<A>) {
    const self = this
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
      return new ContractGroup(self.context, ()=>self.getContracts(...args))
    }
  }
}

/** @returns the data for a deploy receipt */
export function toInstanceReceipt (
  c: Buildable & Built & Uploadable & Uploaded & Instantiable & Instantiated
) {
  return {
    ...toUploadReceipt(c),
    initBy:  c.initBy,
    initMsg: c.initMsg,
    initTx:  c.initTx,
    address: c.address,
    label:   c.label,
    prefix:  c.prefix,
    name:    c.name,
    suffix:  c.suffix
  }
}
