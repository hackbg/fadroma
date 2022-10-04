import { timestamp, bold, colors } from '@hackbg/konzola'
import { Task, CommandContext } from '@hackbg/komandi'

import { ClientConsole, ClientError } from './client-events'

/// # DRAMATIS PERSONAE ///////////////////////////////////////////////////////////////////////////

/** A class constructor. */
export interface Class<T, U extends Array<unknown>> {
  new (...args: U): T
}
/** A constructor for a Chain subclass. */
export interface ChainClass<C> extends Class<C, [ChainId, ConstructorParameters<typeof Chain>]> {
  Agent: AgentClass<Agent> // static
}
/** A constructor for an Agent subclass. */
export interface AgentClass<A extends Agent> extends Class<A, ConstructorParameters<typeof Agent>>{
  Bundle: BundleClass<Bundle> // static
}
/** A constructor for a Bundle subclass. */
export interface BundleClass<B extends Bundle> extends Class<B, ConstructorParameters<typeof Bundle>>{
}
/** A constructor for a Client subclass. */
export interface ClientClass<C extends Client> extends Class<C, ConstructorParameters<typeof Client>>{
  new (...args: ConstructorParameters<typeof Client>): C
}
/** A class constructor for an extensible value object. */
export interface Overridable<T, U> extends Class<T, [Partial<T>?]|[U|Partial<T>, Partial<T>?]> {
}
/** A constructor for a Builder subclass. */
export interface BuilderClass<B extends Builder> extends Overridable<Builder, IntoBuilder> {
}
/** A constructor for an Uploader subclass. */
export interface UploaderClass<U extends Uploader> extends Overridable<Uploader, IntoUploader> {
}
/** Constructor for the different varieties of DeployStore. */
export interface DeployStoreClass<D extends DeployStore> extends Class<D, [
  /** Defaults when hydrating Deployment instances from the store. */
  Partial<Deployment>|undefined,
  ...unknown[]
]> {}

/** @returns the agent of the thing
  * @throws  ExpectedAgent if missing. */
export function assertAgent <A extends Agent> (thing: { agent?: A } = {}): A {
  if (!thing.agent) throw new ClientError.ExpectedAgent(thing.constructor?.name)
  return thing.agent
}

/** @returns the address of the thing
  * @throws  LinkNoAddress if missing. */
export function assertAddress ({ address }: { address?: Address } = {}): Address {
  if (!address) throw new ClientError.LinkNoAddress()
  return address
}

/** @returns the code hash of the thing
  * @throws  LinkNoCodeHash if missing. */
export function assertCodeHash ({ codeHash }: { codeHash?: CodeHash } = {}): CodeHash {
  if (!codeHash) throw new ClientError.LinkNoCodeHash()
  return codeHash
}

/** @returns the uploader of the thing
  * @throws  NoUploader if missing or NoUploaderAgent if the uploader has no agent. */
export function assertUploader ({ uploader }: { uploader?: Uploader }): Uploader {
  if (!uploader) throw new ClientError.NoUploader()
  //if (typeof uploader === 'string') throw new ClientError.ProvideUploader(uploader)
  if (!uploader.agent) throw new ClientError.NoUploaderAgent()
  return uploader
}

/** Implements some degree of controlled extensibility for the value object pattern used below.
  * @todo ..... underlay (converse function which provides defaults for defined properties
  * but leaves untouched ones that are already set rather than overriding them) */
export function override <T extends object> (
  self:    T,
  options: Partial<T>
): T {
  for (const [key, val] of Object.entries(options)) {
    if (val === undefined) continue
    const exists     = key in self
    const writable   = Object.getOwnPropertyDescriptor(self, key)?.writable ?? true
    const isFunction = (typeof self[key as keyof T] !== 'function')
    if (exists && writable && !isFunction) Object.assign(self, { [key]: val })
  }
  return self
}

/** A lazily provided value. The value can't be a Function. */
export type Into<X> =
  | X
  | PromiseLike<X>
  | (()=>X)
  | (()=>PromiseLike<X>)

/** Resolve a lazily provided value. */
export async function into <X, Y> (specifier: Into<X>, context?: Y): Promise<X> {
  if (typeof specifier === 'function') {
    if (context) specifier = specifier.bind(context)
    return await Promise.resolve((specifier as Function)())
  }
  return await Promise.resolve(specifier)
}

export type IntoArray<X> = Into<Array<Into<X>>>

export async function intoArray <X, Y> (specifier: IntoArray<X>, context?: Y): Promise<X[]> {
  if (typeof specifier === 'function') {
    if (context) specifier = specifier.bind(context)
    specifier = await Promise.resolve((specifier as Function)())
  }
  return await Promise.all((specifier as Array<Into<X>>).map(x=>into(x, context)))
}

/// # ACT I. CHAIN, AGENT, BUNDLE /////////////////////////////////////////////////////////////////

/** A code hash, uniquely identifying a particular smart contract implementation. */
export type CodeHash = string

/** Objects that have a code hash in either capitalization. */
interface Hashed { code_hash?: CodeHash, codeHash?: CodeHash }

/** Allow code hash to be passed with either cap convention; warn if missing or invalid. */
export function codeHashOf ({ code_hash, codeHash }: Hashed): CodeHash {
  if (typeof code_hash === 'string') code_hash = code_hash.toLowerCase()
  if (typeof codeHash  === 'string') codeHash  = codeHash.toLowerCase()
  if (code_hash && codeHash && code_hash !== codeHash) throw new ClientError.DifferentHashes()
  const result = code_hash ?? codeHash
  if (!result) throw new ClientError.NoCodeHash()
  return result
}

/** A code ID, identifying uploaded code on a chain. */
export type CodeId = string

/** A contract's full unique on-chain label. */
export type Label  = string

/** The friendly name of a contract. Part of the label. */
export type Name   = string

/** A chain can be in one of the following modes: */
export enum ChainMode {
  Mainnet = 'Mainnet',
  Testnet = 'Testnet',
  Devnet  = 'Devnet',
  Mocknet = 'Mocknet'
}

/** The unique ID of a chain. */
export type ChainId = string

/** A collection of functions that return Chain instances. */
export type ChainRegistry = Record<string, (config: any)=>Chain|Promise<Chain>>

/** Represents a particular chain. */
export abstract class Chain {
  constructor (
    readonly id: ChainId,
    options: Partial<ChainOpts> = {}
  ) {
    Object.defineProperty(this, 'log', { writable: true, enumerable: false })
    Object.defineProperty(this, 'Agent', { writable: true, enumerable: false })
    if (!id) throw new ClientError.NoChainId()
    this.id   = id
    this.mode = options.mode!
    if (options.url) {
      this.url = options.url
    }
    if (options.node) {
      if (options.mode === Chain.Mode.Devnet) {
        this.node = options.node
        if (this.url !== String(this.node.url)) {
          this.log.warnUrlOverride(this.node.url, this.url)
          this.url = String(this.node.url)
        }
        if (this.id !== this.node.chainId) {
          this.log.warnIdOverride(this.node.chainId, this.id)
          this.id = this.node.chainId
        }
      } else {
        this.log.warnNodeNonDevnet()
      }
    }
  }

  /** Defined as true on Secret Network-specific subclasses. */
  isSecretNetwork = false
  /** Logger. */
  log = new ClientConsole('Fadroma.Chain')
  /** The Agent subclass to use for interacting with this chain. */
  Agent: AgentClass<Agent> = (this.constructor as ChainClass<unknown>).Agent
  /** The API URL to use. */
  readonly url:  string = ''
  /** Whether this is mainnet, public testnet, local devnet, or mocknet. */
  readonly mode: ChainMode
  /** Whether this is a mainnet. */
  get isMainnet () { return this.mode === ChainMode.Mainnet }
  /** Whether this is a testnet. */
  get isTestnet () { return this.mode === ChainMode.Testnet }
  /** Whether this is a devnet. */
  get isDevnet  () { return this.mode === ChainMode.Devnet  }
  /** Whether this is a mocknet. */
  get isMocknet () { return this.mode === ChainMode.Mocknet }
  /** Whether this is a devnet or mocknet. */
  get devMode   () { return this.isDevnet || this.isMocknet }
  /** Return self. */
  get chain     () { return this }
  /** If this is a devnet, this contains an interface to the devnet container. */
  readonly node?: DevnetHandle
  /** Get the current block height. */
  abstract get height (): Promise<number>
  /** Wait for the block height to increment. */
  get nextBlock (): Promise<number> {
    this.log.waitingForNextBlock()
    return this.height.then(async startingHeight=>new Promise(async (resolve, reject)=>{
      try {
        while (true) {
          await new Promise(ok=>setTimeout(ok, 100))
          const height = await this.height
          if (height > startingHeight) resolve(height)
        }
      } catch (e) {
        reject(e)
      }
    }))
  }
  /** The default denomination of the chain's native token. */
  abstract defaultDenom: string
  /** Get the native balance of an address. */
  abstract getBalance (denom: string, address: Address): Promise<string>
  /** Query a smart contract. */
  abstract query <U> (contract: Client, msg: Message): Promise<U>
  /** Get the code id of a smart contract. */
  abstract getCodeId (address: Address): Promise<CodeId>
  /** Get the label of a smart contract. */
  abstract getLabel (address: Address): Promise<string>
  /** Get the code hash of a smart contract. */
  abstract getHash (address: Address|number): Promise<CodeHash>
  /** Get the code hash of a smart contract. */
  async checkHash (address: Address, expectedCodeHash?: CodeHash) {
    // Soft code hash checking for now
    const fetchedCodeHash = await this.getHash(address)
    if (!expectedCodeHash) {
      this.log.warnNoCodeHashProvided(address, fetchedCodeHash)
    } if (expectedCodeHash !== fetchedCodeHash) {
      this.log.warnCodeHashMismatch(address, expectedCodeHash, fetchedCodeHash)
    } else {
      this.log.confirmCodeHash(address, fetchedCodeHash)
    }
    return fetchedCodeHash
  }
  /** Get a new instance of the appropriate Agent subclass. */
  async getAgent (
    options?: Partial<AgentOpts>,
    _Agent:   AgentClass<Agent> = Agent as unknown as AgentClass<Agent>
  ): Promise<Agent> {
    _Agent  ??= this.Agent as AgentClass<Agent>
    options ??= {}
    if (this.node) await this.node.respawn()
    if (!options.mnemonic && options.name) {
      if (!this.node) throw new ClientError.NameOutsideDevnet()
      options = { ...options, ...await this.node.getGenesisAccount(options.name) }
    }
    options.chain = this
    const agent = new _Agent(options)
    return agent
  }
  /** Async functions that return Chain instances in different modes.
    * Values for `FADROMA_CHAIN` environment variable. */
  static variants: ChainRegistry = {}
  /** Shorthand for the ChainMode enum. */
  static Mode = ChainMode
  /** The default Agent subclass to use for interacting with this chain. */
  static Agent: AgentClass<Agent> // populated below
}

export interface ChainOpts {
  url:  string
  mode: ChainMode
  node: DevnetHandle
}

export interface DevnetHandle {
  chainId: string
  url: URL
  respawn (): Promise<unknown>
  terminate (): Promise<void>
  getGenesisAccount (name: string): Promise<AgentOpts>
}

/** An address on a chain. */
export type Address     = string

/** A transaction message that can be sent to a contract. */
export type Message     = string|Record<string, unknown>

/** A message or a function that returns one. */
export type IntoMessage = Message|(()=>Message|Promise<Message>)

export type DeployArgsTriple = [Contract<any>, Name, Message]

/** Options for a compute transaction. */
export interface ExecOpts {
  /** The maximum fee. */
  fee?:  IFee
  /** A list of native tokens to send alongside the transaction. */
  send?: ICoin[]
  /** A transaction memo. */
  memo?: string
  /** Allow extra options. */
  [k: string]: unknown
}

/** A 128-bit integer. */
export type Uint128    = string

/** A 256-bit integer. */
export type Uint256    = string

/** A 128-bit decimal fraction. */
export type Decimal    = string

/** A 256-bit decimal fraction. */
export type Decimal256 = string

/** Represents some amount of native token. */
export interface ICoin { amount: Uint128, denom: string }

/** A gas fee, payable in native tokens. */
export interface IFee { amount: readonly ICoin[], gas: Uint128 }

/** Represents some amount of native token. */
export class Coin implements ICoin {
  readonly amount: string
  constructor (amount: number|string, readonly denom: string) {
    this.amount = String(amount)
  }
}

/** A constructable gas fee in native tokens. */
export class Fee implements IFee {
  readonly amount: readonly ICoin[]
  constructor (amount: Uint128|number, denom: string, readonly gas: string = String(amount)) {
    this.amount = [{ amount: String(amount), denom }]
  }
}

/** By authenticating to a network you obtain an Agent,
  * which can perform transactions as the authenticated identity. */
export abstract class Agent {
  constructor (options: Partial<AgentOpts> = {}) {
    this.chain = options.chain ?? this.chain
    this.name  = options.name  ?? this.name
    this.fees  = options.fees  ?? this.fees
    Object.defineProperty(this, 'chain', { enumerable: false })
    Object.defineProperty(this, 'log',   { enumerable: false })
  }

  /** Logger. */
  log = new ClientConsole('Fadroma.Agent')
  /** The chain on which this agent operates. */
  chain?:   Chain
  /** The address from which transactions are signed and sent. */
  address?: Address
  /** The friendly name of the agent. */
  name?:    string
  /** Default fee maximums for send, upload, init, and execute. */
  fees?:    AgentFees
  /** The Bundle subclass to use. */
  Bundle:   BundleClass<Bundle> = (this.constructor as AgentClass<typeof this>).Bundle
  /** The default denomination in which the agent operates. */
  get defaultDenom () {
    return this.assertChain().defaultDenom
  }
  /** @returns this.chain if set
    * @throws NoChainClientError if not set */
  assertChain (): Chain {
    if (!this.chain) throw new ClientError.NoChain()
    return this.chain
  }
  /** Get the balance of this or another address. */
  getBalance (denom = this.defaultDenom, address = this.address): Promise<string> {
    if (!this.chain) throw new ClientError.NoChain()
    if (!address) throw new ClientError.BalanceNoAddress()
    return this.chain.getBalance(denom!, address)
  }
  /** This agent's balance in the chain's native token. */
  get balance (): Promise<string> {
    return this.getBalance()
  }
  /** The chain's current block height. */
  get height (): Promise<number> {
    return this.assertChain().height
  }
  /** Wait until the block height increments. */
  get nextBlock () {
    return this.assertChain().nextBlock
  }
  /** Get the code ID of a contract. */
  getCodeId (address: Address) {
    return this.assertChain().getCodeId(address)
  }
  /** Get the label of a contract. */
  getLabel (address: Address) {
    return this.assertChain().getLabel(address)
  }
  /** Get the code hash of a contract or template. */
  getHash (address: Address|number) {
    return this.assertChain().getHash(address)
  }
  /** Check the code hash of a contract at an address against an expected value. */
  checkHash (address: Address, codeHash?: CodeHash) {
    return this.assertChain().checkHash(address, codeHash)
  }
  /** Query a contract on the chain. */
  query <R> (contract: Client, msg: Message): Promise<R> {
    return this.assertChain().query(contract, msg)
  }
  /** Send native tokens to 1 recipient. */
  abstract send     (to: Address, amounts: ICoin[], opts?: ExecOpts): Promise<void|unknown>
  /** Send native tokens to multiple recipients. */
  abstract sendMany (outputs: [Address, ICoin[]][], opts?: ExecOpts): Promise<void|unknown>
  /** Upload code, generating a new code id/hash pair. */
  abstract upload (blob: Uint8Array): Promise<Contract<any>>
  /** Upload multiple pieces of code, generating multiple CodeID/CodeHash pairs.
    * @returns Contract[] */
  uploadMany (blobs: Uint8Array[] = []): Promise<Contract<any>[]> {
    return Promise.all(blobs.map(blob=>this.upload(blob)))
  }
  /** Create a new smart contract from a code id, label and init message. */
  abstract instantiate (template: Contract<any>, label: Label, initMsg: Message):
    Promise<Contract<any>>
  /** Create multiple smart contracts from a list of code id/label/init message triples. */
  instantiateMany (template: Contract<any>, instances: Record<string, DeployArgs>):
    Promise<Record<string, Contract<any>>>
  instantiateMany (template: Contract<any>, instances: DeployArgs[]):
    Promise<Contract<any>[]>
  async instantiateMany <C, D> (template: Contract<any>, instances: C): Promise<D> {
    const inits: [string, DeployArgs][] = Object.entries(instances)
    const results: Contract<any>[] =
      await Promise.all(inits.map(([key, [label, initMsg]])=>
        this.instantiate(new Contract(template), label, initMsg)))
    const outputs: any = ((instances instanceof Array) ? [] : {}) as D
    for (const i in inits) {
      const [key]  = inits[i]
      const result = results[i]
      outputs[key] = result
    }
    return outputs as D
  }
  /** Call a transaction method on a smart contract. */
  abstract execute (
    contract: Partial<Client>, msg: Message, opts?: ExecOpts
  ): Promise<void|unknown>
  /** Begin a transaction bundle. */
  bundle (): Bundle {
    //@ts-ignore
    return new this.Bundle(this)
  }
  /** Get a client instance for talking to a specific smart contract as this executor. */
  getClient <C extends Client> (
    $Client:   ClientClass<C>,
    address?:  Address,
    codeHash?: CodeHash,
    ...args:   unknown[]
  ): C {
    return new $Client(
      this, address, codeHash, undefined,
      //@ts-ignore
      ...args
    ) as C
  }
  /** The default Bundle class used by this Agent. */
  static Bundle: BundleClass<Bundle> // populated below
}

Chain.Agent = Agent as AgentClass<Agent>

export interface AgentOpts {
  chain:     Chain
  name?:     string
  mnemonic?: string
  address?:  Address
  fees?:     AgentFees
  [key: string]: unknown
}

export interface AgentFees {
  send?:   IFee
  upload?: IFee
  init?:   IFee
  exec?:   IFee
}

/** Bundle is an alternate executor that collects collects messages to broadcast
  * as a single transaction in order to execute them simultaneously. For that, it
  * uses the API of its parent Agent. You can use it in scripts with:
  *   await agent.bundle().wrap(async bundle=>{ client.as(bundle).exec(...) })
  * */
export abstract class Bundle extends Agent {

  constructor (readonly agent: Agent) {
    if (!agent) throw new ClientError.NoBundleAgent()
    super({ chain: agent.chain })
    this.address = this.agent.address
    this.name    = `${this.agent.name}@BUNDLE`
    this.fees    = this.agent.fees
  }

  /** Logger. */
  log = new ClientConsole('Fadroma.Bundle')
  /** Nested bundles are flattened, this counts the depth. */
  depth  = 0
  /** Bundle class to use when creating a bundle inside a bundle.
    * @default self */
  Bundle = this.constructor as { new (agent: Agent): Bundle }
  /** Messages in this bundle, unencrypted. */
  msgs: any[] = []
  /** Next message id. */
  id = 0
  /** Add a message to the bundle. */
  add (msg: Message) {
    const id = this.id++
    this.msgs[id] = msg
    return id
  }
  /** Nested bundles are flattened, i.e. trying to create a bundle
    * from inside a bundle returns the same bundle. */
  bundle (): this {
    this.log.warn('Nest bundles with care. Depth:', ++this.depth)
    return this
  }
  /** Create and run a bundle.
    * @example
    *   await agent.bundle().wrap(async bundle=>{
    *     client1.as(bundle).doThing()
    *     bundle.getClient(SomeClient, address, codeHash).doAnotherThing()
    *   })
    * */
  async wrap (
    cb:   BundleCallback<this>,
    opts: ExecOpts = { memo: "" },
    save: boolean  = false
  ): Promise<any[]> {
    await cb(this)
    return this.run(opts.memo, save)
  }
  /** Either submit or save the bundle. */
  run (memo = "", save: boolean = false): Promise<any> {
    if (this.depth > 0) {
      this.log.warn('Unnesting bundle. Depth:', --this.depth)
      this.depth--
      //@ts-ignore
      return null
    } else {
      if (save) {
        return this.save(memo)
      } else {
        return this.submit(memo)
      }
    }
  }
  /** Throws if the bundle is invalid. */
  assertMessages (): any[] {
    if (this.msgs.length < 1) throw this.log.warnEmptyBundle()
    return this.msgs
  }
  /** This doesnt change over time so it's allowed when building bundles. */
  getCodeId (address: Address) {
    return this.agent.getCodeId(address)
  }
  /** This doesnt change over time so it's allowed when building bundles. */
  getLabel  (address: Address) {
    return this.agent.getLabel(address)
  }
  /** This doesnt change over time so it's allowed when building bundles. */
  getHash   (address: Address|number) {
    return this.agent.getHash(address)
  }
  /** This doesnt change over time so it's allowed when building bundles. */
  checkHash (address: Address, codeHash?: CodeHash) {
    return this.agent.checkHash(address, codeHash)
  }
  /** Disallowed in bundle - do it beforehand or afterwards. */
  get balance (): Promise<string> {
    throw new ClientError.NotInBundle("query balance")
  }
  /** Disallowed in bundle - do it beforehand or afterwards. */
  async getBalance (denom: string): Promise<string> {
    throw new ClientError.NotInBundle("query balance")
  }
  /** Disallowed in bundle - do it beforehand or afterwards. */
  get height (): Promise<number> {
    throw new ClientError.NotInBundle("query block height inside bundle")
  }
  /** Disallowed in bundle - do it beforehand or afterwards. */
  get nextBlock (): Promise<number> {
    throw new ClientError.NotInBundle("wait for next block")
  }
  /** Disallowed in bundle - do it beforehand or afterwards. */
  async send (to: Address, amounts: ICoin[], opts?: ExecOpts): Promise<void|unknown> {
    throw new ClientError.NotInBundle("send")
  }
  /** Disallowed in bundle - do it beforehand or afterwards. */
  async sendMany (outputs: [Address, ICoin[]][], opts?: ExecOpts): Promise<void|unknown> {
    throw new ClientError.NotInBundle("send")
  }
  /** Add an init message to the bundle. */
  async instantiate (
    template: Contract<any>, label: Label, initMsg: Message, funds = []
  ): Promise<Contract<any>> {
    const codeId   = String(template.codeId)
    const codeHash = template.codeHash
    this.add({ init: { sender: this.address, codeId, codeHash, label, funds, msg: initMsg } })
    return Object.assign(new Contract(template), { codeId, codeHash, label, initMsg })
  }
  /** Add an exec message to the bundle. */
  async execute (
    { address, codeHash }: Partial<Client>,
    msg: Message,
    { send }: ExecOpts = {}
  ): Promise<this> {
    this.add({ exec: { sender: this.address, contract: address, codeHash, msg, funds: send } })
    return this
  }
  /** Queries are disallowed in the middle of a bundle because
    * even though the bundle API is structured as multiple function calls,
    * the bundle is ultimately submitted as a single transaction and
    * it doesn't make sense to query state in the middle of that. */
  async query <U> (contract: Client, msg: Message): Promise<never> {
    throw new ClientError.NotInBundle("query")
  }
  /** Uploads are disallowed in the middle of a bundle because
    * it's easy to go over the max request size, and
    * difficult to know what that is in advance. */
  async upload (code: Uint8Array): Promise<never> {
    throw new ClientError.NotInBundle("upload")
  }
  /** Uploads are disallowed in the middle of a bundle because
    * it's easy to go over the max request size, and
    * difficult to know what that is in advance. */
  async uploadMany (code: Uint8Array[] = []): Promise<never> {
    throw new ClientError.NotInBundle("upload")
  }

  /** Broadcast a bundle to the chain. */
  abstract submit (memo: string): Promise<unknown>

  /** Save a bundle for manual broadcast. */
  abstract save   (name: string): Promise<unknown>

}

Agent.Bundle = Bundle as unknown as BundleClass<Bundle>

/** Function passed to Bundle#wrap */
export type BundleCallback<B extends Bundle> = (bundle: B)=>Promise<void>

/// # ACT II. CLIENT, CONTRACT METADATA ///////////////////////////////////////////////////////////

/** Client: interface to the API of a particular contract instance.
  * Has an `address` on a specific `chain`, usually also an `agent`.
  * Subclass this to add the contract's methods. */
export class Client {

  constructor (
    /** Agent that will interact with the contract. */
    public agent?:    Agent,
    /** Address of the contract on the chain. */
    public address?:  Address,
    /** Code hash confirming the contract's integrity. */
    public codeHash?: CodeHash,
    /** Contract class containing deployment metadata. */
    public meta:      ContractInstance = new ContractInstance()
  ) {
    Object.defineProperty(this, 'log', { writable: true, enumerable: false })
    Object.defineProperty(this, 'deployment', { writable: true, enumerable: false })
    meta.address  ??= address
    meta.codeHash ??= codeHash
    meta.chainId  ??= agent?.chain?.id
    //if (!agent)    this.log.warnNoAgent(this.constructor.name)
    //if (!address)  this.log.warnNoAddress(this.constructor.name)
    //if (!codeHash) this.log.warnNoCodeHash(this.constructor.name)
  }

  /** Logger. */
  log = new ClientConsole('Fadroma.Client')
  /** Default fee for all contract transactions. */
  fee?: IFee = undefined
  /** Default fee for specific transactions. */
  fees?: Record<string, IFee> = undefined
  /** The chain on which this contract exists. */
  get chain () { return this.agent?.chain }
  /** Throw if fetched metadata differs from configured. */
  protected validate (kind: string, expected: any, actual: any) {
    const name = this.constructor.name
    if (expected !== actual) throw new ClientError.ValidationFailed(kind, name, expected, actual)
  }
  /** Fetch code hash from address. */
  async fetchCodeHash (expected: CodeHash|undefined = this.codeHash): Promise<this> {
    const codeHash = await assertAgent(this).getHash(assertAddress(this))
    if (!!expected) this.validate('codeHash', expected, codeHash)
    this.codeHash = codeHash
    return this
  }
  /** Legacy, use fetchCodeHash instead. */
  async populate (): Promise<this> {
    return await this.fetchCodeHash()
  }
  /** The contract represented in Fadroma ICC format (`{address, code_hash}`) */
  get asLink (): ContractLink {
    if (!this.address)  throw new ClientError.LinkNoAddress()
    if (!this.codeHash) throw new ClientError.LinkNoCodeHash()
    return { address: this.address, code_hash: this.codeHash }
  }
  /** Create a copy of this Client that will execute the transactions as a different Agent. */
  as (agent: Agent|undefined = this.agent): this {
    if (!agent || agent === this.agent) return this
    const Client = this.constructor as ClientClass<typeof this>
    return new Client(agent, this.address, this.codeHash) as this
  }
  /** Creates another Client instance pointing to the same contract. */
  asClient <C extends Client> (client: ClientClass<C>): C {
    return new client(this.agent, this.address, this.codeHash, this.meta) as C
  }
  /** Execute a query on the specified contract as the specified Agent. */
  query <U> (msg: Message): Promise<U> {
    return assertAgent(this).query(this, msg)
  }
  /** Get the recommended fee for a specific transaction. */
  getFee (msg?: string|Record<string, unknown>): IFee|undefined {
    const fees       = this.fees ?? {}
    const defaultFee = this.fee ?? this.agent?.fees?.exec
    if (typeof msg === 'string') {
      return fees[msg] || defaultFee
    } else if (typeof msg === 'object') {
      const keys = Object.keys(msg)
      if (keys.length !== 1) throw new ClientError.InvalidMessage()
      return fees[keys[0]] || defaultFee
    }
    return this.fee || defaultFee
  }
  /** Use the specified fee for all transactions by this Client. */
  withFee (fee: IFee): this {
    this.fee  = fee
    this.fees = {}
    return this
  }
  /** Execute a transaction on the specified contract as the specified Agent. */
  async execute (msg: Message, opt: ExecOpts = {}): Promise<void|unknown> {
    assertAddress(this)
    opt.fee = opt.fee || this.getFee(msg)
    return await assertAgent(this).execute(this, msg, opt)
  }

  /** Create a Contract object from this client. */
  get asContract (): Contract<typeof this> {
    return new Contract({...this.meta, client: this.constructor as ClientClass<typeof this>})
  }
}

/** A contract name with optional prefix and suffix, implementing namespacing
  * for append-only platforms where labels have to be globally unique. */
export class StructuredLabel {
}

/** The output of parsing a label of the format `prefix/name+suffix` */
export interface LabelFormat {
  prefix?: Name
  name?:   Name
  suffix?: Name
}

export interface ContractInfo {
  id:        number,
  code_hash: string
}

/** `{ id, codeHash }` -> `{ id, code_hash }`; nothing else */
export const templateStruct = (template: any): ContractInfo => ({
  id:        Number(template.codeId),
  code_hash: codeHashOf(template)
})

/** Reference to an instantiated smart contract in the format of Fadroma ICC. */
export interface ContractLink {
  readonly address:   Address
  readonly code_hash: CodeHash
}

/** Convert Fadroma.Instance to address/hash struct (ContractLink) */
export const linkStruct = (instance: IntoLink): ContractLink => ({
  address:   assertAddress(instance),
  code_hash: codeHashOf(instance)
})

/** Objects that have an address and code hash.
  * Pass to linkTuple or linkStruct to get either format of link. */
export interface IntoLink extends Hashed {
  address: Address
}

export class Metadata {
  constructor (options: Partial<Metadata> = {}) {
    this.provide(options as object)
  }

  /** Provide parameters for an existing contract.
    * @returns the modified contract. */
  provide (options: Partial<this>): this {
    return override(this, options)
  }

  /** Define a subtask
    * @returns A lazily-evaluated Promise. */
  task <T> (name: string, cb: (this: typeof this)=>Promise<T>): Task<typeof this, T> {
    const task = new Task(name, cb, this)
    const [_, head, ...body] = (task.stack ?? '').split('\n')
    task.stack = '\n' + head + '\n' + body.slice(3).join('\n')
    return task
  }

  /** Throw if fetched metadata differs from configured. */
  static validateField <T> (kind: string, value: T, expected?: T): T {
    const name = this.constructor.name
    if (typeof value === 'string' && typeof expected === 'string') {
      value = value.toLowerCase() as unknown as T
    }
    if (typeof expected === 'string') {
      expected = expected.toLowerCase() as unknown as T
    }
    if (typeof expected !== 'undefined' && expected !== value) {
      throw new ClientError.ValidationFailed(kind, name, expected, value)
    }
    return value
  }
}

export class ContractTemplate extends Metadata {
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
  /** Builder implementation that produces a Contract from the Source. */
  builderId?:  string     = undefined
  /** URL to the compiled code. */
  artifact?:   string|URL = undefined
  /** Code hash uniquely identifying the compiled code. */
  codeHash?:   CodeHash   = undefined
  /** Object containing upload logic. */
  uploaderId?: string     = undefined
  /** ID of chain on which this contract is uploaded. */
  chainId?:    ChainId    = undefined
  /** Address of agent that performed the upload. */
  uploadBy?:   Address    = undefined
  /** TXID of transaction that performed the upload. */
  uploadTx?:   TxHash     = undefined
  /** Code ID representing the identity of the contract's code on a specific chain. */
  codeId?:     CodeId     = undefined

  constructor (options: Partial<ContractTemplate> = {}) {
    super(options as Partial<Metadata>)
  }

  /** Uploaded templates can be passed to factory contracts in this format. */
  get asInfo (): ContractInfo {
    if (!this.codeId || isNaN(Number(this.codeId)) || !this.codeHash) {
      throw new ClientError.Unpopulated()
    }
    return templateStruct(this)
  }

  /** Compile the source using the selected builder.
    * @returns this */
  build (builder?: Builder): Promise<typeof this> {
    return build(this, builder)
  }

  /** Throw appropriate error if not buildable. */
  static assertBuilder ({ builder }: { builder?: Builder }): Builder {
    //if (!this.crate) throw new ClientError.NoCrate()
    if (!builder) throw new ClientError.NoBuilder()
    //if (typeof builder === 'string') throw new ClientError.ProvideBuilder(builder)
    return builder
  }

  /** Returns a string in the format `crate[@ref][+flag][+flag]...` */
  static getSourceSpecifier <C extends ContractTemplate> (meta: C): string {
    const { crate, revision, features } = meta
    let result = crate ?? ''
    if (revision !== 'HEAD') result = `${result}@${revision}`
    if (features && features.length > 0) result = `${result}+${features.join('+')}`
    return result
  }
}

export function build <T extends ContractTemplate> (
  source:   T,
  builder?: Builder
): PromiseLike<T> {
  const { assertBuilder, getSourceSpecifier } = source.constructor as typeof ContractTemplate
  builder ??= assertBuilder(source)
  const name = 'build  ' + getSourceSpecifier(source)
  return source.task(name, async (): Promise<T> => {
    if (source.artifact) return source
    const result = await builder!.build(source)
    return result
  })
}

export function upload <T extends ContractTemplate> (
  template:  T,
  uploader?: Uploader,
  agent?:    Agent
): PromiseLike<T> {
  // If the object already contains chain ID and code ID, that means it's uploaded
  if (template.chainId && template.codeId) {
    // If it also has the code hash, we're good to go
    if (template.codeHash) return Promise.resolve(template)
    // If it has no code hash, fetch it from the chain by the code id and that's it
    return template.fetchCodeHashByCodeId().then(codeHash=>Object.assign(template, { codeHash }))
  }
  // If the chain ID or code hash is missing though, it means we need to upload
  const { getSourceSpecifier } = template.constructor as typeof ContractInstance
  // Name the task
  const name = `upload ${getSourceSpecifier(template)}`
  return template.task(name, async (): Promise<T> => {
    // Otherwise we're gonna need the uploader
    uploader ??= assertUploader(template)
    // And if we still can't determine the chain ID, bail
    const chainId = undefined
      ?? uploader.chain?.id
      ?? uploader.agent?.chain?.id
      ?? (template as any)?.agent?.chain?.id
    if (!chainId) throw new ClientError.NoChainId()
    // If we have chain ID and code ID, try to get code hash
    if (template.codeId) template.codeHash = await template.fetchCodeHashByCodeId()
    // Replace with built and return uploaded
    if (!template.artifact) await template.build()
    return uploader.upload(template)
  })
}

export class ContractInstance extends ContractTemplate implements StructuredLabel {
  /** Address of agent that performed the init tx. */
  initBy?:  Address = undefined
  /** Address of agent that performed the init tx. */
  initMsg?: Message = undefined
  /** TXID of transaction that performed the init. */
  initTx?:  TxHash  = undefined
  /** Address of this contract instance. Unique per chain. */
  address?: Address = undefined
  /** Full label of the instance. Unique for a given Chain. */
  label?:   Label   = undefined
  /** Prefix of the instance.
    * Identifies which Deployment the instance belongs to, if any.
    * Prepended to contract label with a `/`: `PREFIX/NAME...` */
  prefix?:  Name    = undefined
  /** Proper name of the instance.
    * If the instance is not part of a Deployment, this is equal to the label.
    * If the instance is part of a Deployment, this is used as storage key.
    * You are encouraged to store application-specific versioning info in this field. */
  name?:    Name    = undefined
  /** Deduplication suffix.
    * Appended to the contract label with a `+`: `...NAME+SUFFIX`.
    * This field has sometimes been used to redeploy an new instance
    * within the same Deployment, taking the place of the old one.
    * TODO: implement this field's semantics: last result of **alphanumeric** sort of suffixes
    *       is "the real one" (see https://stackoverflow.com/a/54427214. */
  suffix?:  Name    = undefined

  constructor (options: Partial<ContractInstance> = {}) {
    super(options as Partial<ContractTemplate>)
  }

  /** Get link to this contract in Fadroma ICC format. */
  get asLink (): ContractLink {
    return { address: assertAddress(this), code_hash: assertCodeHash(this) }
  }

  /** Upload compiled source code to the selected chain.
    * @returns this with chainId and codeId populated. */
  upload (uploader?: Uploader): Promise<typeof this> {
    if (this.chainId && this.codeId) {
      if (this.codeHash) {
        return Promise.resolve(this)
      } else {
        return this.fetchCodeHashByCodeId().then(codeHash=>Object.assign(this, { codeHash }))
      }
    } else {
      const { getSourceSpecifier } = this.constructor as typeof ContractInstance
      const name = `upload ${getSourceSpecifier(this)}`
      const self = this
      return this.task(name, async (): Promise<typeof self> => {
        // Otherwise we're gonna need the uploader
        const { assertUploader } = this.constructor as typeof Contract<C>
        uploader ??= assertUploader(this)
        // And if we still can't determine the chain ID, bail
        const chainId =
          uploader.chain?.id        ??
          uploader.agent?.chain?.id ??
          this.agent?.chain?.id
        if (!chainId) throw new ClientError.NoChainId()
        // If we have chain ID and code ID, try to get code hash
        if (this.codeId) this.codeHash = await this.fetchCodeHashByCodeId()
        // Replace with built and return uploaded
        if (!this.artifact) return this.build().then(uploader.upload.bind(uploader))
        return uploader.upload(this)
      })
    }
  }

  /** Retrieves the code ID corresponding to this contract's code hash.
    * @returns `this` but with `codeId` populated. */
  static async fetchCodeId <C extends ContractInstance> (
    meta: C, agent: Agent, expected?: CodeId,
  ): Promise<C & { codeId: CodeId }> {
    return Object.assign(meta, {
      codeId: this.validateField('codeId', await agent.getCodeId(assertAddress(meta)), expected)
    })
  }

  /** Fetch the code hash by id and by address, and compare them. */
  static async fetchCodeHash <C extends ContractInstance> (
    meta: C, agent: Agent, expected?: CodeHash,
  ): Promise<C & { codeHash: CodeHash }> {
    if (!meta.address && !meta.codeId && !meta.codeHash) {
      throw new ClientError('Unable to fetch code hash: no address or code id.')
    }
    const codeHashByAddress = meta.address
      ? this.validateField('codeHashByAddress', await agent.getHash(meta.address), expected)
      : undefined
    const codeHashByCodeId  = meta.codeId
      ? this.validateField('codeHashByCodeId',  await agent.getHash(meta.codeId),  expected)
      : undefined
    if (codeHashByAddress && codeHashByCodeId && codeHashByAddress !== codeHashByCodeId) {
      throw new ClientError('Validation failed: different code hashes fetched by address and by code id.')
    }
    if (!codeHashByAddress && !codeHashByCodeId) {
      throw new ClientError('Code hash unavailable.')
    }
    const codeHash = codeHashByAddress! ?? codeHashByCodeId!
    return Object.assign(meta, { codeHash })
  }

  /** Fetch the label from the chain. */
  static async fetchLabel <C extends ContractInstance> (
    meta: C, agent: Agent, expected?: Label
  ): Promise<C & { label: Label }> {
    const label = await agent.getLabel(assertAddress(meta))
    if (!!expected) this.validateField('label', expected, label)
    const { name, prefix, suffix } = this.parseLabel(label)
    return Object.assign(meta, { label, name, prefix, suffix })
  }

  /** RegExp for parsing labels of the format `prefix/name+suffix` */
  static RE_LABEL = /((?<prefix>.+)\/)?(?<name>[^+]+)(\+(?<suffix>.+))?/

  /** Parse a label into prefix, name, and suffix. */
  static parseLabel (label: Label): StructuredLabel {
    const matches = label.match(this.RE_LABEL)
    if (!matches || !matches.groups) throw new ClientError.InvalidLabel(label)
    const { name, prefix, suffix } = matches.groups
    if (!name) throw new ClientError.InvalidLabel(label)
    return { label, name, prefix, suffix }
  }

  /** Construct a label from prefix, name, and suffix. */
  static writeLabel ({ name, prefix, suffix }: StructuredLabel = {}): Label {
    if (!name) throw new ClientError.NoName()
    let label = name
    if (prefix) label = `${prefix}/${label}`
    if (suffix) label = `${label}+${suffix}`
    return label
  }
}

export interface StructuredLabel { label?: string, name?: string, prefix?: string, suffix?: string }

/// # ACT III. CONTRACT, DEPLOYMENT ///////////////////////////////////////////////////////////////

export class Contract<C extends Client> extends ContractInstance implements PromiseLike<C> {
  log = new ClientConsole('Fadroma.Contract')
  /** Deployment that this contract is a part of. */
  deployment?: Deployment     = undefined
  /** The agent that will upload and instantiate this contract. */
  agent?:      Agent          = this.deployment?.agent
  /** Build procedure implementation. */
  builder?:    Builder        = this.deployment?.builder
  /** Upload procedure implementation. */
  uploader?:   Uploader       = this.deployment?.uploader
  /** The Client subclass that exposes the contract's methods.
    * @default the base Client class. */
  client:      ClientClass<C> = Client as unknown as ClientClass<C>

  constructor (
    specifier?: Partial<Contract<C>>,
    overrides:  Partial<Contract<C>> = {}
  ) {
    super()
    override<Contract<C>>(this, { ...specifier??{}, ...overrides??{} })
    if (this.builderId)  this.builder  = Builder.get(this.builderId)
    if (this.uploaderId) this.uploader = Uploader.get(this.uploader)
  }

  /** @returns the contract's metadata */
  get meta (): ContractInstance {
    return new ContractInstance(this)
  }

  /** Provide parameters for an existing contract.
    * @returns the modified contract. */
  provide (options: Partial<typeof this>): this {
    super.provide(options)
    // If this Contract is now part of a Deployment,
    // inherit the prefix from the deployment.
    if (this.deployment) {
      const self = this
      const setPrefix = (contract: Contract<C>, value: string) =>
        Object.defineProperty(contract, 'prefix', {
          enumerable: true,
          get () { return contract.deployment?.name },
          set (v: string) {
            if (v !== contract.deployment?.name) (this.log??self.log).warn(
              `BUG: Overriding prefix of contract from deployment "${contract.deployment?.name}" to be "${v}"`
            )
            setPrefix(contract, v)
          }
        })
      setPrefix(this, this.deployment.name)
    }
    // Return the modified Contract
    return this
  }

  /** Evaluate this Contract, asynchronously returning a Client.
    * 1. try to get the contract from storage (if the deploy store is available)
    * 2. if that fails, try to deploy the contract (building and uploading it,
    *    if necessary and possible)
    * @returns promise of instance of `this.client`
    * @throws  if not found and not deployable  */
  then <D, E> (
    onfulfilled?: ((client: C)   => D|PromiseLike<D>) | null,
    onrejected?:  ((reason: any) => E|PromiseLike<E>) | null
  ): PromiseLike<D|E> {
    return this.deploy().then(onfulfilled, onrejected)
  }

  /** Deploy the contract, or retrieve it if it's already deployed.
    * @returns promise of instance of `this.client`  */
  deploy (initMsg: IntoMessage|undefined = this.initMsg): PromiseLike<C> {
    return this.task(`get or deploy ${this.name ?? 'contract'}`, () => {
      const deployed = this.getClientOrNull()
      if (deployed) {
        this.log.foundDeployedContract(deployed.address!, this.name!)
        return Promise.resolve(deployed)
      }
      const name = `deploy ${this.name ?? 'contract'}`
      return this.task(name, () => {
        if (!this.agent) throw new ClientError.NoCreator(this.name)
        const { writeLabel } = this.constructor as typeof ContractInstance
        this.label = writeLabel(this)
        if (!this.label) throw new ClientError.NoInitLabel(this.name)
        return this.upload().then(async template=>{
          if (this !== template) this.log.warn('bug: uploader returned different instance')
          if (!this.codeId) throw new ClientError.NoInitCodeId(this.name)
          this.log.beforeDeploy(this, this.label!)
          if (initMsg instanceof Function) initMsg = await Promise.resolve(initMsg())
          const contract = await this.agent!.instantiate(this, this.label!, initMsg as Message)
          this.log.afterDeploy(contract)
          if (this.deployment) this.deployment.add(this.name!, contract)
          return this.getClient()
        })
      })
    })
  }

  /** Async wrapper around getClientSync.
    * @returns a Client instance pointing to this contract
    * @throws if the contract address could not be determined */
  getClient ($Client: ClientClass<C> = this.client): Promise<C> {
    return Promise.resolve(this.getClientSync($Client))
  }
  /** @returns a Client instance pointing to this contract
    * @throws if the contract address could not be determined */
  getClientSync ($Client: ClientClass<C> = this.client): C {
    const client = this.getClientOrNull($Client)
    if (!client) throw new ClientError.NotFound($Client.name, this.name, this.deployment?.name)
    return client
  }
  /** @returns a Client instance pointing to this contract, or null if
    * the contract address could not be determined */
  getClientOrNull ($Client: ClientClass<C> = this.client): C|null {
    if (this.address) {
      return new this.client(this.agent, this.address, this.codeHash, this.meta)
    }
    if (this.deployment && this.name && this.deployment.has(this.name)) {
      const { address, codeHash } = this.deployment.get(this.name)!
      return new this.client(this.agent, address, codeHash, this.meta)
    }
    return null
  }
}

export class Contracts<C extends Client> extends ContractTemplate implements PromiseLike<C[]> {
  log = new ClientConsole('Fadroma.Contract')
  /** Deployment that this contract is a part of. */
  deployment?: Deployment     = undefined
  /** The agent that will upload and instantiate these contracts. */
  agent?:      Agent          = this.deployment?.agent
  /** Build procedure implementation. */
  builder?:    Builder        = this.deployment?.builder
  /** Upload procedure implementation. */
  uploader?:   Uploader       = this.deployment?.uploader
  /** The Client subclass that exposes the contract's methods.
    * @default the base Client class. */
  client:      ClientClass<C> = Client as unknown as ClientClass<C>
  /** A list of [Label, InitMsg] pairs that are used to instantiate the contracts. */
  inits?:      IntoArray<DeployArgs> = undefined
  /** A filter predicate for recognizing deployed contracts. */
  match?:      (meta: Partial<ContractInstance>) => boolean|undefined

  constructor (options: Partial<Contracts<C>> = {}) {
    super()
    override(this, options)
  }

  get asTemplate (): ContractTemplate {
    return new ContractTemplate(this)
  }

  /** Evaluate this Contract, asynchronously returning a Client.
    *   1. try to get the contract from storage (if the deploy store is available)
    *   2. if that fails, try to deploy the contract (building and uploading it,
    *      if necessary and possible)
    * @returns an instance of `this.client` */
  then <D, E> (
    onfulfilled?: ((client: C[]) => D|PromiseLike<D>) | null,
    onrejected?:  ((reason: any) => E|PromiseLike<E>) | null
  ): PromiseLike<D|E> {
    return this.deploy().then(onfulfilled, onrejected)
  }

  /** Deploy multiple instances of the same code. */
  deploy () {
    let name = undefined
      ?? (this.codeId && `code id ${this.codeId}`)
      ?? (this.crate  && `crate ${this.crate}`)
      ?? 'a contract'
    name = `deploy ${name}`
    return this.task(name, async (): Promise<C[]> => {
      // get the inits if passed lazily
      const inits = await intoArray(this.inits??[], this.deployment)
      // if deploying 0 contracts we're already done
      if (inits.length === 0) return Promise.resolve([])
      const agent = assertAgent(this)
      return this.upload().then(async (contract: Contract<C>)=>{
        // at this point we should have a code id
        if (!this.codeId) throw new ClientError.NoInitCodeId(this.name)
        // add deployment prefix
        const prefixedInits = (inits as DeployArgs[]).map(([label, msg])=>[
          this.deployment ? `${this.deployment.name}/${label}` : label,
          msg
        ] as DeployArgs)
        try {
          const responses = await agent.instantiateMany(contract, prefixedInits)
          const clients = responses.map(({ address })=>
            new this.client(this.agent, address, this.codeHash, this.meta))
          if (this.deployment) {
            for (const i in (inits as DeployArgs[])) {
              this.deployment.add((inits as DeployArgs[])[i][0], clients[i].meta)
            }
          }
          return clients
        } catch (e) {
          this.log.deployManyFailed(contract, (inits as DeployArgs[]), e as Error)
          throw e
        }
      })
    })
  }

  get () {
    const { deployment, match } = this
    if (!deployment) throw new ClientError.NoDeployment()
    if (!match) throw new ClientError.NoPredicate()
    const info = match.name
      ? `get all contracts matching predicate: ${match.name}`
      : `get all contracts matching specified predicate`
    return this.task(info, () => {
      const clients: C[] = []
      for (const info of Object.values(deployment.state)) {
        if (!match(info)) continue
        clients.push(new Contract(this.asTemplate as Partial<Contract<C>>).provide(info).getClientSync())
      }
      return Promise.resolve(clients)
    })
  }
}

export interface NewContract<C extends Client> {
  new (...args: ConstructorParameters<typeof Contract<C>>): Contract<C>
}

export type DeploymentState = Record<string, Partial<Contract<any>>>

/** A set of interrelated contracts, deployed under the same prefix.
  * - Extend this class in client library to define how the contracts are found.
  * - Extend this class in deployer script to define how the contracts are deployed. */
export class Deployment extends CommandContext {

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
    Object.defineProperty(this, 'log', { enumerable: false, writable: true })
    Object.defineProperty(this, 'state', { enumerable: false, writable: true })

    this.addCommand('build', 'build all required contracts',
                    () => this.buildMany([]))
    this.addCommand('upload', 'upload all required contracts',
                    () => this.buildMany([]).then(this.uploadMany))
  }

  /** Name of deployment. Used as label prefix of deployed contracts. */
  name:        string = timestamp()
  /** Mapping of names to contract instances. */
  state:       DeploymentState = {}
  /** Number of contracts in deployment. */
  get size () { return Object.keys(this.state).length }

  /** Default Git ref from which contracts will be built if needed. */
  repository?: string = undefined
  /** Default Cargo workspace from which contracts will be built if needed. */
  workspace?:  string = undefined
  /** Default Git ref from which contracts will be built if needed. */
  revision?:   string = 'HEAD'
  /** Build implementation. Contracts can't be built from source if this is missing. */
  builder?:    Builder
  /** Build multiple contracts. */
  async buildMany (contracts: (string|Contract<any>)[]): Promise<Contract<any>[]> {
    if (!this.builder) throw new ClientError.NoBuilder()
    if (contracts.length === 0) return Promise.resolve([])
    contracts = contracts.map(contract=>{
      if (typeof contract === 'string') return this.contract({ crate: contract })
      return contract
    })
    const count = (contracts.length > 1)
      ? `${contracts.length} contract: `
      : `${contracts.length} contracts:`
    const sources = (contracts as Contract<any>[])
      .map(contract=>`${contract.crate}@${contract.revision}`)
      .join(', ')
    return this.task(`build ${count} ${sources}`, () => {
      if (!this.builder) throw new ClientError.NoBuilder()
      return this.builder.buildMany(contracts)
    })
  }

  /** Agent to use when deploying contracts. */
  agent?:      Agent
  /** Chain on which operations are executed. */
  chain?:      Chain
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
  async uploadMany (contracts: Contract<any>[]): Promise<Contract<any>[]> {
    if (!this.uploader) throw new ClientError.NoUploader()
    if (contracts.length === 0) return Promise.resolve([])
    contracts = contracts.map(contract=>{
      if (typeof contract === 'string') return this.contract({ crate: contract })
      return contract
    })
    const count = (contracts.length > 1)
      ? `${contracts.length} contract: `
      : `${contracts.length} contracts:`
    return this.task(`upload ${count} artifacts`, () => {
      if (!this.uploader) throw new ClientError.NoUploader()
      return this.uploader.uploadMany(contracts)
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
  contract <C extends Client> (options?: Partial<Contract<C>>): Contract<C> {
    options = {
      deployment: this,
      prefix:     this.name,
      builder:    this.builder,
      uploader:   this.uploader,
      agent:      this.agent,
      repository: this.repository,
      revision:   this.revision,
      workspace:  this.workspace,
      ...options
    }
    // If a contract with this name exists in the deploymet,
    // inherit properties from it. TODO just return the same contract
    if (options.name && this.has(options.name)) {
      const existing = this.get(options.name)
      options = { ...existing, ...options }
    }
    return new Contract<C>().provide(options)
  }

  /** Specify multiple contracts.
    * @returns an array of Contract instances matching the specified predicate. */
  contracts <C extends Client> (options: Partial<Contracts<C>>): Contracts<C> {
    return new Contracts({ ...options, deployment: this })
  }

  /** Check if the deployment contains a certain entry. */
  has (name: string): boolean {
    return !!this.state[name]
  }
  /** Throw if a certain contract is not found in the records. */
  expect (name: string, message?: string): Contract<any> {
    message ??= `${name}: no such contract in deployment`
    const receipt = this.get(name)
    if (receipt) return this.contract({...receipt, name})
    throw new ClientError(message)
  }
  /** Get the receipt for a contract, containing its address, codeHash, etc. */
  get (name: string): Partial<Contract<any>>|null {
    const receipt = this.state[name]
    if (!receipt) return null
    return { ...receipt, deployment: this }
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
  /** Overridden by Deployer subclass in @fadroma/deploy
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

/// ACT IV. ABSTRACT BUILDER, ABSTRACT UPLOADER, ABSTRACT DEPLOY STORE ////////////////////////////

/** Builders can be specified as ids, class names, or objects. */
export type IntoBuilder = string|BuilderClass<Builder>|Partial<Builder>

export type IntoSource = string|Contract<any>

/** Builder: turns `Source` into `Contract`, providing `artifact` and `codeHash` */
export abstract class Builder extends CommandContext {
  /** Populated by @fadroma/build */
  static variants: Record<string, BuilderClass<Builder>> = {}
  /** Get a Builder from a specifier and optional overrides. */
  static get (specifier: IntoBuilder = '', options: Partial<Builder> = {}): Builder {
    if (typeof specifier === 'string') {
      const B = Builder.variants[specifier]
      if (!B) throw new ClientError.NoBuilderNamed(specifier)
      return new (B as BuilderClass<Builder>)(options)
    } else if (typeof specifier === 'function') {
      if (!options.id) throw new ClientError.NoBuilder()
      return new (specifier as BuilderClass<Builder>)(options)
    } else {
      const B = Builder.variants[specifier?.id as string]
      return new (B as BuilderClass<Builder>)({ ...specifier, ...options })
    }
  }
  /** Unique identifier of this builder implementation. */
  abstract id: string
  /** Up to the implementation.
    * `@fadroma/build` implements dockerized and non-dockerized
    * variants on top of the `build.impl.mjs` script. */
  abstract build (source: IntoSource, ...args: any[]): Promise<Contract<any>>
  /** Default implementation of buildMany is parallel.
    * Builder implementations override this, though. */
  buildMany (sources: IntoSource[], ...args: unknown[]): Promise<Contract<any>[]> {
    return Promise.all(sources.map(source=>this.build(source, ...args)))
  }
}

export type IntoUploader = string|UploaderClass<Uploader>|Partial<Uploader>

/** Uploader: uploads a `Contract`'s `artifact` to a specific `Chain`,
  * binding the `Contract` to a particular `chainId` and `codeId`. */
export abstract class Uploader {
  /** Populated by @fadroma/deploy */
  static variants: Record<string, UploaderClass<Uploader>> = {}
  /** Get a Builder from a specifier and optional overrides. */
  static get (specifier: IntoUploader = '', options: Partial<Uploader> = {}): Uploader {
    if (typeof specifier === 'string') {
      const U = Uploader.variants[specifier]
      if (!U) throw new ClientError.NoUploaderNamed(specifier)
      return new (U as UploaderClass<Uploader>)(options)
    } else if (typeof specifier === 'function') {
      if (!options.id) throw new ClientError.NoUploader()
      return new (specifier as UploaderClass<Uploader>)(options)
    } else {
      const U = Uploader.variants[specifier?.id as string]
      return new (U as UploaderClass<Uploader>)({ ...specifier, ...options })
    }
  }
  constructor (public agent?: Agent|null) {}
  /** Chain to which this uploader uploads contracts. */
  get chain () { return this.agent?.chain }
  /** Fetch the code hash corresponding to a code ID */
  async getHash (id: CodeId): Promise<CodeHash> {
    return await this.agent!.getHash(Number(id))
  }
  /** Unique identifier of this uploader implementation. */
  abstract id: string
  /** Upload a contract. */
  abstract upload <T extends ContractTemplate> (template: T): Promise<T>
  /** Upload multiple contracts. */
  abstract uploadMany (templates: ContractTemplate[]): Promise<ContractTemplate[]>
}

/** A transaction hash, uniquely identifying an executed transaction on a chain. */
export type TxHash       = string

/** Pair of name and init message. Used when instantiating multiple contracts from one template. */
export type DeployArgs = [Name, Message]

/** A moment in time. */
export type Moment   = number

/** A period of time. */
export type Duration = number

/** The default Git ref when not specified. */
export const HEAD = 'HEAD'

export { ClientConsole, ClientError }

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
  abstract set    (name: string, state?: Record<string, Partial<Contract<any>>>): void
  /** Create a new deployment. */
  abstract create (name?: string): Promise<Deployment>
  /** Activate a new deployment, or throw if such doesn't exist. */
  abstract select (name: string):  Promise<Deployment>
  /** Get the active deployment, or null if there isn't one. */
  abstract get active (): Deployment|null

  defaults: Partial<Deployment> = {}
}

export { Task }
