import { ClientError, ClientConsole } from './client-events'
import type { Into } from './client-fields'
import { into } from './client-fields'
import type { Class } from './client-fields'
import { Contract, ContractInstance } from './client-contract'
import type {
  Name, CodeId, CodeHash, Client, ClientClass, ContractTemplate, Label
} from './client-contract'
import type { Uint128 } from './client-math'

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

/** Options for connecting to a chain. */
export interface ChainOpts {
  /** API URL to use. */
  url:  string
  /** Whether this is a mainnet/testnet/devnet/mocknet. */
  mode: ChainMode
  /** Interface to devnet, if applicable. */
  node: DevnetHandle
}

export interface DevnetHandle {
  chainId: string
  url: URL
  respawn (): Promise<unknown>
  terminate (): Promise<this>
  getGenesisAccount (name: string): Promise<AgentOpts>
}

/** A constructor for a Chain subclass. */
export interface ChainClass<C> extends Class<C, ConstructorParameters<typeof Chain>> {
  Agent: AgentClass<Agent> // static
}

/** @returns the chain of a thing
  * @throws  ExpectedChain if missing. */
export function assertChain <C extends Chain> (thing: { chain?: C|null } = {}): C {
  if (!thing.chain) throw new ClientError.NoChain(thing.constructor?.name)
  return thing.chain
}

/** Represents a particular chain. */
export abstract class Chain {

  static mainnet <C extends Chain> (id: ChainId, options: Partial<ChainOpts>): C {
    const self = this as unknown as ChainClass<C>
    return new self(id, { ...options, mode: Chain.Mode.Mainnet })
  }
  static testnet <C extends Chain> (id: ChainId, options: Partial<ChainOpts>): C {
    const self = this as unknown as ChainClass<C>
    return new self(id, { ...options, mode: Chain.Mode.Testnet })
  }
  static devnet <C extends Chain> (id: ChainId, options: Partial<ChainOpts>): C {
    const self = this as unknown as ChainClass<C>
    return new self(id, { ...options, mode: Chain.Mode.Devnet })
  }
  static mocknet <C extends Chain> (id: ChainId, options: Partial<ChainOpts>): C {
    const self = this as unknown as ChainClass<C>
    return new self(id, { ...options, mode: Chain.Mode.Mocknet })
  }

  constructor (
    readonly id: ChainId,
    options: Partial<ChainOpts> = {}
  ) {
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
    Object.defineProperties(this, {
      'id':    { enumerable: false, writable: true },
      'url':   { enumerable: false, writable: true },
      'mode':  { enumerable: false, writable: true },
      'log':   { enumerable: false, writable: true },
      'Agent': { enumerable: false, writable: true },
    })
  }

  get [Symbol.toStringTag]() { return `${this.mode}: ${this.id} @ ${this.url}` }

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
    return this.height.then(async startingHeight=>{
      this.log.waitingForNextBlock(startingHeight)
      return new Promise(async (resolve, reject)=>{
        try {
          while (true) {
            await new Promise(ok=>setTimeout(ok, 100))
            const height = await this.height
            if (height > startingHeight) return resolve(height)
          }
        } catch (e) {
          reject(e)
        }
      })
    })
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
    options!.chain = this
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

/** An address on a chain. */
export type Address = string

/** @returns the address of a thing
  * @throws  LinkNoAddress if missing. */
export function assertAddress ({ address }: { address?: Address|null } = {}): Address {
  if (!address) throw new ClientError.LinkNoAddress()
  return address
}

/** A constructor for an Agent subclass. */
export interface AgentClass<A extends Agent> extends Class<A, ConstructorParameters<typeof Agent>>{
  Bundle: BundleClass<Bundle> // static
}

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

/** @returns the agent of a thing
  * @throws  ExpectedAgent if missing. */
export function assertAgent <A extends Agent> (thing: { agent?: A|null } = {}): A {
  if (!thing.agent) throw new ClientError.ExpectedAgent(thing.constructor?.name)
  return thing.agent
}

/** By authenticating to a network you obtain an Agent,
  * which can perform transactions as the authenticated identity. */
export abstract class Agent {
  constructor (options: Partial<AgentOpts> = {}) {
    this.chain = options.chain ?? this.chain
    this.name  = options.name  ?? this.name
    this.fees  = options.fees  ?? this.fees
    Object.defineProperties(this, {
      'chain':   { enumerable: false, writable: true },
      'address': { enumerable: false, writable: true },
      'log':     { enumerable: false, writable: true },
      'Bundle':  { enumerable: false, writable: true }
    })
  }

  get [Symbol.toStringTag]() { return `${this.chain?.id??'-'}: ${this.address}` }

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
    return assertChain(this).defaultDenom
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
    return assertChain(this).height
  }
  /** Wait until the block height increments. */
  get nextBlock () {
    return assertChain(this).nextBlock
  }
  /** Get the code ID of a contract. */
  getCodeId (address: Address) {
    return assertChain(this).getCodeId(address)
  }
  /** Get the label of a contract. */
  getLabel (address: Address) {
    return assertChain(this).getLabel(address)
  }
  /** Get the code hash of a contract or template. */
  getHash (address: Address|number) {
    return assertChain(this).getHash(address)
  }
  /** Check the code hash of a contract at an address against an expected value. */
  checkHash (address: Address, codeHash?: CodeHash) {
    return assertChain(this).checkHash(address, codeHash)
  }
  /** Query a contract on the chain. */
  query <R> (contract: Client, msg: Message): Promise<R> {
    return assertChain(this).query(contract, msg)
  }
  /** Send native tokens to 1 recipient. */
  abstract send (to: Address, amounts: ICoin[], opts?: ExecOpts): Promise<void|unknown>
  /** Send native tokens to multiple recipients. */
  abstract sendMany (outputs: [Address, ICoin[]][], opts?: ExecOpts): Promise<void|unknown>
  /** Upload code, generating a new code id/hash pair. */
  abstract upload (blob: Uint8Array): Promise<ContractTemplate>
  /** Upload multiple pieces of code, generating multiple CodeID/CodeHash pairs.
    * @returns Contract[] */
  uploadMany (blobs: Uint8Array[] = []): Promise<ContractTemplate[]> {
    return Promise.all(blobs.map(blob=>this.upload(blob)))
  }
  /** Create a new smart contract from a code id, label and init message.
    * @example
    *   await agent.instantiate(template.provide({ label, initMsg })
    * @returns
    *   ContractInstance with no `address` populated yet.
    *   This will be populated after executing the bundle. */
  abstract instantiate (instance: ContractInstance): PromiseLike<ContractInstance>
  /** Create multiple smart contracts from a ContractTemplate (providing code id)
    * and a list or map of label/initmsg pairs.
    * Uses this agent's Bundle class to instantiate them in a single transaction.
    * @example
    *   await agent.instantiateMany(template.instances({
    *     One: { label, initMsg },
    *     Two: { label, initMsg },
    *   }))
    *   await agent.instantiateMany({
    *     One: template1.instance({ label, initMsg }),
    *     Two: template2.instance({ label, initMsg }),
    *   }))
    * @returns
    *   either an Array<ContractInstance> or a Record<string, ContractInstance>,
    *   depending on what is passed as inputs. */
  instantiateMany (instances: Record<Name, ContractInstance>):
    Promise<Record<Name, ContractInstance>>
  instantiateMany (instances: ContractInstance[]):
    Promise<ContractInstance[]>
  async instantiateMany <C> (instances: C): Promise<C> {
    // Returns an array of TX results.
    const response = await this.bundle().wrap(async bundle=>{
      await bundle.instantiateMany(instances)
    })
    // Populate instances with resulting addresses
    for (const instance of Object.values(instances)) {
      if (instance.address) continue
      // Find result corresponding to instance
      const found = response.find(({ label })=>label===instance.label)
      if (found) {
        const { address, tx, sender } = found // FIXME: implementation dependent
        instance.provide({ address, initTx: tx, initBy: sender })
      } else {
        this.log.warn(`Failed to find address for ${instance.label}.`)
        continue
      }
    }
    return instances
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

/** A transaction message that can be sent to a contract. */
export type Message = string|Record<string, unknown>

/** A transaction hash, uniquely identifying an executed transaction on a chain. */
export type TxHash = string

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

/** A gas fee, payable in native tokens. */
export interface IFee { amount: readonly ICoin[], gas: Uint128 }

/** Represents some amount of native token. */
export interface ICoin { amount: Uint128, denom: string }

/** A constructable gas fee in native tokens. */
export class Fee implements IFee {
  readonly amount: readonly ICoin[]
  constructor (amount: Uint128|number, denom: string, readonly gas: string = String(amount)) {
    this.amount = [{ amount: String(amount), denom }]
  }
}

/** Represents some amount of native token. */
export class Coin implements ICoin {
  readonly amount: string
  constructor (amount: number|string, readonly denom: string) {
    this.amount = String(amount)
  }
}

Chain.Agent = Agent as AgentClass<Agent>

/** A constructor for a Bundle subclass. */
export interface BundleClass<B extends Bundle> extends Class<B, ConstructorParameters<typeof Bundle>>{
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
  /** Add an init message to the bundle.
    * @example
    *   await agent.instantiate(template.provide({ label, initMsg })
    * @returns
    *   the unmodified input. */
  async instantiate (instance: ContractInstance): Promise<ContractInstance> {
    const label    = instance.label
    const codeId   = String(instance.codeId)
    const codeHash = instance.codeHash
    const sender   = this.address
    const msg = instance.initMsg = await into(instance.initMsg)
    this.add({ init: { codeId, codeHash, label, msg, sender, funds: [] } })
    return instance
  }
  /** Add multiple init messages to the bundle.
    * @example
    *   await agent.bundle().wrap(async bundle=>{
    *     await bundle.instantiateMany(template.instances({
    *       One: { label, initMsg },
    *       Two: { label, initMsg },
    *     }))
    *     await agent.instantiateMany({
    *       One: template1.instance({ label, initMsg }),
    *       Two: template2.instance({ label, initMsg }),
    *     })
    *   })
    * @returns
    *   the unmodified inputs. */
  async instantiateMany <C> (inputs: C): Promise<C> {
    const outputs: any = (inputs instanceof Array) ? [] : {}
    await Promise.all(Object.entries(inputs).map(
      async ([key, instance]: [Name, ContractInstance])=>{
        outputs[key] = instance.address
          ? instance
          : await this.instantiate(instance) }))
    return outputs
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

  get [Symbol.toStringTag]() { return `(${this.msgs.length}) [${this.address}]` }

}

Agent.Bundle = Bundle as unknown as BundleClass<Bundle>

/** Function passed to Bundle#wrap */
export type BundleCallback<B extends Bundle> = (bundle: B)=>Promise<void>
