import { timestamp } from '@hackbg/konzola'
import { CommandContext } from '@hackbg/komandi'
import type { Task } from '@hackbg/komandi'
import { hide, into, intoRecord } from './client-fields'
import type { Class, Overridable, Into, IntoArray, IntoRecord } from './client-fields'
import { ClientError, ClientConsole } from './client-events'
import { assertAgent, assertAddress } from './client-connect'
import type { Address, TxHash, Agent, Chain, ChainId, Message, ContractLink, Client, ClientClass } from './client-connect'
import { ContractTemplate } from './client-upload'
import type { Builder } from './client-build'
import { intoSource } from './client-build'
import type { Uploader } from './client-upload'
import type { CodeHash, CodeId } from './client-code'
import { fetchCodeHash, getSourceSpecifier, assertCodeHash } from './client-code'
import type { Name, Label, StructuredLabel } from './client-labels'
import { writeLabel } from './client-labels'

export function intoInstance (x: Partial<ContractInstance>): ContractInstance {
  if (x instanceof ContractInstance) return x
  return new ContractInstance(x)
}

/** Represents a smart contract's lifecycle from source to individual instance. */
export class ContractInstance extends ContractTemplate implements StructuredLabel {
  /** Address of agent that performed the init tx. */
  initBy?:  Address             = undefined
  /** Address of agent that performed the init tx. */
  initMsg?: Into<Message>       = undefined
  /** TXID of transaction that performed the init. */
  initTx?:  TxHash              = undefined
  /** Address of this contract instance. Unique per chain. */
  address?: Address             = undefined
  /** Full label of the instance. Unique for a given Chain. */
  label?:   Label               = undefined
  /** Prefix of the instance.
    * Identifies which Deployment the instance belongs to, if any.
    * Prepended to contract label with a `/`: `PREFIX/NAME...` */
  prefix?:  Name                = undefined
  /** Proper name of the instance.
    * If the instance is not part of a Deployment, this is equal to the label.
    * If the instance is part of a Deployment, this is used as storage key.
    * You are encouraged to store application-specific versioning info in this field. */
  name?:    Name                = undefined
  /** Deduplication suffix.
    * Appended to the contract label with a `+`: `...NAME+SUFFIX`.
    * This field has sometimes been used to redeploy an new instance
    * within the same Deployment, taking the place of the old one.
    * TODO: implement this field's semantics: last result of **alphanumeric** sort of suffixes
    *       is "the real one" (see https://stackoverflow.com/a/54427214. */
  suffix?:  Name                = undefined

  constructor (options: Partial<ContractInstance> = {}) {
    super(options)
    this.define(options as object)
  }

  get [Symbol.toStringTag]() {
    return `${this.name??'-'} ${this.address??'-'} ${this.crate??'-'} @ ${this.revision??'HEAD'}`
  }

  /** Get link to this contract in Fadroma ICC format. */
  get asLink (): ContractLink {
    return { address: assertAddress(this), code_hash: assertCodeHash(this) }
  }

  /** @returns the data for saving a deploy receipt */
  get asReceipt (): Partial<this> {
    return {
      ...super.asReceipt,
      initBy:  this.initBy,
      initMsg: this.initMsg,
      initTx:  this.initTx,
      address: this.address,
      label:   this.label,
      prefix:  this.prefix,
      name:    this.name,
      suffix:  this.suffix
    } as Partial<this>
  }

  /** Async wrapper around getClientSync.
    * @returns a Client instance pointing to this contract
    * @throws if the contract address could not be determined */
  getClient <C extends Client> (
    $Client: ClientClass<C>|undefined = this.client as ClientClass<C>
  ): Promise<C> {
    return Promise.resolve(this.getClientSync($Client))
  }
  /** @returns a Client instance pointing to this contract
    * @throws if the contract address could not be determined */
  getClientSync <C extends Client> (
    $Client: ClientClass<C>|undefined = this.client as ClientClass<C>
  ): C {
    const client = this.getClientOrNull($Client)
    if (!client) throw new ClientError.NotFound($Client.name, this.name)
    return client
  }
  /** @returns a Client instance pointing to this contract, or null if
    * the contract address could not be determined */
  getClientOrNull <C extends Client> (
    $Client: ClientClass<C>|undefined = this.client as ClientClass<C>,
    agent?:  Agent
  ): C|null {
    if (!this.address) return null
    return new $Client(agent, this.address, this.codeHash, this) as C
  }
}

export interface Deployable {
  chainId: ChainId
  codeId:  CodeId
}

export interface NewContractSlot<C extends Client> {
  new (...args: ConstructorParameters<typeof ContractSlot<C>>): ContractSlot<C>
}

/** Contract slot. `await` an instance of this to get a client for it,
  * retrieving it from the deployment if known, or deploying it if not found.
  * @implements PromiseLike */
export class ContractSlot<C extends Client> extends ContractInstance {

  declare client?: ClientClass<C>

  log = new ClientConsole('Fadroma.Contract')

  constructor (
    /** Parameters of the specified contract. */
    options: Partial<ContractSlot<C>> = {},
    /** The group of contracts that contract belongs to. */
    public context: Deployment|undefined = options?.context,
    /** The agent that will upload and instantiate this contract. */
    public agent: Agent|undefined = options?.agent
  ) {
    super(options as Partial<ContractInstance>)
    this.define(options as object)
    if (context) this.attach(context)
    hide(this, ['log'])
  }

  /** Attach this contract to a Deployment. */
  attach (context: Deployment): this {
    attachSlot<C, this>(this, context)
    if (this.name && context.has(this.name)) this.define(context.get(this.name) as Partial<this>)
    return this
  }

  /** One-shot deployment task. */
  get deployed (): Promise<C> {
    const client = this.getClientOrNull()
    if (client) {
      this.log.foundDeployedContract(client.address!, this.name!)
      return Promise.resolve(client as C)
    }
    const deploying = this.deploy()
    Object.defineProperty(this, 'deployed', { get () { return deploying } })
    return deploying
  }

  /** Deploy the contract, or retrieve it if it's already deployed.
    * @returns promise of instance of `this.client`  */
  deploy (initMsg: Into<Message>|undefined = this.initMsg): Task<this, C> {
    return this.task(`deploy ${this.name ?? 'contract'}`, async () => {
      if (!this.agent) throw new ClientError.NoAgent(this.name)
      if (!this.name) throw new ClientError.NoName(this.name)
      this.label = writeLabel(this)
      if (!this.label) throw new ClientError.NoInitLabel(this.name)
      if (!this.initMsg) throw new ClientError.NoInitMessage(this.name)
      await this.uploaded
      if (!this.codeId) throw new ClientError.NoInitCodeId(this.name)
      this.initMsg = await into(initMsg) as Message
      this.log.beforeDeploy(this, this.label!)
      const contract = await this.agent!.instantiate(this)
      this.define(contract as Partial<this>)
      this.log.afterDeploy(this as Partial<ContractInstance>)
      if (this.context) this.context.add(this.name!, contract)
      return this.getClient()
    })
  }

  /** Evaluate this ContractSlot, asynchronously returning a Client
    * to the retrieved or deployed contract.
    * 1. try to get the contract from storage (if the deploy store is available)
    * 2. if that fails, try to deploy the contract (building and uploading it,
    *    if necessary and possible)
    * @returns promise of instance of `this.client`
    * @throws  if not found and not deployable  */
  //then <D, E> (
    //onfulfilled?: ((client: C)   => D|PromiseLike<D>) | null,
    //onrejected?:  ((reason: any) => E|PromiseLike<E>) | null
  //): Promise<D|E> {
    //return this.deployed.then(onfulfilled, onrejected)
  //}

}

export type MatchPredicate = (meta: Partial<ContractInstance>) => boolean|undefined

export class MultiContractSlot<C extends Client> extends ContractTemplate {

  log = new ClientConsole('Fadroma.Contract')
  /** Prefix of the instance.
    * Identifies which Deployment the instance belongs to, if any.
    * Prepended to contract label with a `/`: `PREFIX/NAME...` */
  prefix?: Name = undefined
  /** A mapping of Names (unprefixed Labels) to init configurations for the respective contracts. */
  inits?:  IntoRecord<Name, ContractInstance> = undefined
  /** A filter predicate for recognizing deployed contracts. */
  match?:  MatchPredicate = meta => Object.keys(this.inits??{}).includes(meta.name!)

  constructor (
    options: Partial<ContractInstance> = {},
    /** The group of contracts that contract belongs to. */
    public context?: Deployment,
    /** The agent that will upload and instantiate this contract. */
    public agent:    Agent     |undefined = context?.agent
  ) {
    super(options)
    this.define(options as object)
    hide(this, ['log'])
  }

  attach (context: Deployment): this {
    return attachSlot<C, this>(this, context)
  }

  /** One-shot deployment task. */
  get deployed (): Promise<Record<Name, C>> {
    const clients: Record<Name, C> = {}
    if (!this.inits) throw new ClientError.NoInitMessage()
    return into(this.inits!).then(async inits=>{
      // Collect separately the contracts that already exist
      for (const [name, args] of Object.entries(inits)) {
        const contract = new ContractSlot(this as ContractTemplate).define({ name })
        const client = contract.getClientOrNull()
        if (client) {
          this.log.foundDeployedContract(client.address!, name)
          clients[name] = client as C
          delete inits[name]
        }
      }
      // If there are any left to deploy, deploy em
      if (Object.keys(inits).length > 0) {
        Object.assign(clients, await this.deploy(inits))
      }
      return clients
    })
  }

  /** Deploy multiple instances of the same template. */
  deploy (inputs: IntoRecord<Name, ContractInstance> = this.inits ?? {}): Promise<Record<Name, C>> {
    const count = `${Object.keys(inputs).length} instance(s)`
    const name = undefined
        ?? (this.codeId && `deploy ${count} of code id ${this.codeId}`)
        ?? (this.crate  && `deploy ${count} of crate ${this.crate}`)
        ?? `deploy ${count}`
    return this.task(name, async (): Promise<Record<Name, C>> => {
      // need an agent to proceed
      const agent = assertAgent(this)
      // get the inits if passed lazily
      const inits = await intoRecord(inputs, this.context)
      // if deploying 0 contracts we're already done
      if (Object.keys(inits).length === 0) return Promise.resolve({})
      // upload then instantiate (upload may be a no-op if cached)
      const template = await this.uploaded
      // at this point we should have a code id
      if (!this.codeId) throw new ClientError.NoInitCodeId(name)
      // prepare each instance
      for (const [name, instance] of Object.entries(inits)) {
        // if operating in a Deployment, add prefix to each name (should be passed unprefixed)
        instance.label   = writeLabel({ name, prefix: this.context?.name })
        // resolve all init messages
        instance.initMsg = await into(instance.initMsg)
      }
      try {
        // run a bundled transaction creating each instance
        const responses = await agent.instantiateMany(inits)
        // get a Contract object representing each
        const contracts = Object.values(responses).map(response=>
          new ContractSlot(new ContractTemplate(this)).define(response))
        // get a Client from each Contract
        const clients   = Object.fromEntries(contracts.map(contract=>
          [contract.name, contract.getClientSync()]))
        // if operating in a Deployment, save each instance to the receipt
        if (this.context) Object.keys(inits).forEach(name=>this.context!.add(name, responses[name]))
        // return the battle-ready clients
        return clients
      } catch (e) {
        this.log.deployManyFailed(this, Object.values(inits), e as Error)
        throw e
      }
    })
  }

  /** Get all contracts that match the specified predicate. */
  get (match: MatchPredicate|undefined = this.match): Promise<Record<Name, C>> {
    if (!match) throw new ClientError.NoPredicate()
    const info = match.name
      ? `get all contracts matching predicate: ${match.name}`
      : `get all contracts matching specified predicate`
    return this.task(info, () => {
      if (!this.context) throw new ClientError.NoDeployment()
      const clients: Record<Name, C> = {}
      for (const info of Object.values(this.context!.state)) {
        if (!match(info as Partial<ContractInstance>)) continue
        clients[info.name!] = new ContractSlot(new ContractTemplate(this))
          .define(info).getClientSync() as C
      }
      return Promise.resolve(clients)
    })
  }

}

export function attachSlot <C extends Client, T extends ContractSlot<C>|MultiContractSlot<C>> (
  self:    T,
  context: Deployment
): T {
  self.context = context
  self.log ??= context.log
  self.agent ??= context.agent
  self.builder ??= context.builder
  self.uploader ??= context.uploader
  self.repository ??= context.repository
  self.revision ??= context.revision
  self.workspace ??= context.workspace
  setPrefix(self, context.name)
  return self

  function setPrefix (self: T, value: string) {
    Object.defineProperty(self, 'prefix', {
      enumerable: true,
      get () { return self.context?.name },
      set (v: string) {
        if (v !== self.context?.name) {
          self.log.warn(`BUG: Overriding prefix from "${self.context?.name}" to "${v}"`)
        }
        setPrefix(self, v)
      }
    })
  }
}

/** Transitional support for several of these:
  *  - YAML1 is how the latest @fadroma/deploy stores data
  *  - YAML2 is how @aakamenov's custom Rust-based deployer stores data
  *  - JSON1 is the intended target format for the next major version;
  *    JSON can generally be parsed with fewer dependencies, and can be
  *    natively embedded in the API client library distribution,
  *    in order to enable a standard subset of receipt data
  *    (such as the up-to-date addresses and code hashes for your production deployment)
  *    to be delivered alongside your custom Client subclasses,
  *    making your API client immediately usable with no further steps necessary. */
export type DeploymentFormat = 'YAML1'|'YAML2'|'JSON1'

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
  abstract list   ():              string[]
  /** Get a deployment by name, or null if such doesn't exist. */
  abstract get    (name: string):  Deployment|null
  /** Update a deployment's data. */
  abstract set    (name: string, state?: Record<string, Partial<ContractSlot<any>>>): void
  /** Create a new deployment. */
  abstract create (name?: string): Promise<Deployment>
  /** Activate a new deployment, or throw if such doesn't exist. */
  abstract select (name: string):  Promise<Deployment>
  /** Get the active deployment, or null if there isn't one. */
  abstract get active (): Deployment|null

  defaults: Partial<Deployment> = {}
}

export type DeploymentState = Record<string, Partial<ContractInstance>>

/** A set of interrelated contracts, deployed under the same prefix.
  * - Extend this class in client library to define how the contracts are found.
  * - Extend this class in deployer script to define how the contracts are deployed. */
export class Deployment extends CommandContext {
  log = new ClientConsole('Fadroma.Deployment')

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

    this.log.name = this.name ?? this.log.name

    hide(this, [
      'log', 'state', 'name', 'description', 'timestamp',
      'commandTree', 'currentCommand',
      'args', 'task', 'before'
    ])

    this
      .addCommand('build',  'build all required contracts',
                  this.buildMany.bind(this))
      .addCommand('upload', 'upload all required contracts',
                  this.uploadMany.bind(this))
      .addCommand('status', 'show the status of this deployment',
                  this.showStatus.bind(this))
  }

  /** Name of deployment. Used as label prefix of deployed contracts. */
  name: string = timestamp()
  /** Mapping of names to contract instances. */
  state: DeploymentState = {}
  /** Number of contracts in deployment. */
  get size () { return Object.keys(this.state).length }

  /** Default Git ref from which contracts will be built if needed. */
  repository?: string = undefined
  /** Default Cargo workspace from which contracts will be built if needed. */
  workspace?: string = undefined
  /** Default Git ref from which contracts will be built if needed. */
  revision?: string = 'HEAD'
  /** Build implementation. Contracts can't be built from source if this is missing. */
  builder?: Builder

  async showStatus () {
    this.log.deployment(this)
  }

  /** Build multiple contracts. */
  async buildMany (contracts: (string|ContractSource)[]): Promise<ContractSource[]> {
    return this.task(`build ${contracts.length} contracts`, async () => {
      if (!this.builder) throw new ClientError.NoBuilder()
      if (contracts.length === 0) return Promise.resolve([])
      contracts = contracts.map(contract=>{
        if (typeof contract === 'string') {
          return this.contract({ crate: contract }) as ContractSource
        } else {
          return contract
        }
      })
      const count = (contracts.length > 1)
        ? `${contracts.length} contract: `
        : `${contracts.length} contracts:`
      const sources = (contracts as ContractTemplate[])
        .map(contract=>`${contract.crate}@${contract.revision}`)
        .join(', ')
      return this.task(`build ${count} ${sources}`, () => {
        if (!this.builder) throw new ClientError.NoBuilder()
        return this.builder.buildMany(contracts as ContractSource[])
      })
    })
  }

  /** Agent to use when deploying contracts. */
  agent?: Agent
  /** Chain on which operations are executed. */
  chain?: Chain
  /** True if the chain is a devnet or mocknet */
  get devMode   (): boolean { return this.chain?.devMode   ?? false }
  /** = chain.isMainnet */
  get isMainnet (): boolean { return this.chain?.isMainnet ?? false }
  /** = chain.isTestnet */
  get isTestnet (): boolean { return this.chain?.isTestnet ?? false }
  /** = chain.isDevnet */
  get isDevnet  (): boolean { return this.chain?.isDevnet  ?? false }
  /** = chain.isMocknet */
  get isMocknet (): boolean { return this.chain?.isMocknet ?? false }

  /** Upload implementation. Contracts can't be uploaded if this is missing --
    * except by using `agent.upload` directly, which does not cache or log uploads. */
  uploader?:   Uploader

  /** Upload multiple contracts to the chain.
    * @returns the same contracts, but with `chainId`, `codeId` and `codeHash` populated. */
  async uploadMany (contracts: ContractSource[]): Promise<ContractTemplate[]> {
    return this.task(`upload ${contracts.length} contracts`, async () => {
      if (!this.uploader) throw new ClientError.NoUploader()
      if (contracts.length === 0) return Promise.resolve([])
      contracts = contracts
        .map(contract=>(typeof contract === 'string')?this.contract({ crate: contract }):contract)
        .map(contract=>intoSource(contract))
      const count = (contracts.length > 1)
        ? `${contracts.length} contract: `
        : `${contracts.length} contracts:`
      return this.task(`upload ${count} artifacts`, () => {
        if (!this.uploader) throw new ClientError.NoUploader()
        return this.uploader.uploadMany(contracts)
      })
    })
  }

  /** Specify a contract with optional client class and metadata.
    * @returns a Contract instance with the specified parameters.
    *
    * When defined as part of a Deployment, the methods of the Contract instance
    * are lazy and only execute when awaited:
    *
    * @example
    *   class ADeployment {
    *     aContract = this.contract({...}).deploy()
    *     bContract = this.contract({...}).deploy(async()=>({ init: await this.aContract.address }))
    *   }
    *   const aDeployment = new ADeployment() // nothing happens yet
    *   await aDeployment.bContract // bContract in deployed and pulls in aContract
    *   await aDeployment.aContract // aContract is now also resolved
    *
    * Use the methods of the returned Contract instance
    * to define what is to be done with the contract:
    *
    * @example
    *   // This will either return a Client to ExternalContract,
    *   // or bail if ExternalContract is not in the deployment:
    *   await this.contract({ name: 'ExternalContract' })
    *
    * @example
    *   // This will only deploy OwnContract if it's not already in the deployment.
    *   // Otherwise it will return a Client to the existing instance.
    *   await this.contract({ name: 'OwnContract' }).deploy(init?, callback?)
    *
    * @example
    *   // This will deploy multiple instances of the same contract,
    *   // returning an array of Client instances.
    *   await this.contract({ name: 'OwnContract' }).deployMany(inits?)
    *
    * @example
    *   // This will upload the contract code but not instantiate it,
    *   // and will therefore return a Contract.
    *   await this.contract({ name: 'OwnContractTemplate' }).upload()
    *
    **/
  contract <C extends Client> (options: Partial<ContractSlot<C>> = {}): ContractSlot<C> {
    // If a contract with this name exists in the deploymemt,
    // inherit properties from it. TODO just return the same contract
    return new ContractSlot<C>({
      agent: this.agent,
      ...options,
      ...(options.name && this.has(options.name)) ? this.get(options.name) : {}
    }).attach(this)
  }

  /** Specify multiple contracts.
    * @returns an array of Contract instances matching the specified predicate. */
  contracts <C extends Client> (options: Partial<MultiContractSlot<C>>): MultiContractSlot<C> {
    return new MultiContractSlot<C>({...options}).attach(this)
  }

  /** Check if the deployment contains a certain entry. */
  has (name: string): boolean {
    return !!this.state[name]
  }

  /** Throw if a certain contract is not found in the records. */
  expect (name: string, message?: string): ContractSlot<any> {
    message ??= `${name}: no such contract in deployment`
    const receipt = this.get(name)
    if (receipt) return this.contract({...receipt, name})
    throw new ClientError(message)
  }

  /** Get the receipt for a contract, containing its address, codeHash, etc. */
  get (name: string): Partial<ContractSlot<any>>|null {
    const receipt = this.state[name]
    if (!receipt) return null
    return { ...receipt, context: this }
  }

  /** Chainable. Add entry to deployment, merging into existing receipts. */
  add (name: string, data: any): this {
    return this.set(name, { ...this.state[name] || {}, ...data, name })
  }

  /** Chainable. Add entry to deployment, replacing existing receipt. */
  set (name: string, data: Partial<Client> & any): this {
    this.state[name] = { name, ...data }
    this.save()
    return this
  }

  /** Chainable. Add multiple entries to the deployment, replacing existing receipts. */
  setMany (receipts: Record<string, any>): this {
    for (const [name, receipt] of Object.entries(receipts)) this.state[name] = receipt
    this.save()
    return this
  }

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

  get [Symbol.toStringTag]() { return `${this.name??'-'}` }

}

/** A Subsystem is any class which extends Deployment (thus being able to manage Contracts),
  * and whose constructor takes a Deployer as first argument, as well as any number of
  * other arguments. This interface can be used to connect the main project class to individual
  * deployer classes for different parts of the project, enabling them to operate in the same
  * context (chain, agent, builder, uploader, etc). */
export interface Subsystem<D extends Deployment, E extends Deployment> extends Class<D, [
  E, ...unknown[]
]> {}

export class VersionedDeployment<V> extends Deployment {
  constructor (
    options: object = {},
    public version: V|undefined = (options as any)?.version
  ) {
    super(options as Partial<Deployment>)
    if (!this.version) throw new ClientError.NoVersion(this.constructor.name)
  }
}
