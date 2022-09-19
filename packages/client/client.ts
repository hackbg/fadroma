import { CustomError, bold, timestamp } from '@hackbg/konzola'
import { Task, CommandContext, CommandsConsole } from '@hackbg/komandi'

/** Overridable Value Object helper.
  * Used in constructors to allow properties to be defined with minimum hassle. */
export function override <T extends object> (
  self:    T,
  options: Partial<T>
) {
  for (const [key, val] of Object.entries(options)) {
    if (val === undefined) continue
    const exists = key in self
    const writable = Object.getOwnPropertyDescriptor(self, key)?.writable ?? true
    if (exists && writable) Object.assign(self, { [key]: val })
  }
}

/** Constructor that implements the Overridable Value Object pattern. */
export interface New<T, U> {
  new (overrides?: Partial<T>): T
  new (specifier?: U|Partial<T>, overrides?: Partial<T>): T
}

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

export interface ChainCtor<O extends ChainOpts> { new (id: ChainId, options?: Partial<O>) }

/** Represents a particular chain. */
export abstract class Chain {

  log = new ClientConsole('Fadroma.Chain')

  /** Async functions that return Chain instances in different modes.
    * Values for `FADROMA_CHAIN` environment variable. */
  static variants: ChainRegistry = {}

  static Mode = ChainMode

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

  isSecretNetwork = false

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

  /** Get the current block height. */
  abstract get height (): Promise<number>

  /** Wait for the block height to increment. */
  get nextBlock (): Promise<number> {
    this.log.waitingForNextBlock()
    return new Promise((resolve, reject)=>{
      this.height.then(async startingHeight=>{
        try {
          while (true) {
            await new Promise(ok=>setTimeout(ok, 100))
            const height = await this.height
            if (height > startingHeight) {
              resolve(height)
            }
          }
        } catch (e) {
          reject(e)
        }
      })
    })
  }

  /** Get a new instance of the appropriate Agent subclass. */
  async getAgent <A extends Agent> (
    options: Partial<AgentOpts> = {},
    _Agent:  AgentCtor<Agent> = this.Agent as AgentCtor<Agent>
  ): Promise<A> {
    if (this.node) await this.node.respawn()
    if (!options.mnemonic && options.name) {
      if (!this.node) throw new ClientError.NameOutsideDevnet()
      options = await this.node.getGenesisAccount(options.name)
    }
    const agent = await _Agent.create(this, options) as A
    return agent
  }

  /** The Agent subclass to use for interacting with this chain. */
  Agent: AgentCtor<Agent> = (this.constructor as Function & { Agent: AgentCtor<Agent> }).Agent

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

  log = new ClientConsole('Fadroma.Agent')

  static create (chain: Chain, options: AgentOpts = {}): Promise<Agent> {
    //@ts-ignore
    return new this(chain, options)
    Object.defineProperty(this, 'log', { enumerable: false, writable: true })
  }

  constructor (readonly chain: Chain, options: AgentOpts = {}) {
    this.chain = chain
    if (options.name) this.name = options.name
    if (options.fees) this.fees = options.fees
    Object.defineProperty(this, 'chain', { enumerable: false })
    Object.defineProperty(this, 'log',   { enumerable: false })
  }

  /** The address from which transactions are signed and sent. */
  address?: Address

  /** The friendly name of the agent. */
  name?:    string

  /** Default fee maximums for send, upload, init, and execute. */
  fees?:    AgentFees

  /** The default denomination in which the agent operates. */
  get defaultDenom () { return this.chain.defaultDenom }

  /** Get the balance of this or another address. */
  getBalance (denom = this.defaultDenom, address = this.address): Promise<string> {
    if (!address) throw new ClientError.BalanceNoAddress()
    return this.chain.getBalance(denom, address)
  }

  /** This agent's balance in the chain's native token. */
  get balance (): Promise<string> { return this.getBalance() }

  /** The chain's current block height. */
  get height (): Promise<number> { return this.chain.height }

  /** Wait until the block height increments. */
  get nextBlock () { return this.chain.nextBlock }

  /** Get the code ID of a contract. */
  getCodeId (address: Address) { return this.chain.getCodeId(address) }

  /** Get the label of a contract. */
  getLabel  (address: Address) { return this.chain.getLabel(address) }

  /** Get the code hash of a contract or template. */
  getHash   (address: Address|number) { return this.chain.getHash(address) }

  checkHash (address: Address, codeHash?: CodeHash) {
    return this.chain.checkHash(address, codeHash)
  }

  query <R> (contract: Client, msg: Message): Promise<R> {
    return this.chain.query(contract, msg)
  }

  /** Send native tokens to 1 recipient. */
  abstract send     (to: Address, amounts: ICoin[], opts?: ExecOpts): Promise<void|unknown>

  /** Send native tokens to multiple recipients. */
  abstract sendMany (outputs: [Address, ICoin[]][], opts?: ExecOpts): Promise<void|unknown>

  /** Upload code, generating a new code id/hash pair. */
  abstract upload (blob: Uint8Array): Promise<Contract<any>>

  /** Upload multiple pieces of code, generating multiple code id/hash pairs. */
  uploadMany (blobs: Uint8Array[] = []): Promise<Contract<any>[]> {
    return Promise.all(blobs.map(blob=>this.upload(blob)))
  }

  /** Create a new smart contract from a code id, label and init message. */
  abstract instantiate (template: Contract<any>, label: Label, msg: Message): Promise<Contract<any>>

  /** Create multiple smart contracts from a list of code id/label/init message triples. */
  instantiateMany (template: Contract<any>, configs: DeployArgs[]): Promise<Contract<any>[]> {
    return Promise.all(configs.map(config=>this.instantiate(template, ...config)))
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

  Bundle: BundleCtor<Bundle> = (this.constructor as AgentCtor<typeof this>).Bundle

  static Bundle: BundleCtor<Bundle>

  /** Get a client instance for talking to a specific smart contract as this executor. */
  getClient <C extends Client> (
    $Client:   NewClient<C>,
    address?:  Address,
    codeHash?: CodeHash
  ): C {
    return new $Client(this, address, codeHash) as C
  }

}

//@ts-ignore
Chain.Agent = Agent

export interface AgentCtor<A extends Agent> {
  new    (chain: Chain, options: AgentOpts): A
  create (chain: Chain, options: AgentOpts): Promise<A>
  Bundle: BundleCtor<Bundle>
}

export interface AgentOpts {
  name?:     string
  mnemonic?: string
  address?:  Address
  fees?:     AgentFees
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

  log = new ClientConsole('Fadroma.Bundle')

  constructor (readonly agent: Agent) {
    if (!agent) throw new ClientError.NoBundleAgent()
    super(agent.chain)
    this.address = this.agent.address
    this.name    = `${this.agent.name}@BUNDLE`
    this.fees    = this.agent.fees
  }

  getCodeId (address: Address) {
    return this.agent.getCodeId(address)
  }

  getLabel  (address: Address) {
    return this.agent.getLabel(address)
  }

  getHash   (address: Address|number) {
    return this.agent.getHash(address)
  }

  checkHash (address: Address, codeHash?: CodeHash) {
    return this.agent.checkHash(address, codeHash)
  }

  get balance (): Promise<string> {
    throw new ClientError.NotInBundle("query balance")
  }

  async getBalance (denom: string): Promise<string> {
    throw new ClientError.NotInBundle("query balance")
  }

  get height (): Promise<number> {
    throw new ClientError.NotInBundle("query block height inside bundle")
  }

  get nextBlock (): Promise<number> {
    throw new ClientError.NotInBundle("wait for next block")
  }

  async send (to: Address, amounts: ICoin[], opts?: ExecOpts): Promise<void|unknown> {
    throw new ClientError.NotInBundle("send")
  }

  async sendMany (outputs: [Address, ICoin[]][], opts?: ExecOpts): Promise<void|unknown> {
    throw new ClientError.NotInBundle("send")
  }

  async instantiate (
    template: Contract<any>, label: Label, initMsg: Message, funds = []
  ): Promise<Contract<any>> {
    const codeId   = String(template.codeId)
    const codeHash = template.codeHash
    this.add({ init: { sender: this.address, codeId, codeHash, label, funds, msg: initMsg } })
    return Object.assign(new Contract(template), { codeId, codeHash, label, initMsg })
  }

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

  depth  = 0

  Bundle = this.constructor as { new (agent: Agent): Bundle }

  bundle (): this {
    this.log.warn('Nest bundles with care. Depth:', ++this.depth)
    return this
  }

  msgs: any[] = []

  id = 0

  add (msg: Message) {
    const id = this.id++
    this.msgs[id] = msg
    return id
  }

  async wrap (
    cb:   BundleCallback<this>,
    opts: ExecOpts = { memo: "" },
    save: boolean  = false
  ): Promise<any[]> {
    await cb(this)
    return this.run(opts.memo, save)
  }

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

  assertCanSubmit (): true {
    if (this.msgs.length < 1) throw new ClientError.EmptyBundle()
    return true
  }

  /** Broadcast a bundle to the chain. */
  abstract submit (memo: string): Promise<unknown>

  /** Save a bundle for manual broadcast. */
  abstract save   (name: string): Promise<unknown>

}

//@ts-ignore
Agent.Bundle = Bundle

export interface BundleCtor<B extends Bundle> {
  new (agent: Agent): B
}

/** Function passed to Bundle#wrap */
export type BundleCallback<B extends Bundle> = (bundle: B)=>Promise<void>

export interface NewClient<C extends Client> {
  new (...args: ConstructorParameters<typeof Client>): C
}

/** Client: interface to the API of a particular contract instance.
  * Has an `address` on a specific `chain`, usually also an `agent`.
  * Subclass this to add the contract's methods. */
export class Client {

  log = new ClientConsole('Fadroma.Client')

  constructor (
    /** Agent that will interact with the contract. */
    public agent?:    Agent,
    /** Address of the contract on the chain. */
    public address?:  Address,
    /** Code hash confirming the contract's integrity. */
    public codeHash?: CodeHash,
    /** Contract class containing deployment metadata. */
    public meta:      ContractMetadata = new ContractMetadata({
      address, codeHash, chainId: agent?.chain?.id
    }),
  ) {
    Object.defineProperty(this, 'log', { writable: true, enumerable: false })
    Object.defineProperty(this, 'deployment', { writable: true, enumerable: false })
    //if (!agent)    this.log.warnNoAgent(this.constructor.name)
    //if (!address)  this.log.warnNoAddress(this.constructor.name)
    //if (!codeHash) this.log.warnNoCodeHash(this.constructor.name)
  }

  /** The chain on which this contract exists. */
  get chain () {
    return this.agent?.chain
  }

  protected assertAddress (): Address {
    if (!this.address) throw new ClientError.ExpectedAddress(this.constructor.name)
    return this.address
  }

  /** Throw if trying to do something with no agent or address. */
  protected assertAgent (): Agent {
    if (!this.agent) throw new ClientError.ExpectedAgent(this.constructor.name)
    return this.agent
  }

  /** Throw if fetched metadata differs from configured. */
  protected validate (kind: string, expected: any, actual: any) {
    const name = this.constructor.name
    if (expected !== actual) throw new ClientError.ValidationFailed(kind, name, expected, actual)
  }

  /** Fetch code hash from address. */
  async fetchCodeHash (expected: CodeHash|undefined = this.codeHash): Promise<this> {
    const codeHash = await this.assertAgent().getHash(this.assertAddress())
    if (!!expected) this.validate('codeHash', expected, codeHash)
    this.codeHash = codeHash
    return this
  }

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
  as = (agent: Agent|undefined = this.agent): this =>
    (!agent || agent === this.agent)
      ? this
      : new (this.constructor as NewClient<typeof this>)(agent, this.address, this.codeHash)

  asClient = <C extends Client> (client: NewClient<C>): C =>
    new client(this.agent, this.address, this.codeHash)

  /** Execute a query on the specified contract as the specified Agent. */
  query = <U> (msg: Message): Promise<U> =>
    this.assertAgent().query(this, msg)

  /** Default fee for all contract transactions. */
  fee?: IFee = undefined

  /** Default fee for specific transactions. */
  fees?: Record<string, IFee> = undefined

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

  /** Create a copy of this Client with all transaction fees set to the provided value.
    * If the fee is undefined, returns a copy of the client with unmodified fee config. */
  withFee (fee: IFee|undefined): this {
    if (fee) {
      const Self = this.constructor as NewClient<this>
      return Object.assign(new Self(this.agent, this.address, this.codeHash), { fee, fees: {} })
    } else {
      return this
    }
  }

  /** Execute a transaction on the specified contract as the specified Agent. */
  async execute (msg: Message, opt: ExecOpts = {}): Promise<void|unknown> {
    this.assertAddress()
    this.assertAgent()
    opt.fee = opt.fee || this.getFee(msg)
    return await this.agent!.execute(this, msg, opt)
  }

}

export interface NewContract<C extends Client> {
  new (...args: ConstructorParameters<typeof Contract<C>>): Contract<C>
}

export class ContractMetadata {

  constructor (options: Partial<ContractMetadata> = {}) {
    override(this, options)
    Object.defineProperty(this, 'log', { enumerable: false, writable: true })
  }

  /** URL pointing to Git repository containing the source code. */
  repository?: string|URL = undefined
  /** Branch/tag pointing to the source commit. */
  revision?:   string     = 'HEAD'
  /** Whether there were any uncommitted changes at build time. */
  dirty?:      boolean    = undefined
  /** Path to local Cargo workspace. */
  workspace?:  string     = undefined
  /** Name of crate in workspace. */
  crate?:      string     = undefined
  /** List of crate features to enable during build. */
  features:    string[]   = []
  /** Builder implementation that produces a Contract from the Source. */
  builderId?:  string     = undefined
  /** URL to the compiled code. */
  artifact?:   string|URL = undefined
  /** Code hash uniquely identifying the compiled code. */
  codeHash?:   CodeHash   = undefined
  /** Object containing upload logic. */
  uploaderId?: string     = undefined
  /** Code ID representing the identity of the contract's code on a specific chain. */
  codeId?:     CodeId     = undefined
  /** TXID of transaction that performed the upload. */
  uploadTx?:   TxHash     = undefined
  /** ID of chain on which this contract is uploaded. */
  chainId?:    ChainId    = undefined
  /** Address of agent that performed the upload. */
  uploadedBy?: Address    = undefined
  /** Address of agent that performed the init tx. */
  initBy?:     Address    = undefined
  /** TXID of transaction that performed the init. */
  initTx?:     TxHash     = undefined
  /** The message used to instantiate the contract. */
  initMsg?:    Message    = undefined
  /** Address of this contract instance. Unique per chain. */
  address?:    Address    = undefined
  /** Label of this contract instance. Unique per chain. */
  label?:      Label      = undefined
  /** Friendly name of the contract.
    * Contracts are stored in a Deployment under this name.
    * When deploying, this name is used as the basis for the unique contract label. */
  name?:       Name       = undefined
  /** Deployment prefix of the contract.
    * Identifies which deployment this contract belongs to.
    * If defined, the label used during deployment becomes `prefix/name`. */
  prefix?:     Name       = undefined
  /** Deduplication suffix.
    * Set this when you already have a contract with a given name in a deployment,
    * and you want to deploy a new instance which replaces the old one.
    * If defined, label becomes `name+suffix` */
  suffix?:     Name       = undefined

  /** Parse a label into prefix, name, and suffix. */
  static parseLabel = (label: Label): LabelFormat => {
    const matches = label.match(RE_LABEL)
    if (!matches || !matches.groups) throw new ClientError.InvalidLabel(label)
    const { name, prefix, suffix } = matches.groups
    if (!name) throw new ClientError.InvalidLabel(label)
    return { name, prefix, suffix }
  }

  /** Construct a label from prefix, name, and suffix. */
  static writeLabel = ({ name, prefix, suffix }: LabelFormat): Label => {
    if (!name) throw new ClientError.NoName()
    let label = name
    if (prefix) label = `${prefix}/${label}`
    if (suffix) label = `${label}+${suffix}`
    return label
  }

}

/** RegExp for parsing labels of the format `prefix/name+suffix` */
export const RE_LABEL = /((?<prefix>.+)\/)?(?<name>[^+]+)(\+(?<suffix>.+))?/

/** The output of parsing a label of the format `prefix/name+suffix` */
export interface LabelFormat {
  prefix?: Name
  name?:   Name
  suffix?: Name
}

export class Contract<C extends Client> extends ContractMetadata {

  log = new ClientConsole('Fadroma.Contract')

  constructor (
    specifier?: Partial<Contract<C>>,
    overrides:  Partial<Contract<C>> = {}
  ) {
    super()
    const options = { ...specifier??{}, ...overrides??{} }
    override<Contract<C>>(this, options)
    if (this.builderId)  this.builder  = Builder.get(this.builderId)
    if (this.uploaderId) this.uploader = Uploader.get(this.uploader)
  }

  /** The agent instance that will be used to upload and instantiate this contract. */
  agent?:      Agent      = undefined

  /** Build procedure implementation. */
  builder?:    Builder    = undefined

  /** Upload procedure implementation. */
  uploader?:   Uploader   = undefined

  /** Deployment that this contract is a part of. */
  deployment?: Deployment = undefined

  /** The Client subclass that exposes the contract's methods.
    * @default the base Client class. */
  client: NewClient<C> = Client as unknown as NewClient<C>

  /** @returns the contract's metadata */
  get asMetadata (): ContractMetadata {
    return new ContractMetadata(this)
  }

  /** Throw if trying to do something with no agent or address. */
  assertAgent (): Agent {
    if (!this.agent) throw new ClientError.ExpectedAgent(this.constructor.name)
    return this.agent
  }

  assertAddress (): Address {
    if (!this.address) throw new ClientError.ExpectedAddress(this.constructor.name)
    return this.address
  }

  /** Create a copy of this Client that will execute the transactions as a different Agent. */
  as = (agent?: Agent): Contract<C> =>
    (!agent || (agent === this.agent))
      ? this
      : new (this.constructor as NewContract<C>)(this, { agent })

  /** Returns a string in the format `crate[@ref][+flag][+flag]...` */
  getSourceSpecifier (): string {
    const { crate, revision, features } = this
    let result = crate ?? ''
    if (this.revision !== 'HEAD') result = `${result}@${revision}`
    if (features && features.length > 0) result = `${result}+${features.join('+')}`
    return result
  }

  /** Throw appropriate error if not buildable. */
  assertBuildable (builder: Builder|undefined = this.builder): Builder {
    if (!this.crate) throw new ClientError.NoCrate()
    if (!builder) throw new ClientError.NoBuilder()
    //if (typeof builder === 'string') throw new ClientError.ProvideBuilder(builder)
    return builder
  }

  /** Return the Uploader for this Template or throw. */
  assertUploader (uploader: Uploader|undefined = this.uploader): Uploader {
    if (!uploader) throw new ClientError.NoUploader()
    //if (typeof uploader === 'string') throw new ClientError.ProvideUploader(uploader)
    if (!uploader.agent) throw new ClientError.NoUploaderAgent()
    return uploader
  }

  /** Throw if fetched metadata differs from configured. */
  protected validate (kind: string, expected: any, actual: any) {
    const name = this.constructor.name
    if (expected !== actual) throw new ClientError.ValidationFailed(kind, name, expected, actual)
    return this
  }

  /** Uploaded templates can be passed to factory contracts in this format: */
  get asInfo (): ContractInfo {
    if (!this.codeId || isNaN(Number(this.codeId)) || !this.codeHash) {
      throw new ClientError.Unpopulated()
    }
    return templateStruct(this)
  }

  /** Fetch the label, code ID, and code hash from the Chain.
    * You can override this method to populate custom contract info from the chain
    * for your client, e.g. fetch the symbol and decimals of a token contract.
    * @returns the same instance of Contract, with `label`, `codeId` and `codeHash` populated. */
  async populate (): Promise<this> {
    this.assertAddress()
    this.assertAgent()
    await Promise.all([
      this.fetchLabel(),
      this.fetchCodeId(),
      this.fetchCodeHashByAddress()
    ])
    return this
  }
  /** Fetch the label by the address.
    * @returns `this`, but with `label`, `name`, `prefix`, `suffix` populated. */
  async fetchLabel (expected?: CodeHash): Promise<this> {
    const label = await this.assertAgent().getLabel(this.assertAddress())
    if (!!expected) this.validate('label', expected, label)
    const { name, prefix, suffix } = ContractMetadata.parseLabel(label)
    this.name   = name
    this.prefix = prefix
    this.suffix = suffix
    return this
  }
  /** Retrieves the code ID corresponding to this contract's code hash.
    * @returns CodeId. */
  fetchCodeId = (expected?: CodeHash): Promise<CodeId> =>
    this.assertAgent().getCodeId(this.codeHash!).then(codeId=>{
      if (!!expected) this.validate('codeId', expected, codeId)
      this.codeId = codeId
      return codeId
    })
  /** Fetch code hash from address.
    * @returns code hash corresponding to `this.address` */
  fetchCodeHashByAddress = (expected: CodeHash|undefined = this.codeHash): Promise<CodeHash> =>
    this.assertAgent().getHash(this.assertAddress()).then(codeHash=>{
      if (!!expected) this.validate('codeHash', expected, codeHash)
      this.codeHash = codeHash
      return codeHash
    })
  /** Fetch code hash from code id.
    * @returns code hash corresponding to `this.codeId`  */
  fetchCodeHashByCodeId = (expected: CodeHash|undefined = this.codeHash): Promise<CodeHash> =>
    this.assertAgent().getHash(this.codeId!).then(codeHash=>{
      if (!!expected) this.validate('codeHash', expected, codeHash)
      this.codeHash = codeHash
      return codeHash
    })

  /** Lazily get a contract from the deployment.
    * @returns a Lazy invocation of getClient, or a Promise if not in task context */
  get = (): Promise<C> => this.task(
    `get ${this.name??'contract'}`,
    async function getContractClient () { return await this.getClient() })
  /** Async wrapper around getClientSync.
    * @returns a Client instance pointing to this contract
    * @throws if the contract address could not be determined */
  getClient = async ($Client: NewClient<C> = this.client): Promise<C> =>
    this.getClientSync($Client)
  /** @returns a Client instance pointing to this contract
    * @throws if the contract address could not be determined */
  getClientSync ($Client: NewClient<C> = this.client): C {
    const client = this.getClientOrNull($Client)
    if (client) return client
    throw new ClientError.NotFound($Client.name, this.name, this.deployment?.name)
  }
  /** @returns a Client instance pointing to this contract, or null if
    * the contract address could not be determined */
  getClientOrNull = ($Client: NewClient<C> = this.client): C|null => {
    if (this.address) {
      return new this.client(this.agent, this.address, this.codeHash, this.asMetadata)
    }
    if (this.deployment && this.name && this.deployment.has(this.name)) {
      const { address, codeHash } = this.deployment.get(this.name)!
      return new this.client(this.agent, address, codeHash, this.asMetadata)
    }
    return null
  }
  /** Deploy the contract, or retrieve it if it's already deployed. */
  deploy = (
    initMsg: IntoMessage|undefined = this.initMsg
  ): Promise<C> => {
    const existing = this.getClientOrNull()
    if (existing) return Promise.resolve(existing)
    const name = `deploy ${this.name ?? 'contract'}`
    return this.task(name, function getOrDeployContract (this: Contract<C>): Promise<C> {
      if (!this.agent) throw new ClientError.NoCreator(this.name)
      this.label = ContractMetadata.writeLabel(this)
      return this.upload().then(async template=>{
        this.log.beforeDeploy(this, this.label!)
        if (initMsg instanceof Function) initMsg = await Promise.resolve(initMsg())
        const contract = await this.agent!.instantiate(template, this.label!, initMsg as Message)
        this.log.afterDeploy(contract)
        if (this.deployment) this.deployment.add(this.name!, contract)
        return this.get()
      })
    })
  }
  /** Deploy multiple instances of the same code. */
  deployMany = (
    inits: (DeployArgs[])|(()=>DeployArgs[])|(()=>Promise<DeployArgs[]>)
  ): Promise<C[]> => {
    const name = `deploy ${this.name ?? 'contract'} (${inits.length} instances)`
    return this.task(name, function getOrDeployContracts (this: Contract<C>): Promise<C[]> {
      const agent = this.agent
      if (!agent) throw new ClientError.NoCreator(this.name)
      return this.upload().then(async (contract: Contract<C>)=>{
        if (typeof inits === 'function') inits = await Promise.resolve(inits())
        try {
          const instances = (await agent.instantiateMany(contract, inits)).map(c=>c.getClient())
          return await Promise.all(instances)
        } catch (e) {
          this.log.deployManyFailed(contract, inits, e as Error)
          throw e
        }
      })
    })
  }
  /** Upload compiled source code to the selected chain.
    * @returns this with chainId and codeId populated. */
  upload = (
    _uploader: Uploader|undefined = this.uploader
  ): Promise<Contract<C>> => {
    if (this.chainId && this.codeId) {
      return this.codeHash
        ? Promise.resolve(this)
        : this.fetchCodeHashByCodeId().then(codeHash=>Object.assign(this, { codeHash }))
    } else {
      const name = `upload contract ${this.getSourceSpecifier()}`
      return this.task(name, async function uploadContract (this: Contract<C>): Promise<Contract<C>> {
        // Otherwise we're gonna need an uploader
        const uploader = this.assertUploader(_uploader)
        // And if we still can't determine the chain ID, bail
        const {
          chainId = uploader.chain?.id ?? uploader.agent?.chain?.id ?? this.agent?.chain?.id
        } = this
        if (!chainId) throw new ClientError.NoChainId()
        // If we have chain ID and code ID, try to get code hash
        if (this.codeId) this.codeHash = await this.fetchCodeHashByCodeId()
        // Replace with built and return uploaded
        if (!this.artifact) return this.build().then(contract=>uploader.upload(contract))
        return uploader.upload(this)
      })
    }
  }
  /** Compile the source using the selected builder.
    * @returns this */
  build = (builder: Builder = this.assertBuildable()): Promise<Contract<C>> => {
    const name = 'build ' + this.getSourceSpecifier()
    return this.task(name, async function buildContract (this: Contract<C>): Promise<Contract<C>> {
      if (this.artifact) return this
      return builder.build(this)
    })
  }
  /** Wrap a method in a lazy task.
    * @returns A Lazy or Promise containing a task. */
  task = <T> (name: string, cb: (this: typeof this)=>Promise<T>): Task<typeof this, T> => {
    const task = new Task(name, cb, this)
    const [_, head, ...body] = (task.stack ?? '').split('\n')
    task.stack = '\n' + head + '\n' + body.slice(3).join('\n')
    return task
  }
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

export type IntoClient = Name|Partial<Client>|undefined


/** Reference to an instantiated smart contract in the format of Fadroma ICC. */
export interface ContractLink {
  readonly address:   Address
  readonly code_hash: CodeHash
}

/** Convert Fadroma.Instance to address/hash struct (ContractLink) */
export const linkStruct = (instance: IntoLink): ContractLink => ({
  address:   addressOf(instance),
  code_hash: codeHashOf(instance)
})

/** Objects that have an address and code hash.
  * Pass to linkTuple or linkStruct to get either format of link. */
export interface IntoLink extends Hashed {
  address: Address
}

export function addressOf (instance?: { address?: Address }): Address {
  if (!instance)         throw new ClientError.LinkNoTarget()
  if (!instance.address) throw new ClientError.LinkNoAddress()
  return instance.address
}

/** Group of contracts sharing the same prefix.
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
  }

  /** Name of deployment. Used as label prefix of deployed contracts. */
  name:       string = timestamp()

  /** Mapping of names to contract instances. */
  state:      Record<string, Partial<Contract<any>>> = {}

  /** Default Cargo workspace from which contracts will be built if needed. */
  workspace?: string = undefined

  /** Default Git ref from which contracts will be built if needed. */
  revision?:  string = 'HEAD'

  /** Build implementation. Contracts can't be built from source if this is missing. */
  builder?:   Builder

  /** Agent to use when deploying contracts. */
  agent?:     Agent

  /** Chain on which operations are executed. */
  chain?:     Chain

  /** Upload implementation. Contracts can't be uploaded if this is missing --
    * except by using `agent.upload` directly, which does not cache or log uploads. */
  uploader?:  Uploader

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

  /** Build multiple contracts. */
  buildMany = async (contracts: (string|Contract<any>)[]): Promise<Contract<any>[]> => {
    if (!this.builder) throw new ClientError.NoBuilder()
    return await this.builder.buildMany(contracts)
  }

  /** Upload multiple contracts to the chain.
    * @returns the same contracts, but with `chainId`, `codeId` and `codeHash` populated. */
  uploadMany = async (contracts: Contract<any>[]): Promise<Contract<any>[]> => {
    if (!this.uploader) throw new ClientError.NoUploader()
    return this.uploader.uploadMany(contracts)
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
  contract (name?: string): Contract<Client>
  contract <C extends Client> (options?: Partial<Contract<C>>): Contract<C>
  contract <C extends Client> (arg?: string|Partial<Contract<C>>) {
    const options = {
      deployment: this,
      prefix:     this.name,
      builder:    this.builder,
      uploader:   this.uploader,
      agent:      this.agent,
      revision:   this.revision,
      workspace:  this.workspace,
      ...((typeof arg === 'string') ? { name: arg } : arg)
    }
    if (options.name && this.has(options.name)) Object.assign(options, this.get(options.name))
    const contract = new Contract(options)
    return contract
  }

  /** Specify multiple contracts.
    * @returns an array of Contract instances matching the specified predicate. */
  contracts (
    predicate: (key: string, val: { name?: string }) => boolean
  ): Promise<Client[]>
  contracts <C extends Client> (
    predicate: (key: string, val: { name?: string }) => boolean,
    Client:    NewClient<C>
  ): Promise<C[]>
  contracts <C extends Client> (...args: Array<unknown>) {
    const predicate = args[0] as (key: string, val: { name?: string }) => boolean
    if (args.length > 1) {
      const Client = args[1] as NewClient<C>
      return Promise.all(this.filter(predicate).map((receipt: object)=>
        this.contract(receipt).getClientOrNull(Client)))
    } else {
      return Promise.all(this.filter(predicate).map((receipt: object)=>
        this.contract(receipt)))
    }
  }

  /** @returns Contract instances matching the provided predicate. */
  filter (predicate: (key: string, val: { name?: string }) => boolean): Contract<any>[] {
    return Object.entries(this.state)
      .filter(([key, val])=>predicate(key, val))
      .map(([name, data])=>new Contract({ name, ...data }))
  }

  /** Number of contracts in deployment. */
  get size () { return Object.keys(this.state).length }

  /** Check if the deployment contains a certain entry. */
  has (name: string): boolean {
    return !!this.state[name]
  }

  expect (name: string, message?: string): Contract<any> {
    message ??= `${name}: no such contract in deployment`
    const receipt = this.get(name)
    if (receipt) return this.contract({...receipt, name})
    throw new ClientError(message)
  }

  /** Get the receipt for a contract, containing its address, codeHash, etc. */
  get (name: string): Contract<any>|null {
    const receipt = this.state[name]
    if (!receipt) return null
    return new Contract({ ...receipt, deployment: this })
  }

  /** Chainable. Add entry to deployment, replacing existing receipt. */
  set (name: string, data: Partial<Client> & any): this {
    this.state[name] = { name, ...data }
    return this
  }

  /** Chainable. Add multiple entries to the deployment, replacing existing receipts. */
  setMany (receipts: Record<string, any>): this {
    for (const [name, receipt] of Object.entries(receipts)) {
      this.state[name] = receipt
    }
    return this
  }

  /** Chainable. Add entry to deployment, merging into existing receipts. */
  add (name: string, data: any): this {
    return this.set(name, { ...this.state[name] || {}, ...data, name })
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

/** Constructor type for builder. */
export type NewBuilder = New<Builder, IntoBuilder>

/** Builders can be specified as ids, class names, or objects. */
export type IntoBuilder = string|NewBuilder|Partial<Builder>

export type IntoSource = string|Contract<any>

/** Builder: turns `Source` into `Contract`, providing `artifact` and `codeHash` */
export abstract class Builder {

  /** Populated by @fadroma/build */
  static variants: Record<string, NewBuilder> = {}

  /** Get a Builder from a specifier and optional overrides. */
  static get (specifier: IntoBuilder = '', options: Partial<Builder> = {}): Builder {
    if (typeof specifier === 'string') {
      const B = Builder.variants[specifier]
      if (!B) throw new ClientError.NoBuilderNamed(specifier)
      return new (B as NewBuilder)(options)
    } else if (typeof specifier === 'function') {
      if (!options.id) throw new ClientError.NoBuilder()
      return new (specifier as NewBuilder)(options)
    } else {
      const B = Builder.variants[specifier?.id as string]
      return new (B as NewBuilder)({ ...specifier, ...options })
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

export type IntoUploader = string|NewUploader|Partial<Uploader>

export type NewUploader  = New<Uploader, IntoUploader>

/** Uploader: uploads a `Contract`'s `artifact` to a specific `Chain`,
  * binding the `Contract` to a particular `chainId` and `codeId`. */
export abstract class Uploader {

  /** Populated by @fadroma/deploy */
  static variants: Record<string, NewUploader> = {}

  /** Get a Builder from a specifier and optional overrides. */
  static get (specifier: IntoUploader = '', options: Partial<Uploader> = {}): Uploader {
    if (typeof specifier === 'string') {
      const U = Uploader.variants[specifier]
      if (!U) throw new ClientError.NoUploaderNamed(specifier)
      return new (U as NewUploader)(options)
    } else if (typeof specifier === 'function') {
      if (!options.id) throw new ClientError.NoUploader()
      return new (specifier as NewUploader)(options)
    } else {
      const U = Uploader.variants[specifier?.id as string]
      return new (U as NewUploader)({ ...specifier, ...options })
    }
  }

  /** Unique identifier of this uploader implementation. */
  abstract id: string

  constructor (public agent?: Agent|null) {}

  get chain () {
    return this.agent?.chain
  }

  async getHash (id: CodeId): Promise<CodeHash> {
    return await this.agent!.getHash(Number(id))
  }

  abstract upload (template: Contract<any>): Promise<Contract<any>>

  abstract uploadMany (templates: Contract<any>[]): Promise<Contract<any>[]>

}

/** A transaction hash, uniquely identifying an executed transaction on a chain. */
export type TxHash       = string

/** Pair of name and init message. Used when instantiating multiple contracts from one template. */
export type DeployArgs = [Name, Message]

/** A moment in time. */
export type Moment   = number

/** A period of time. */
export type Duration = number

/** Error kinds. */
export class ClientError extends CustomError {
  static DifferentHashes = this.define('DifferentHashes',
    () => 'Passed an object with codeHash and code_hash both different')
  static DeployManyFailed = this.define('DeployManyFailed',
    (e: any) => 'Deploy of multiple contracts failed. ' + e?.message??'')
  static InvalidLabel = this.define('InvalidLabel',
    (label: string) => `Can't set invalid label: ${label}`)
  static NoAgent = this.define('NoAgent', () => "Missing agent.")
  static NoBundleAgent = this.define('NoBundleAgent', () => "Missing agent for bundle.")
  static NoArtifact = this.define('NoArtifact', () => "No code id and no artifact to upload")
  static NoArtifactURL = this.define('NoArtifactUrl', () => "Still no artifact URL")
  static NoBuilder = this.define('NoBuilder', () => `No builder specified.`)
  static NoBuilderNamed = this.define('NoBuilderNamed', (id: string) =>
    `No builder with id "${id}". Make sure @fadroma/build is imported`)
  static NoUploaderNamed = this.define('NoUploaderNamed', (id: string) =>
    `No uploader with id "${id}". Make sure @fadroma/deploy is imported`)
  static NoChainId = this.define('NoChainId', () => "No chain ID specified")
  static NoCodeHash = this.define('NoCodeHash', () => "No code hash")
  static NoContext = this.define('NoUploadInitContext', () => "Missing deploy context.")
  static NoCrate = this.define('NoCrate', () => `No crate specified for building`)
  static NoCreator = this.define('NoCreator', (name?: string) =>
    `Creator agent not set for task: ${name}.`)
  static NoDeployment = this.define("NoDeployment", (name?: string) =>
    name ? `No deployment, can't find contract by name: ${name}`
         : "Missing deployment")
  static NoInitMessage = this.define('NoInitMessage', () => "Missing init message")
  static NoName = this.define("NoContractName", () => "No name.")
  static NoSource = this.define('NoSource', () => "No artifact and no source to build")
  static NoTemplate = this.define('NoTemplate', () =>
    "Tried to create Contract with nullish template")
  static NoUploader = this.define('NoUploader', () => "No uploader specified")
  static NoUploaderAgent  = this.define('NoUploaderAgent', () => "No uploader agent specified")
  static NotFound = this.define('NotFound',
    (kind: string, name: string, deployment: string, message: string = '') =>
      (`${kind} "${name}" not found in deployment "${deployment}". ${message}`))
  static ProvideBuilder = this.define('ProvideBuilder',
    (id: string) => `Provide a "${id}" builder`)
  static ProvideUploader = this.define('ProvideUploader',
    (id: string) => `Provide a "${id}" uploader`)
  static Unpopulated = this.define('Unpopulated',
    () => "template.codeId and template.codeHash must be defined to use template.asLink")
  static ExpectedAddress = this.define('ExpectedAddress', (name: string) =>
    `${name} has no address and can't operate.` +
    ` Pass an address with "new ${name}(agent, address)" ` +
    ` or "new ${name}({ address })"`)
  static ExpectedAgent = this.define('ExpectedAgent', (name: string) =>
    `${name} has no agent and can't operate. `+
    `Pass an address when calling "new ${name}(agent, addr)"`)
  static ValidationFailed = this.define('ValidationFailed',
    (kind: string, name: string, expected: any, actual: any) =>
      `Wrong ${kind}: ${name} was passed ${expected} but fetched ${actual}`)
  static NameOutsideDevnet = this.define('NameOutsideDevnet',
    () => 'Chain#getAgent: getting agent by name only supported for devnets')
  static BalanceNoAddress = this.define('BalanceNoAddress',
    () => 'Agent#getBalance: what address?')
  static NotInBundle = this.define('NotInBundle',
    (op: string) => `Operation disallowed inside bundle: ${op}`)
  static EmptyBundle = this.define('EmptyBundle',
    () => 'Trying to submit bundle with no messages')
  static LinkNoTarget = this.define('LinkNoTarget',
    () => "Can't create inter-contract link with no target")
  static LinkNoAddress = this.define('LinkNoAddress',
    () => "Can't link to contract with no address")
  static LinkNoCodeHash = this.define('LinkNoCodeHash',
    () => "Can't link to contract with no code hash")
  static InvalidMessage = this.define('InvalidMessage',
    () => 'Messages must have exactly 1 root key')
  static NoVersion = this.define('NoVersion', (name: string) => `${name}: specify version`)
}

/** Logging. */
export class ClientConsole extends CommandsConsole {
  beforeDeploy = (template: Contract<any>, label: Label) => this.info(
    'Deploy   ', bold(label),
    'from code id', bold(String(template.codeId ||'(unknown)')),
    'hash', bold(String(template.codeHash||'(unknown)'))
  )
  afterDeploy = (contract: Partial<Contract<any>>) => this.info(
    'Deployed ', bold(contract.name!), 'is', bold(contract.address!),
    'from code id', bold(contract.codeId!)
  )
  deployFailed = (e: Error, template: Contract<any>, name: Label, msg: Message) => {
    this.error()
    this.error(`  Deploy of ${bold(name)} failed:`)
    this.error(`    ${e.message}`)
    this.deployFailedContract(template)
    this.error()
    this.error(`  Init message: `)
    this.error(`    ${JSON.stringify(msg)}`)
    this.error()
  }
  deployManyFailed = (template: Contract<any>, contracts: DeployArgs[] = [], e: Error) => {
    this.error()
    this.error(`  Deploy of multiple contracts failed:`)
    this.error(`    ${e.message}`)
    this.deployFailedContract(template)
    this.error()
    this.error(`  Configs: `)
    for (const [name, init] of contracts) {
      this.error(`    ${bold(name)}: `, JSON.stringify(init))
    }
    this.error()
  }
  deployFailedContract = (template?: Contract<any>) => {
    this.error()
    if (!template) return this.error(`  No template was provided.`)
    this.error(`  Contract:   `)
    this.error(`    Chain ID: `, bold(template.chainId ||''))
    this.error(`    Code ID:  `, bold(template.codeId  ||''))
    this.error(`    Code hash:`, bold(template.codeHash||''))
  }
  chainStatus = ({ chain, deployments }: {
    chain?: Chain, deployments?: { active?: { name: string }, list (): string[] }
  }) => {
    if (!chain) return this.info('│ No active chain.')
    this.info('│ Chain type: ', bold(chain.constructor.name))
    this.info('│ Chain mode: ', bold(chain.mode))
    this.info('│ Chain ID:   ', bold(chain.id))
    this.info('│ Chain URL:  ', bold(chain.url.toString()))
    this.info('│ Deployments:', bold(String(deployments?.list().length)))
    if (!deployments?.active) return this.info('│ No active deployment.')
    this.info('│ Deployment: ', bold(String(deployments?.active?.name)))
  }
  warnUrlOverride = (a: any, b: any) =>
    this.warn(`node.url "${a}" overrides chain.url "${b}"`)
  warnIdOverride = (a: any, b: any) =>
    this.warn(`node.chainId "${a}" overrides chain.id "${b}"`)
  warnNodeNonDevnet = () =>
    this.warn(`"node" option is only applicable to devnets`)
  warnNoAgent = (name: string) =>
    this.warn(`${name}: no agent; actions will fail until agent is set`)
  warnNoAddress = (name: string) =>
    this.warn(`${name}: no address; actions will fail until address is set`)
  warnNoCodeHash = (name: string) =>
    this.warn(`${name}: no codeHash; actions may be slow until code hash is set`)
  warnNoCodeHashProvided = (address: string, realCodeHash: string) =>
    this.warn(`Code hash not provided for ${address}. Fetched: ${realCodeHash}`)
  warnCodeHashMismatch = (address: string, expected: string|undefined, fetched: string) =>
    this.warn(`Code hash mismatch for ${address}: expected ${expected}, fetched ${fetched}`)
  confirmCodeHash = (address: string, codeHash: string) =>
    this.info(`Confirmed code hash of ${address}: ${codeHash}`)
  waitingForNextBlock = () => this.info('Waiting for next block...')
}

/** The default Git ref when not specified. */
export const HEAD = 'HEAD'
