/**

  Fadroma: Base Deploy API
  Copyright (C) 2023 Hack.bg

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.

**/

import type {
  Chain, Agent, ClientClass, Builder, Buildable, Uploadable, Class, Many, Name, Named,
  IntoRecord, CodeId, CodeHash, Hashed, Address, TxHash, ChainId, Message, Into, Built, Uploaded,
  Label, ContractLink
} from './agent'
import {
  Error, Console, mapAsync, hideProperties, into, intoRecord, call, timestamp, map, HEAD
} from './agent-base'
import { assertAgent } from './agent-chain'
import { Client, assertAddress, codeHashOf, writeLabel } from './agent-client'
import { Uploader } from './agent-services'

import { override, defineDefault } from '@hackbg/over'

export type DeploymentFormat = 'v1'

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
  /** Get a deployment by name, or the active deployment if none is passed. 
    * @returns Deployment, or null if such doesn't exist. */
  abstract load (name: string|null|undefined): DeploymentState|null
  /** Update a deployment's data. */
  abstract save (name: string, state?: DeploymentState): void
  /** Create a new deployment. */
  abstract create (name?: string): Promise<DeploymentState>
  /** Activate a new deployment, or throw if such doesn't exist. */
  abstract select (name: string): Promise<DeploymentState>
  /** Get name of the active deployment, or null if there isn't one. */
  abstract get activeName (): string|null
  /** Default values for Deployments created from this store. */
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
    deployment.store ??= this
    // Update properties of each named contract defined in
    // the deployment with those from the loaded data.
    // If such a named contract is missing, define it.
    for (const name of Object.keys(state)) {
      if (deployment.contracts[name]) {
        Object.assign(deployment.contracts[name], state[name])
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
  log = new Console(this.constructor.name)
  /** Name of deployment. Used as label prefix of deployed contracts. */
  name:        string
  /** Mapping of contract names to contract instances. */
  contracts:   Record<string, AnyContract>
  /** Default state store to which updates to this deployment's state will be saved. */
  store?:      DeployStore
  /** Default Git ref from which contracts will be built if needed. */
  repository?: string = undefined
  /** Default Cargo workspace from which contracts will be built if needed. */
  workspace?:  string = undefined
  /** Default Git ref from which contracts will be built if needed. */
  revision?:   string = HEAD
  /** Build implementation. Contracts can't be built from source if this is missing. */
  builder?:    Builder
  /** Agent to use when deploying contracts. */
  agent?:      Agent
  /** Chain on which operations are executed. */
  chain?:      Chain
  /** Upload implementation. Contracts can't be uploaded if this is missing --
    * except by using `agent.upload` directly, which does not cache or log uploads. */
  uploader?:   Uploader

  constructor (options: Partial<Omit<Deployment, 'contracts'>> & Partial<{
    contracts?: Record<string, Partial<AnyContract>>|Record<string, AnyContract>
  }> = {}) {
    const name = options.name ?? timestamp()
    //super(name)
    this.name = name
    if (this.name) this.log.label = `${this.constructor.name}: ${this.name}`
    this.agent     ??= options.agent
    this.chain     ??= options.chain ?? options.agent?.chain
    this.builder   ??= options.builder
    this.uploader  ??= options.uploader ?? new Uploader({ agent: this.agent })
    this.workspace ??= options.workspace
    this.revision  ??= options.revision
    this.store     ??= options.store
    // Hydrate state
    this.contracts ??= {}
    for (const [name, contract] of Object.entries(options.contracts ?? {})) {
      this.contract(contract)
    }
    // Hide non-essential properties
    hideProperties(this, ...[
      'args', 'before', 'commandTree', 'currentCommand', 'description',
      'log', 'name', 'state', 'task', 'timestamp',
    ])
  }

  get [Symbol.toStringTag]() { return `${this.name??'-'}` }
  /** @returns the number of contracts in this deployment */
  get size (): number { return Object.keys(this.contracts).length }
  /** @returns true if the chain is a devnet or mocknet */
  get devMode (): boolean { return this.chain?.devMode ?? false }
  /** @returns true if the chain is a mainnet */
  get isMainnet (): boolean { return this.chain?.isMainnet ?? false }
  /** @returns true if the chain is a testnet */
  get isTestnet (): boolean { return this.chain?.isTestnet ?? false }
  /** @returns true if the chain is a devnet */
  get isDevnet (): boolean { return this.chain?.isDevnet ?? false }
  /** @returns true if the chain is a mocknet */
  get isMocknet (): boolean { return this.chain?.isMocknet ?? false }
  /** @returns a snapshot of the contracts state of this deployment */
  get snapshot () {
    const filter = (contract: Partial<AnyContract>) => {
      contract = {...contract}
      const filtered = ['deployment', 'builder', 'uploader', 'agent']
      for (const key in contract) {
        switch (true) {
          case (typeof (contract as any)[key] === 'function'):
          case ((contract as any)[key] === undefined):
            delete (contract as any)[key]
            continue
          case ((contract as any)[key] instanceof URL):
            (contract as any)[key] = String((contract as any)[key])
            continue
          case filtered.includes(key):
            delete (contract as any)[key]
            continue
        }
      }
      return contract
    }
    const contracts = Object.entries(this.contracts).reduce(
      (snapshot, [name, contract]: [string, any])=>
        Object.assign(snapshot, { [name]: filter(contract) }),
      {})
    return {contracts}
  }
  /** Print the status of this deployment. */
  showStatus = () => {
    this.log.deployment(this)
    return this
  }
  /** Specify a contract template.
    * @returns a callable instance of `Template` bearing the specified parameters.
    * Calling it will build and upload the template. */
  template = <C extends Client> (opts: Partial<Template<C>> = {}): Template<C> => {
    const { workspace, revision = HEAD, agent, builder, uploader } = this
    opts = { workspace, revision, agent, builder, uploader, ...opts, deployment: this }
    return new Template(opts)
  }
  /** Specify a contract.
    * @returns a callable instance of `Contract` bearing the specified parameters.
    * Calling it will deploy the contract, or retrieve it if already deployed. */
  contract = <C extends Client> (opts: Partial<Contract<C>> = {}): Contract<C> =>
    (opts.name && this.hasContract(opts.name))
      ? this.getContract(opts.name, opts.client) as unknown as Contract<C>
      : this.addContract(opts.name!, this.defineContract(opts))
  /** Define a contract without adding it to the state.
    * @returns a Contract object belonging to this Deployment. */
  defineContract = <C extends Client> (opts: Partial<Contract<C>> = {}): Contract<C> => {
    const { workspace, revision = HEAD, agent, builder, uploader, name } = this
    const deployment = this
    opts = { workspace, revision, agent, builder, uploader, ...opts, prefix: name, deployment }
    return new Contract(opts)
  }
  /** Check if the deployment contains a contract with a certain name.
    * @returns boolean */
  hasContract (name: Name): boolean {
    return !!(this.contracts||{})[name]
  }
  /** Get the Contract corresponding to a given name.
    * If the data is not a Contract instance, converts it internally to a Contract
    * @returns Contract */
  getContract <C extends Client> (name: Name, client?: ClientClass<C>) {
    let state = this.contracts[name] || {}
    if (state instanceof Contract) {
      return state
    } else {
      return this.contracts[name] = this.defineContract({
        ...this.contracts[name], name, client: client as any
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
    return Object.values(this.contracts).filter(contract=>predicate(contract!)) as Contract<C>[]
  }
  /** Set the Contract corresponding to a given name,
    * attaching it to this deployment. =
    * @returns the passed Contract */
  addContract <C extends Client> (id: Name, contract: Contract<C>) {
    return (this.contracts[id] = contract as unknown as AnyContract) as Contract<C>
  }
  /** @returns Promise<this> */
  deploy = async () => {
    const log = new Console(this.name)
    const contracts = Object.values(this.contracts)
    if (contracts.length <= 0) return (log.warn('empty deployment, not saving'), this)
    const toDeploy = contracts.filter(c=>!c.address)
    if (toDeploy.length <= 0) return (log.log('all contracts are deployed'), this)
    log.log(`${toDeploy.length} contract(s) are not deployed`)
    await this.buildContracts(toDeploy)
    await this.uploadContracts(toDeploy)
    log.log(`instantiating ${toDeploy.length} contract(s)`)
    // FIXME PERF: bundle concurrent inits into a single transaction
    for (const contract of contracts) await contract.deployed
    log.log('deployed', contracts.length, 'contract(s)')
    return this.save()
  }
  /** Compile multiple contracts. */
  buildContracts (contracts: (string|AnyContract)[]) {
    if (!this.builder) throw new Error.Missing.Builder()
    this.log(`making sure all ${contracts.length} contract(s) are built`)
    return this.builder.buildMany(contracts as unknown as Buildable[])
  }
  /** Upload multiple contracts. */
  uploadContracts (contracts: AnyContract[]) {
    if (!this.uploader) throw new Error.Missing.Uploader()
    this.log(`making sure ${contracts.length} contract(s) are uploaded`)
    return this.uploader.uploadMany(contracts as unknown as Uploadable[])
  }
  /** Save current deployment state to deploy store. */
  save = async (store: DeployStore|undefined = this.store): Promise<this> => {
    if (!store) {
      this.log.saveNoStore(this.name)
      return this
    }
    if (!this.chain) {
      this.log.saveNoChain(this.name)
      return this
    }
    if (this.chain.isMocknet) {
      this.log.notSavingMocknet(this.name)
      return this
    }
    this.log.saving(this.name, this.contracts)
    store.save(this.name, this.contracts)
    return this
  }
}

/** A Subsystem is any class which extends Deployment (thus being able to manage Contracts)
  * and takes a parent Deployment as first constructor argument (making it a sub-Deployment).
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
  /** The deployment that this template belongs to. */
  deployment?: Deployment = undefined
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
  /** The Client subclass that exposes the contract's methods.
    * @default the base Client class. */
  client?:     ClientClass<C> = undefined

  constructor (options: Partial<Template<C>> = {}) {
    this.define(options)
    if (this.deployment) {
      defineDefault(this, this.deployment, 'agent')
      defineDefault(this, this.deployment, 'builder')
      defineDefault(this, this.deployment, 'uploader')
      defineDefault(this, this.deployment, 'repository')
      defineDefault(this, this.deployment, 'revision')
      defineDefault(this, this.deployment, 'workspace')
    }
    hideProperties(this, 'log')
    Object.defineProperties(this, {
      'built': {
        configurable: true,
        get () { return this.build() }
      },
      'uploaded': {
        configurable: true,
        get () { return this.upload() }
      }
    })
  }

  get asContractCode (): ContractCode {
    return {
      id:        Number(this.codeId!) as any,
      code_hash: this.codeHash!
    }
  }
  get description (): string {
    let name = 'Template'
    if (this.crate || this.revision || this.codeId) {
      name += ': '
      if (this.crate)    name += `crate ${this.crate}`
      if (this.revision) name += `@ ${this.revision}`
      if (this.codeId)   name += `(code id ${this.codeId})`
    }
    return name
  }
  get built (): Promise<this & Built> {
    return this.build()
  }
  get uploaded (): Promise<this & Uploaded> {
    return this.upload()
  }

  /** Compile the source using the selected builder.
    * @returns this */
  build = (builder: Builder|undefined = this.builder): Promise<this & Built> => {
    return Object.defineProperty(this, 'built', {
      get: () => new Promise<this & Built>(async (resolve, reject)=>{
        if (this.artifact) return resolve(this as this & Built)
        if (!this.crate) throw new Error.Missing.Crate()
        builder ??= this.builder
        if (!builder) throw new Error.Missing.Builder()
        const result = await builder!.build(this as Buildable)
        this.define(result as Partial<this>)
        return resolve(this as this & Built)
      })
    }).built
  }
  /** Upload compiled source code to the selected chain.
    * @returns task performing the upload */
  upload = (uploader: Uploader|undefined = this.uploader): Promise<this & Uploaded> => {
    return Object.defineProperty(this, 'uploaded', {
      get: () => new Promise<this & Uploaded>(async (resolve, reject)=>{
        if (this.codeId) return resolve(this as this & Uploaded)
        if (!this.artifact) await this.built
        if (!uploader) throw new Error.Missing.Uploader()
        const result = await uploader.upload(this as Uploadable)
        this.define(result as Partial<this>)
        return resolve(this as this & Uploaded)
      })
    }).uploaded
  }
  /** @returns a Contract representing a specific instance of this Template. */
  instance = (options?: Partial<Contract<C>>): Contract<C> => {
    // Use values from Template as defaults for Contract
    options = { ...this as unknown as Partial<Contract<C>>, ...options }
    // Create the Contract
    const instance: Contract<C> = this.deployment
      ? this.deployment.contract(options)
      : new Contract(options)
    return instance
  }
  /** Get a collection of multiple contracts from this template.
    * @returns task for deploying multiple contracts, resolving to their clients */
  instances = (contracts: Many<Partial<Contract<C>>>): Many<Contract<C>> =>
    map(contracts, contract=>this.instance(contract))
  /** @returns a copy of this object with a changed agent.
    * @warning overriding constructor signature is discouraged. */
  asAgent = (agent: Agent): this =>
    new (this.constructor as any)({ ...this, agent })
  /** Provide parameters for an existing instance.
    * @returns mutated self */
  define = (options: Partial<Template<C>> = {}): this =>
    override(this, options as object)
}

type Task<T, U> = void // FIXME

/** Reference to an instantiated smart contract, to be used by contracts. */
export interface ContractCode {
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
  /** Gas used by init tx. */
  initGas?: string|number
}

export type AnyContract = Contract<Client>

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
    if (this.deployment) setPrefix(this.deployment.name)

    this.log = new Console(`${this.name ?? new.target.name}`)

    this.agent      = this.deployment?.agent      ?? this.agent
    this.builder    = this.deployment?.builder    ?? this.builder
    this.uploader   = this.deployment?.uploader   ?? this.uploader
    this.repository = this.deployment?.repository ?? this.repository
    this.revision   = this.deployment?.revision   ?? this.revision
    this.workspace  = this.deployment?.workspace  ?? this.workspace

    override(this, options)
    hideProperties(this, 'log')

    Object.defineProperty(this, 'deployed', {
      configurable: true,
      get () { return this.deploy() }
    })

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
        get () { return self.deployment?.name },
        set (v: string) {
          if (v !== self.deployment?.name) {
            self.log!.warn(`BUG: Overriding prefix from "${self.deployment?.name}" to "${v}"`)
          }
          setPrefix(v)
        }
      })
    }
  }

  get [Symbol.toStringTag]() { return this.name }

  /** One-shot deployment task. After the first call, `deploy` redefines it
    * to return the self-same deploying promise. Call `deploy` again to reset. */
  get deployed (): Promise<C> {
    return this.deploy()
  }
  get asContractLink (): ContractLink {
    return { address: this.address!, code_hash: this.codeHash! }
  }

  /** Deploy the contract, or retrieve it if it's already deployed.
    * @returns promise of instance of `this.client`  */
  deploy = (initMsg: Into<Message>|undefined = this.initMsg): Promise<C> => {
    return Object.defineProperty(this, 'deployed', {
      get: () => new Promise<C>(async (resolve, reject)=>{
        // If address is present, return client
        if (this.address) return resolve(this.expect())
        // If address is missing, deploy contract
        // TODO also recheck in deploy store if available
        if (!this.name) throw new Error.Missing.Name()
        if (!this.agent) throw new Error.Missing.Agent(this.name)
        if (!this.initMsg) throw new Error.Missing.InitMsg(this.name)
        // Construct the full unique label of the contract
        this.label = writeLabel(this)
        if (!this.label) throw new Error.Missing.Label(this.name)
        // Resolve the provided init message
        this.initMsg ??= await into(initMsg) as Message
        // Make sure the code is compiled and uploaded
        await this.uploaded
        if (!this.codeId) throw new Error.Missing.CodeId(this.name)
        this.log?.beforeDeploy(this, this.label!)
        // Perform the instantiation transaction
        const instance = await this.agent!.instantiate(this)
        // Populate self with result of instantiation (address)
        override(this as Contract<C>, instance)
        this.log?.afterDeploy(this as Partial<Contract<C>>)
        // address should now be present. return client
        return resolve(this.expect())
      })
    }).deployed
  }

  /** @returns an instance of this contract's client
    * @throws tf the contract has no known address. */
  expect (message?: string): C {
    if (this.address) return new (this.client ?? Client)({
      agent:    this.agent,
      address:  this.address,
      codeHash: this.codeHash,
      meta:     this as any
    } as any) as unknown as C
    if (message) {
      throw new Error(message)
    } else if (this.name) {
      throw new Error(`Expected contract to be already deployed: ${this.name}`)
    } else {
      throw new Error(`Expected unnamed contract to be already deployed.`)
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
}

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
