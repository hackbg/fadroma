import * as Konzola from '@hackbg/konzola'

type valof<T> = T[keyof T]

/** A ***value object*** that allows its meaningful properties to be overridden.
  * For the override to work, empty properties must be defined as:
  *
  *     class Named extends Overridable {
  *         name?: Type = undefined
  *     }
  *
  * (Otherwise Object.getOwnPropertyNames wouldn't see the property slots,
  * and `new Named.where({ name: 'something' })` wouldn't update `name`.
  * This is because of how TypeScript handles class properties;
  * in raw JS, they seem to be defined as undefined by default?)
  *
  * Even in when not inheriting from `Overridable`, try to follow the pattern of
  * ***immutable value objects*** which represent a piece of state in context
  * and which, instead of mutating themselves, emit changed copies of themselves
  * using the idioms:
  *     this.where({ name: 'value' }) // internally
  * or:
  *     new Named(oldNamed, { name: 'value' }) // externally.
  **/
export class Overridable {
  override (options: object = {}) {
    override(true, this, options)
  }
  /** Return copy of self with overridden properties. */
  where (options: Partial<Source> = {}) {
    return new (this.constructor as any)(this, options)
  }
}

/** Override only allowed properties. */
export function override (
  /** Whether to fail on unexpected properties. */
  strict:    boolean,
  /** The object being overridden. */
  self:      object,
  /** The object containing the overrides. */
  overrides: object,
  /** List of allowed properties (defaults to the defined properties on the object;
    * that's why many fields explicitly default to `undefined` - otherwise TypeScript
    * does not generate them, somewhat contrarily to native JS class behavior) */
  allowed:   string[] = Object.getOwnPropertyNames(self),
): Record<string, valof<typeof overrides>> {
  const filtered: Record<string, valof<typeof overrides>> = {}
  for (const [key, val] of Object.entries(overrides)) {
    if (allowed.includes(key)) {
      const current: typeof val = (self as any)[key]
      if (strict && current && current !== val) {
        throw new Error(`Tried to override pre-defined ${key}`)
      }
      (self as any)[key] = val
    } else {
      (filtered as any)[key] = val
    }
  }
  return filtered
}

/** Idiom for copy-on-write usage of Overridables. */
export interface New<T, U> {
  new (overrides?: Partial<T>): T
  new (specifier?: U, overrides?: Partial<T>): T
}

/** A code hash, uniquely identifying a particular smart contract implementation. */
export type CodeHash = string

/** Objects that have a code hash in either capitalization. */
interface Hashed { code_hash?: CodeHash, codeHash?: CodeHash }

/** Allow code hash to be passed with either cap convention; warn if missing or invalid. */
export function codeHashOf ({ code_hash, codeHash }: Hashed): CodeHash {
  if (typeof code_hash === 'string') code_hash = code_hash.toLowerCase()
  if (typeof codeHash  === 'string') codeHash  = codeHash.toLowerCase()
  if (code_hash && codeHash && code_hash !== codeHash) {
    throw new Error('Passed an object with codeHash and code_hash both different')
  }
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

/** Interface for executing read-only, unauthenticated API calls. */
export interface Spectator {

  /** The chain on which this object operates. */
  chain:        Chain

  /** Query a smart contract. */
  query <U>     (contract: Partial<Client>, msg: Message): Promise<U>

  /** Get the code id of a smart contract. */
  getCodeId     (address: Address):                        Promise<string>

  /** Get the label of a smart contract. */
  getLabel      (address: Address):                        Promise<string>

  /** Get the code hash of a smart contract. */
  getHash       (addressOrCodeId: Address|number):         Promise<string>

  /** Get the code hash of a smart contract. */
  checkHash     (address: Address, codeHash?: CodeHash):   Promise<string>

  /** Get the current block height. */
  get height    ():                                        Promise<number>

  /** Wait for the block height to increment. */
  get nextBlock ():                                        Promise<number>

}

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
export abstract class Chain implements Spectator {

  /** Async functions that return Chain instances in different modes.
    * Values for `FADROMA_CHAIN` environment variable. */
  static variants: ChainRegistry = {}

  static Mode = ChainMode

  constructor (
    readonly id: ChainId,
    options: Partial<ChainOpts> = {}
  ) {
    if (!id) {
      throw new Error('Chain: need to pass chain id')
    }
    this.id   = id
    this.mode = options.mode!
    if (options.url) {
      this.url = options.url
    }
    if (options.node) {
      if (options.mode === Chain.Mode.Devnet) {
        this.node = options.node
        if (this.url !== String(this.node.url)) {
          console.warn(`Fadroma Chain: node.url "${this.node.url}" overrides chain.url "${this.url}"`)
          this.url = String(this.node.url)
        }
        if (this.id !== this.node.chainId) {
          console.warn(`Fadroma Chain: node.id "${this.node.chainId}" overrides chain.id "${this.id}"`)
          this.id = this.node.chainId
        }
      } else {
        console.warn('Chain: "node" option passed to non-devnet. Ignoring')
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

  abstract query <U> (contract: Client, msg: Message): Promise<U>

  abstract getCodeId (address: Address): Promise<CodeId>

  abstract getLabel (address: Address): Promise<string>

  abstract getHash (address: Address|number): Promise<CodeHash>

  async checkHash (address: Address, codeHash?: CodeHash) {
    // Soft code hash checking for now
    const realCodeHash = await this.getHash(address)
    if (!codeHash) {
      console.warn(
        'Code hash not provided for address:', address,
        '  Code hash on chain:', realCodeHash
      )
    } if (codeHash !== realCodeHash) {
      console.warn(
        'Code hash mismatch for address:', address,
        '  Expected code hash:',           codeHash,
        '  Code hash on chain:',           realCodeHash
      )
    } else {
      console.info(`Code hash of ${address}:`, realCodeHash)
    }
    return realCodeHash
  }

  abstract get height (): Promise<number>

  get nextBlock (): Promise<number> {
    console.info('Waiting for next block...')
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
      if (this.node) {
        options = await this.node.getGenesisAccount(options.name)
      } else {
        throw new Error('Chain#getAgent: getting agent by name only supported for devnets')
      }
    }
    const agent = await _Agent.create(this, options) as A
    return agent
  }

  static Agent: AgentCtor<Agent>

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

/** Something that can execute mutating transactions. */
export interface Executor extends Spectator {
  /** The address from which transactions are signed and sent. */
  address?:        Address
  /** Default fee maximums for send, upload, init, and execute. */
  fees?:           AgentFees
  /** Send native tokens to 1 recipient. */
  send            (to: Address, amounts: ICoin[], opts?: ExecOpts):    Promise<void|unknown>
  /** Send native tokens to multiple recipients. */
  sendMany        (outputs: [Address, ICoin[]][], opts?: ExecOpts):    Promise<void|unknown>
  /** Upload code, generating a new code id/hash pair. */
  upload          (code: Uint8Array):                                  Promise<void|Template>
  /** Upload multiple pieces of code, generating multiple code id/hash pairs. */
  uploadMany      (code: Uint8Array[]):                                Promise<void|Template[]>
  /** Create a new smart contract from a code id, label and init message. */
  instantiate     (template: Template, label: string, msg: Message):   Promise<void|Client>
  /** Create multiple smart contracts from a list of code id/label/init message triples. */
  instantiateMany (configs: DeployArgsTriple[]):                       Promise<void|Client[]>
  /** Call a transaction method on a smart contract. */
  execute         (contract: Client, msg: Message, opts?: ExecOpts): Promise<void|unknown>
  /** Begin a transaction bundle. */
  bundle          (): Bundle
  /** Get a client instance for talking to a specific smart contract as this executor. */
  getClient <C extends Client> (
    Client:    NewClient<C>,
    specifier: Address|Partial<C>,
    codeHash?: CodeHash
  ): C
}

export type DeployArgsTriple = [Template, Name, Message]

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
export abstract class Agent implements Executor {

  static create (chain: Chain, options: AgentOpts = {}): Promise<Agent> {
    //@ts-ignore
    return new this(chain, options)
  }

  constructor (readonly chain: Chain, options: AgentOpts = {}) {
    this.chain = chain
    Object.defineProperty(this, 'chain', { enumerable: false })
    if (options.name) this.name = options.name
    if (options.fees) this.fees = options.fees
  }

  /** The address of this agent. */
  address?: Address

  /** The friendly name of the agent. */
  name?:    string

  /** Default transaction fees to use for interacting with the chain. */
  fees?:    AgentFees

  /** The default denomination in which the agent operates. */
  get defaultDenom () { return this.chain.defaultDenom }

  /** Get the balance of this or another address. */
  getBalance (denom = this.defaultDenom, address = this.address): Promise<string> {
    if (address) {
      return this.chain.getBalance(denom, address)
    } else {
      throw new Error('Agent#getBalance: what address?')
    }
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

  getClient <C extends Client> (
    $Client:   NewClient<C>,
    specifier: Address|Partial<C>,
    codeHash?: CodeHash
  ): C {
    if (typeof specifier === 'string') specifier = { address: specifier } as Partial<C>
    return new $Client({ ...specifier, agent: this, codeHash }) as C
  }

  query <R> (contract: Client, msg: Message): Promise<R> {
    return this.chain.query(contract, msg)
  }

  abstract send     (to: Address, amounts: ICoin[], opts?: ExecOpts): Promise<void|unknown>

  abstract sendMany (outputs: [Address, ICoin[]][], opts?: ExecOpts): Promise<void|unknown>

  abstract upload (blob: Uint8Array): Promise<Template>

  uploadMany (blobs: Uint8Array[] = []): Promise<Template[]> {
    return Promise.all(blobs.map(blob=>this.upload(blob)))
  }

  abstract instantiate <T> (template: Template, label: string, msg: T): Promise<Client>

  instantiateMany (configs: (DeployArgsTriple|Client)[] = []): Promise<Client[]> {
    return Promise.all(configs.map(client=>
      (client instanceof Array) ? this.instantiate(...client) : this.instantiate(client as Template, client.label, client.initMsg) ))
  }

  abstract execute (
    contract: Partial<Client>, msg: Message, opts?: ExecOpts
  ): Promise<void|unknown>

  static Bundle: BundleCtor<Bundle>

  Bundle: BundleCtor<Bundle> = (this.constructor as AgentCtor<typeof this>).Bundle

  bundle (): Bundle {
    //@ts-ignore
    return new this.Bundle(this)
  }

}

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
export abstract class Bundle implements Executor {

  constructor (readonly agent: Agent) {}

  depth  = 0

  Bundle = this.constructor

  bundle (): this {
    console.warn('Nest bundles with care. Depth:', ++this.depth)
    return this
  }

  get chain        () { return this.agent.chain            }

  get address      () { return this.agent.address          }

  get name         () { return `${this.agent.name}@BUNDLE` }

  get fees         () { return this.agent.fees             }

  get defaultDenom () { return this.agent.defaultDenom     }

  getCodeId (address: Address) { return this.agent.getCodeId(address) }

  getLabel  (address: Address) { return this.agent.getLabel(address)  }

  getHash   (address: Address|number) { return this.agent.getHash(address)   }

  checkHash (address: Address, codeHash?: CodeHash) {
    return this.agent.checkHash(address, codeHash)
  }

  get balance () {
    throw new Error("don't query inside bundle")
    return Promise.resolve('0')
  }

  async getBalance (denom: string) {
    throw new Error("can't get balance in bundle")
    return Promise.resolve(denom)
  }

  get height (): Promise<number> {
    throw new Error("don't query block height inside bundle")
  }

  get nextBlock (): Promise<number> {
    throw new Error("can't wait for next block inside bundle")
  }

  async send (to: Address, amounts: ICoin[], opts?: ExecOpts): Promise<void|unknown> {
    throw new Error("Bundle#send: not implemented")
  }

  async sendMany (outputs: [Address, ICoin[]][], opts?: ExecOpts): Promise<void|unknown> {
    throw new Error("Bundle#sendMany: not implemented")
  }

  async instantiate (
    template: Template, label: Label, msg: Message, funds = []
  ): Promise<Client> {
    const init = {
      sender:   this.address,
      codeId:   String(template.codeId),
      codeHash: template.codeHash,
      label,
      msg,
      funds
    }
    this.add({ init })
    const { codeId, codeHash } = template
    // @ts-ignore
    return { chainId: this.agent.chain.id, codeId, codeHash, address: null }
  }

  async instantiateMany (configs: [Template, Label, Message][]): Promise<Client[]> {
    return await Promise.all(configs.map(([template, label, initMsg])=>
      this.instantiate(template, label, initMsg)
    ))
  }

  async execute (
    contract: Partial<Client>,
    msg:      Message,
    { send }: ExecOpts = {}
  ): Promise<this> {
    this.add({
      exec: {
        sender:   this.address,
        contract: contract.address,
        codeHash: contract.codeHash,
        msg,
        funds: send
      }
    })
    return this
  }

  /** Queries are disallowed in the middle of a bundle because
    * even though the bundle API is structured as multiple function calls,
    * the bundle is ultimately submitted as a single transaction and
    * it doesn't make sense to query state in the middle of that. */
  async query <U> (contract: Client, msg: Message): Promise<U> {
    throw new Error("don't query inside bundle")
  }

  /** Uploads are disallowed in the middle of a bundle because
    * it's easy to go over the max request size, and
    * difficult to know what that is in advance. */
  //@ts-ignore
  async upload (code: Uint8Array) {
    throw new Error("don't upload inside bundle")
  }

  /** Uploads are disallowed in the middle of a bundle because
    * it's easy to go over the max request size, and
    * difficult to know what that is in advance. */
  //@ts-ignore
  async uploadMany (code: Uint8Array[]) {
    throw new Error("don't upload inside bundle")
  }

  getClient <C extends Client> (
    Client: NewClient<C>, specifier: Address|Partial<C>, codeHash?: CodeHash
  ): C {
    if (typeof specifier === 'string') specifier = { address: specifier } as Partial<C>
    return new Client({ ...specifier, agent: this, codeHash }) as C
  }

  id = 0

  msgs: any[] = []

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
      console.warn('Unnesting bundle. Depth:', --this.depth)
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
    if (this.msgs.length < 1) throw new Error('Trying to submit bundle with no messages')
    return true
  }

  /** Broadcast a bundle to the chain. */
  abstract submit (memo: string): Promise<unknown>

  /** Save a bundle for manual broadcast. */
  abstract save   (name: string): Promise<unknown>

}

export interface BundleCtor<B extends Bundle> {
  new (agent: Agent): B
}

/** Function passed to Bundle#wrap */
export type BundleCallback<B extends Bundle> = (bundle: B)=>Promise<void>

/// # Link base types

//@ts-ignore
Chain.Agent = Agent as AgentCtor<Agent>
//@ts-ignore
Agent.Bundle = Bundle

/** Allows sources to be specified as strings, URLs, or key-value maps. */
export type IntoSource = string|URL|Partial<Source>

/** Source: a smart contract that exists in source code form and can be compiled. */
export class Source extends Overridable implements Partial<Source> {

  constructor (specifier: IntoSource = {}, options: Partial<Source> = {}) {
    super()
    if (typeof specifier === 'string') {
      const [ crate, ref ] = specifier.split('@')
      options = { ...options, crate, ref }
    } else if (specifier instanceof URL) {
      options = { ...options, repo: specifier }
    } else if (typeof specifier === 'object') {
      options = { ...specifier, ...options }
    } else {
      throw new ClientError.InvalidSource(specifier)
    }
    this.override(options)
  }

  /** URL to local or remote Git repository containing the source code. */
  repo?:    string|URL     = undefined

  /** Commit hash of source commit. Points to last commit if building from HEAD. */
  commit?:  string         = undefined

  /** Git ref (branch or tag) pointing to source commit. */
  ref?:     string         = undefined

  /** Name of crate. Used to find contract crate in workspace repos. */
  crate?:   string         = undefined

  /** List of crate features to enable during build. */
  features?: string[]      = undefined

  /** Builder implementation that produces a Template from the Source. */
  builder?: string|Builder = undefined

  /** Compile the source using the selected builder. */
  build (builder?: typeof this.builder): Promise<Template> {
    return this.assertBuildable(builder).build(this)
  }

  /** Throw appropriate error if not buildable. */
  assertBuildable (builder: typeof this.builder = this.builder): Builder {
    if (!this.crate) throw new ClientError.NoCrate()
    if (!builder)    throw new ClientError.NoBuilder()
    if (typeof builder === 'string') throw new ClientError.ProvideBuilder(builder)
    return builder
  }

  /** Return a copy of self pinned to a certain Git reference.
    * Used to specify historical builds. */
  at (ref?: string): Source {
    return ref ? this : this.where({ ref })
  }

  /** Serialize for storage as JSON-formatted plaintext. */
  flatten (): Partial<Source> {
    return {
      repo:    this.repo?.toString(),
      commit:  this.commit,
      ref:     this.ref,
      crate:   this.crate,
      builder: (typeof this.builder === 'object') ? this.builder.id : this.builder
    }
  }

}

export type NewTemplate = New<Template, IntoTemplate>

export type IntoTemplate = IntoSource|Partial<Template>

/** Template: contract that is compiled but not deployed.
  * Can be uploaded, and, after uploading, instantiated. */
export class Template extends Source {

  constructor (
    specifier: IntoTemplate      = {},
    options:   Partial<Template> = {},
  ) {
    super()
    if (typeof specifier === 'string') {
      const [crate, ref] = specifier.split('@')
      options = { ...options, crate, ref }
    } else if (specifier instanceof URL) {
      options = { ...options, artifact: specifier }
    } else if (typeof specifier === 'object') {
      options = { ...specifier, ...options }
    } else {
      throw new ClientError.InvalidTemplate(specifier)
    }
    this.override(options)
  }

  /** Agent to use for uploading and instantiating a contract. */
  agent: Agent|null = null

  /** Optional hook into @hackbg/komandi lazy one-shot task hook system. */
  task?: Task

  /** Wrap the method in a lazy subtask if this.task is set. */
  protected asTask <T> (name: string, callback: (this: typeof this)=>Promise<T>): Promise<T> {
    if (this.task) {
      Object.defineProperty(callback, 'name', { value: name })
      return this.task.subtask(callback)
    } else {
      return callback.call(this)
    }
  }

  /** Object containing upload logic. */
  uploader?:  Uploader   = undefined

  /** Return the Uploader for this Template or throw. */
  assertUploader (uploader: typeof this.uploader = this.uploader): Uploader {
    if (!uploader)       throw new ClientError.NoUploader()
    if (!uploader.agent) throw new ClientError.NoUploaderAgent()
    return uploader
  }

  /** URL to the compiled code. */
  artifact?: string|URL = undefined

  /** Code hash uniquely identifying the compiled code. */
  codeHash?: CodeHash   = undefined

  /** Upload source code to a chain. */
  async upload (uploader?: typeof this.uploader): Promise<Template> {
    return this.asTask(`upload contract template`, upload)
    async function upload (this: Template): Promise<Template> {
      uploader = this.assertUploader() // Don't start if there is no uploader
      let self: Template = this        // Start with self
      if (!self.artifact) self = await self.build() // Replace with built
      return uploader.upload(self)     // Return uploaded
    }
  }

  /** Throw if trying to do something with no agent or address. */
  protected connected (): Agent {
    const { name } = this.constructor
    if (!this.agent) throw new Error(
      `${name} has no address and can't operate. `+
      `Pass an address when calling "new ${name}(agent, addr)"`
    )
    return this.agent
  }

  /** ID of chain to which this template is uploaded. */
  chainId?:  ChainId = undefined

  /** Hash of transaction that performed the upload. */
  uploadTx?: TxHash  = undefined

  /** Code ID representing the identity of the contract's code on a specific chain. */
  codeId?:   CodeId  = undefined

  /** Depending on what pre-Template type we start from, this function
    * invokes builder and uploader to produce a Template from it. */
  async getOrUpload (): Promise<Template> {
    return this.asTask(`get or upload contract template`, getOrUpload)
    async function getOrUpload (this: Template): Promise<Template> {
      // We're gonna do this immutably, generating new instances of Template when changes are needed.
      let self: Template = this
      // If chain ID, code ID and code hash are present, this template is ready to uploade
      if (self.chainId && self.codeId && self.codeHash) return self
      // Otherwise we're gonna need an uploader
      const uploader = self.assertUploader()
      // And if we still can't determine the chain ID, bail
      const chainId = self.chainId ?? uploader.chain.id
      if (!chainId) throw new ClientError.NoChainId()
      // If we have chain ID and code ID, try to get code hash
      if (self.codeId) {
        self = new Template(self, { codeHash: await uploader.getHash(self.codeId) })
        if (!self.codeHash) throw new ClientError.NoCodeHash()
        return self
      }
      return await this.upload()
    }
  }

  log = new ClientConsole('Fadroma.Template')

  /** Intended client class */
  Client: NewClient<any> = Client as unknown as NewClient<any>

  /** Default agent that will perform inits. */
  creator?: Agent = this.uploader?.agent

  /** Deploy a contract from this template. */
  async deploy <C extends Client> (
    /** Must be unique. @fadroma/deploy adds prefix here. */
    label:    Label,
    /** Init message, or a function to produce it. */
    initMsg?: Message|(()=>Message|Promise<Message>),
    /** Agent to do the deploy. */
    agent?:   Agent
  ): Promise<C> {
    let self = this
    if (!self.task) return deploy.call(self)
    Object.defineProperty(deploy, 'name', { value: `upload contract ${label}` })
    return self.task.subtask(deploy.bind(self))
    async function deploy (this: Template): Promise<C> {
      agent ??= this.creator
      if (!agent) throw new ClientError.NoCreator()
      const template = await this.getOrUpload()
      this.log.beforeDeploy(this, label)
      if (initMsg instanceof Function) initMsg = await Promise.resolve(initMsg())
      const instance = await agent.instantiate(template, label, initMsg)
      const client = new this.Client({ ...instance, agent })
      this.log.afterDeploy(client)
      return client as C
    }
  }

  /** Deploy multiple contracts from the same template with 1 tx */
  async deployMany (contracts: DeployArgs[] = [], agent?: Agent): Promise<Client[]> {
    agent ??= this.creator
    if (!agent) throw new ClientError.NoCreator()
    let instances
    try {
      const prefix = 'TODO'
      const configs: DeployArgsTriple[] = contracts.map(([name, initMsg]: DeployArgs)=>[
        this, new Client({ prefix, name }).label, initMsg
      ])
      instances = Object.values(await agent.instantiateMany(configs))
    } catch (e) {
      this.log.deployManyFailed(this, contracts, e as Error)
      throw e
    }
    // Return API client to each contract
    return instances.map(instance=>agent!.getClient(this.Client, instance))
  }

  /** Uploaded templates can be passed to factory contracts in this format: */
  get asInfo (): TemplateInfo {
    if (!this.codeId || isNaN(Number(this.codeId)) || !this.codeHash) {
      throw new ClientError.Unpopulated()
    }
    return templateStruct(this)
  }

  /** Throw if fetched metadata differs from configured. */
  protected validate (kind: string, expected: any, actual: any) {
    const name = this.constructor.name
    if (expected !== actual) {
      throw new Error(`Wrong ${kind}: ${name} was passed ${expected} but fetched ${actual}`)
    }
  }

}

export interface TemplateInfo {
  id:        number,
  code_hash: string
}

/** `{ id, codeHash }` -> `{ id, code_hash }`; nothing else */
export const templateStruct = (template: Template): TemplateInfo => ({
  id:        Number(template.codeId),
  code_hash: codeHashOf(template)
})

export type IntoClient = Name|Partial<Client>|undefined

export interface NewClient<C extends Client> {
  new (): C
  new (agent: Agent|null, address: Address): C
  new (agent: Agent|null, address: Address, codeHash: CodeHash|undefined): C
  new (specifier: IntoClient, overrides: Partial<C>): C
  new (overrides: Partial<C>): C
}

/** Client: interface to the API of a particular contract instance.
  * Has an `address` on a specific `chain`, usually also an `agent`.
  * Subclass this to add the contract's methods. */
export class Client extends Template {

  static RE_LABEL = /((?<prefix>.+)\/)?(?<name>[^+]+)(\+(?<suffix>.+))?/

  constructor (...args: [(IntoClient|Agent|null)?, (Partial<Client>|Address)?, CodeHash?]) {

    super()

    const isStr = (x: any): x is string => typeof x === 'string'
    const isObj = (x: any): x is object => typeof x === 'object'

    switch (true) {

      // new Client(agent, address, codeHash)
      case (args.length >= 3): {
        const [agent, address, codeHash] = args as [Agent, Address, CodeHash]
        this.agent    = agent
        this.address  = address
        this.codeHash = codeHash
        break
      }

      // new Client(agent, (address|options)?)
      case (args.length === 2 && isStr(args[0])): {
        this.agent = args[0] as Agent
        if (isStr(args[1])) {
          this.address = args[1]
        } else if (isObj(args[1])) {
          this.override(args[1]!)
        }
        break
      }

      // new Client(specifier, options?)
      case (args.length === 2 && isStr(args[0])): {
        this.override({
          ...(args[1] && isObj(args[1]) && (args[1] as unknown as object)),
          name: args[0]
        })
      }

      // new Client(specifier)
      case (args.length === 1 && isStr(args[0])): {
        this.override({ name: args[0] })
      }

      // new Client(options)
      case (args.length === 1 && isObj(args[0])): {
        this.override(args[0] as unknown as object)
      }

    }

  }

  /** The Chain on which this contract exists. */
  get chain () { return this.agent?.chain }

  /** Address of the contract on the chain.
    * TODO fetchAddress from label */
  address?: Address = undefined

  /** Fetch code hash from address. */
  async fetchCodeHash (expected?: CodeHash): Promise<this> {
    const codeHash = await this.connected().getHash(this.codeId!)
    if (!!expected) this.validate('codeHash', expected, codeHash)
    this.codeHash = codeHash
    return this
  }

  async fetchCodeId (expected?: CodeHash): Promise<this> {
    const codeId = await this.connected().getCodeId(this.codeHash!)
    if (!!expected) this.validate('codeId', expected, codeId)
    this.codeId = codeId
    return this
  }

  /** The contract represented in Fadroma ICC format (`{address, code_hash}`) */
  get asLink (): ContractLink {
    if (!this.address)  throw new Error("Can't link to contract with no address")
    if (!this.codeHash) throw new Error("Can't link to contract with no code hash")
    return { address: this.address, code_hash: this.codeHash }
  }

  /** Create a copy of this Client that will execute the transactions as a different Agent. */
  as (agent: Executor): this {
    const Self = this.constructor as NewClient<typeof this>
    return new Self({ ...this, agent })
  }

  protected connected (): Agent {
    const { name } = this.constructor
    if (!this.address) throw new Error(
      `${name} (for ${this.label} has no Address and can't operate.` +
      ` Pass an address with "new ${name}(agent, ...)"`
    )
    return super.connected()
  }

  /** The message used to instantiate the contract. */
  initMsg?:    Message    = undefined

  /** TXID of transaction where this contract was created. */
  initTx?:     TxHash     = undefined

  /** Deployment that this contract is a part of. */
  deployment?: Deployment = undefined

  /** Friendly name of the contract. Used for looking it up in the deployment. */
  name?:       Name       = undefined

  /** Deployment prefix of the contract. If present, label becomes `prefix/name` */
  prefix?:     Name       = undefined

  /** Deduplication suffix. */
  suffix?:     Name       = undefined

  /** Label of the contract on the chain. */
  get label (): Label {
    if (!this.name) throw new ClientError.NoName()
    let label = this.name
    if (this.prefix) label = `${this.prefix}/${label}`
    if (this.suffix) label = `${label}+${this.suffix}`
    return label
  }

  /** Setting the label breaks it down into prefix, name, and suffix. */
  set label (label: Label) {
    const matches = label.match(Client.RE_LABEL)
    if (!matches || !matches.groups) throw new ClientError.InvalidLabel(label)
    const {prefix, name, suffix} = matches.groups
    if (!name) throw new ClientError.InvalidLabel(label)
    this.prefix = prefix
    this.name   = name
    this.suffix = suffix
  }

  /** Fetch the label by the address. */
  async fetchLabel (expected?: CodeHash): Promise<this> {
    this.connected()
    const label = await this.agent!.getLabel(this.address!)
    if (!!expected) this.validate('label', expected, label)
    this.label = label
    return this
  }

  /** Execute a query on the specified contract as the specified Agent. */
  async query <U> (msg: Message): Promise<U> {
    return await this.connected().query(this, msg)
  }

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
      if (keys.length !== 1) {
        throw new Error('Client#getFee: messages must have exactly 1 root key')
      }
      return fees[keys[0]] || defaultFee
    }
    return this.fee || defaultFee
  }

  /** Create a copy of this Client with all transaction fees set to the provided value.
    * If the fee is undefined, returns a copy of the client with unmodified fee config. */
  withFee (fee: IFee|undefined): this {
    const Self = this.constructor as NewClient<this>
    if (fee) {
      return new Self({...this, fee, fees: {}})
    } else {
      return new Self({...this, fee: this.fee, fees: this.fees})
    }
  }

  /** Execute a transaction on the specified contract as the specified Agent. */
  async execute (msg: Message, opt: ExecOpts = {}): Promise<void|unknown> {
    this.connected()
    opt.fee = opt.fee || this.getFee(msg)
    return await this.agent!.execute(this, msg, opt)
  }

  /** Fetch the label, code ID, and code hash from the Chain.
    * You can override this method to populate custom contract info from the chain on your client,
    * e.g. fetch the symbol and decimals of a token contract. */
  async populate (): Promise<this> {
    this.connected()
    await Promise.all([this.fetchLabel(), this.fetchCodeId(), this.fetchCodeHash()])
    return this
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////

  get <C extends Client> (message: string = `Contract not found: ${this.name}`): C {
    if (this.address) {
      return new this.Client(this.agent, this.address, this.codeHash) as C
    }
    if (this.deployment && this.name && this.deployment.has(this.name)) {
      return new this.Client({ ...this.deployment.get(this.name)!, agent: this.agent }) as C
    }
    throw new Error(message)
  }

  async getOr (getter: ()=>this|Promise<this>): Promise<this> {
    return this.asTask(
      `get or provide ${this.name??'contract'}`,
      async function getContractOr () {
        return await Promise.resolve(getter())
      }
    )
  }

  async getOrDeploy <C extends Client> (initMsg?: IntoMessage):
    Promise<C>
  async getOrDeploy <C extends Client> (template?: IntoTemplate, initMsg?: IntoMessage):
    Promise<C>
  async getOrDeploy <C extends Client> (...args: [(IntoTemplate|IntoMessage)?, IntoMessage?]):
    Promise<C>
  {

    let template: Template
    let initMsg:  IntoMessage|undefined
    if (args.length === 2) {
      template = new Template(this)
      initMsg  = args[1]
    } else {
      template = this
      initMsg  = args[0] as IntoMessage
    }
    if (!template) throw new ClientError.NoTemplate()
    if (!initMsg)  throw new ClientError.NoInitMessage()

    return this.asTask(
      `get or deploy ${this.name??'contract'}`,
      async function getOrDeployContract (this: Client): Promise<C> {
        switch (true) {
          case !!this.address:
            console.info('Found    ', bold(this.name||'(unnamed)'), 'at', bold(this.address!))
            return new this.Client({ ...this, agent: this.creator }) as C
          case !!this.name:
            if (!this.creator)    throw new ClientError.NoCreator()
            if (!this.deployment) throw new ClientError.NoDeployment()
            return new this.Client(await template.deploy(this.label, initMsg)) as C
          default:
            throw new ClientError.InvalidValue()
        }
      }
    )

  }


}

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
  if (!instance)         throw new Error("Can't create an inter-contract link without a target")
  if (!instance.address) throw new Error("Can't create an inter-contract link without an address")
  return instance.address
}

/** Group of contracts sharing the same prefix.
  * - Extend this class in client library to define how the contracts are found.
  * - Extend this class in deployer script to define how the contracts are deployed. */
export class Deployment {

  constructor (
    /** Unique ID of deployment, used as label prefix for deployed contracts. */
    public prefix: string = Konzola.timestamp(),
    /** Default agent to use when interacting with this deployment. */
    public readonly agent?: Agent,
    /** Mapping of names to contract instances. */
    public readonly state:  Record<string, Client> = {},
  ) {}

  log = new ClientConsole('Fadroma.Deployment')

  /** Number of contracts in deployment. */
  get count () {
    return Object.keys(this.state).length
  }

  /** Check if the deployment contains a certain entry. */
  has (name: string): boolean {
    return !!this.state[name]
  }

  expect (name: string, message?: string): Partial<Client> {
    message ??= `${name}: no such contract in deployment`
    const receipt = this.get(name)
    if (receipt) return receipt
    throw new Error(message)
  }

  /** Get the receipt for a contract, containing its address, codeHash, etc. */
  get (name: string): Partial<Client>|null {
    const receipt = this.state[name]
    if (!receipt) return null
    receipt.name = name
    return receipt
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
    return this.set(name, { ...this.state[name] || {}, ...data })
  }

  /** Get a handle to the contract with the specified name. */
  getClient <C extends Client> (
    name:    string,
    $Client: NewClient<C> = Client as unknown as NewClient<C>,
    agent:   Agent        = this.agent!,
  ): C {
    const info = this.get(name)
    if (!info) throw new ClientError.NotFound()
    return new $Client({ ...(info! as Partial<C>), agent }) as C
  }

  /** Instantiate one contract and save its receipt to the deployment. */
  async init (agent: Agent, template: Template, name: Label, msg: Message): Promise<Client> {
    const label = new Client({ prefix: this.prefix, name }).label
    try {
      const contract = new Client(template).as(agent).deploy(label, msg)
      this.set(name, contract)
      return contract
    } catch (e) {
      this.log.deployFailed(e as Error, template, name, msg)
      throw e
    }
  }

  /** Instantiate multiple contracts from the same Template with different parameters. */
  async initMany (
    agent: Agent, template: Template, contracts: DeployArgs[] = []
  ): Promise<Client[]> {
    // this adds just the template - prefix is added in initVarious
    try {
      return this.initVarious(agent, contracts.map(([name, msg])=>[template, name, msg]))
    } catch (e) {
      this.log.deployManyFailed(template, contracts, e as Error)
      throw e
    }
  }

  /** Instantiate multiple contracts from different Templates with different parameters,
    * and store their receipts in the deployment. */
  async initVarious (
    agent: Agent, contracts: DeployArgsTriple[] = []
  ): Promise<Client[]> {
    contracts =
      contracts.map(c=>[new Template(c[0]), ...c.slice(1)] as DeployArgsTriple)
    const instances =
      await agent.instantiateMany(contracts)
    for (const instance of Object.values(instances)) {
      const name = (instance.label as string).slice(this.prefix.length+1)
      this.set(name, instance)
    }
    return instances
  }

}

export class Sources extends Overridable {

  constructor (specifiers: IntoSource[], options: Partial<Source> = {}) {
    super()
    this.override({ ...options, sources: specifiers.map(this.intoSource) })
  }

  builder?: Builder  = undefined

  sources:  Source[] = []

  protected intoSource = (specifier: IntoSource) => new Source(specifier)

  at = (ref: string) => new Sources(this.sources.map(source=>source.at(ref)))

  async build (builder?: Builder): Promise<Template[]> {
    builder ??= this.builder
    if (!builder) throw new ClientError.NoBuilder()
    return await builder.buildMany(this.sources)
  }

}

export class Templates extends Sources {

  constructor (args: IntoTemplate[], options: Partial<Template> = {}) { super(args, options) }

  agent?:     Agent        = undefined

  /** Multiple different templates that can be uploaded in one invocation.
    * Not uploaded in parallel by default. */
  async getOrUploadMany (slots: IntoTemplate[]): Promise<Template[]> {
    const templates: Template[] = []
    for (const template of slots) {
      templates.push(await new Template(template).getOrUpload())
    }
    return templates
  }

}
/** Instantiates multiple contracts of the same type in one transaction.
  * To instantiatie different types of contracts in 1 tx, see deployment.initVarious */
export class Contracts<C extends Client> extends Templates {

  constructor (
    /** Client class to use. */
    readonly Client: NewClient<C> = Client
  ) {
    super([], {})
  }

  log = new ClientConsole('Fadroma.Templates')

  /** Deploy multiple contracts from the same template with 1 tx */
  async deployMany (
    template:   IntoTemplate,
    specifiers: DeployArgs[],
    agent:      Agent|undefined = this.agent
  ): Promise<C[]> {
    if (!agent) throw new ClientError.NoCreator()
    template = new Template(template, { agent })
    try {
      template = await (template as Template).getOrUpload()
      const toGenericClient = ([name, initMsg]: DeployArgs): Client =>
        new Client(agent, { ...template as Template, name, initMsg})
      const toSpecificClient = (c: Client): C =>
        agent.getClient(this.Client, c as unknown as Partial<C>)
      return Object.values(await agent.instantiateMany(specifiers.map(toGenericClient)))
        .map(toSpecificClient)
    } catch (e) {
      this.log.deployManyFailed(template as Template, specifiers, e as Error)
      throw e
    }

  }

}

/** Constructor type for builder. */
export type NewBuilder = New<Builder, IntoBuilder>

/** Builders can be specified as ids, class names, or objects. */
export type IntoBuilder = string|NewBuilder|Partial<Builder>

/** Builder: turns `Source` into `Template`, providing `artifact` and `codeHash` */
export abstract class Builder extends Overridable {

  /** Populated by @fadroma/build */
  static variants: Record<string, Builder> = {}

  /** Get a Builder from a specifier and optional overrides. */
  static get (specifier: IntoBuilder = '', options: Partial<Builder> = {}) {
    if (typeof specifier === 'string') {
      const B = Builder.variants[specifier]
      if (!B) {
        throw new Error(`No "${specifier}" builder installed. Make sure @fadroma/build is imported`)
      }
      return new (B as any)(options)
    } else if (typeof specifier === 'function') {
      if (!options.id) {
        throw new Error(`No builder specified.`)
      }
      return new (specifier as NewBuilder)(options)
    } else {
      const B = Builder.variants[specifier?.id as string]
      return new (B as any)({ ...specifier, ...options })
    }
  }

  /** For serialization/deserialization. */
  abstract id: string

  /** Up to the implementation.
    * `@fadroma/build` implements dockerized and non-dockerized
    * variants on top of the `build.impl.mjs` script. */
  abstract build (source: IntoSource, ...args: any[]): Promise<Template>

  /** Default implementation of buildMany is parallel.
    * Builder implementations override this, though. */
  buildMany (sources: IntoSource[], ...args: unknown[]): Promise<Template[]> {
    return Promise.all(sources.map(source=>this.build(source, ...args)))
  }

}

export interface UploadInitContext {
  creator?:    Agent
  deployment?: Deployment
  task?:       Task
}

interface Task {
  subtask <C> (cb: ()=>(C|Promise<C>)): Promise<C>
}

export type IntoUploader = string|NewUploader|Partial<Uploader>

export type NewUploader  = New<Uploader, IntoUploader>

/** Uploader: uploads a `Template`'s `artifact` to a specific `Chain`,
  * binding the `Template` to a particular `chainId` and `codeId`. */
export abstract class Uploader {

  /** Populated by @fadroma/deploy */
  static variants: Record<string, Uploader> = {}

  constructor (public agent: Agent) {}

  get chain () {
    return this.agent.chain
  }

  async getHash (id: CodeId): Promise<CodeHash> {
    return await this.agent.getHash(Number(id))
  }

  abstract upload     (template: Template):   Promise<Template>

  abstract uploadMany (template: SparseArray<Template>): Promise<SparseArray<Template>>

}

/** A sparse array. Implementation detail of FSUploader in @fadroma/deploy. */
export type SparseArray<T> = (T | undefined)[]

/** A transaction hash, uniquely identifying an executed transaction on a chain. */
export type TxHash       = string

/** Pair of name and init message. Used when instantiating multiple contracts from one template. */
export type DeployArgs = [Name, Message]

/** A moment in time. */
export type Moment   = number

/** A period of time. */
export type Duration = number


/// # Error types

export class CustomError extends Error {
  static define (name: string, message: (...args: any)=>string): typeof this {
    const CustomError = class extends this {
      constructor (...args: any) {
        super(message(args))
      }
    }
    Object.defineProperty(CustomError, 'name', { value: `${name}Error` })
    return CustomError
  }
}

export class ClientError extends CustomError {

  static DeployManyFailed = this.define('DeployManyFailed',
    (e: any) => 'Deploy of multiple contracts failed. ' + e?.message??'')

  static InvalidLabel     = this.define('InvalidLabel',
    (label: string) => `Can't set invalid label: ${label}`)

  static InvalidSource    = this.define('InvalidSource',
    (specifier: any) => `Can't create source from: ${specifier}`)

  static InvalidTemplate  = this.define('InvalidTemplate',
    (specifier: any) => `Can't create source from: ${specifier}`)

  static InvalidSpecifier = this.define('InvalidSpecifier',
    (specifier: unknown) => `Can't create from: ${specifier}`)

  static InvalidValue     = this.define("InvalidContractValue",
    () => "Value is not Client and not a name.")

  static NoAgent          = this.define('NoUploadInitContext',
    () => "Missing execution agent.")

  static NoArtifact       = this.define('NoArtifact',
    () => "No code id and no artifact to upload")

  static NoArtifactURL    = this.define('NoArtifactUrl',
    () => "Still no artifact URL")

  static NoBuilder        = this.define('NoBuilder',
    () => `No builder selected.`)

  static NoChainId        = this.define('NoChainId',
    () => "No chain ID specified")

  static NoCodeHash       = this.define('NoCodeHash',
    () => "No code hash")

  static NoContext        = this.define('NoUploadInitContext',
    () => "Missing deploy context.")

  static NoCrate          = this.define('NoCrate',
    () => `No crate specified for building`)

  static NoCreator        = this.define('NoContractCreator',
    () => "Missing creator.")

  static NoDeployment     = this.define("NoDeployment",
    (name?: string) => name
      ? `No deployment, can't find contract by name: ${name}`
      : "Missing deployment")

  static NoInitMessage    = this.define('NoInitMessage',
    () => "Missing init message")

  static NoName           = this.define("NoContractName",
    () => "No name.")

  static NoSource         = this.define('NoSource',
    () => "No artifact and no source to build")

  static NoTemplate       = this.define('NoTemplate',
    () => "Tried to create Contract with nullish template")

  static NoUploader       = this.define('NoUploader',
    () => "No uploader specified")

  static NoUploaderAgent  = this.define('NoUploaderAgent',
    () => "No uploader agent specified")

  static NotFound         = this.define('NotFound',
    (prefix: string, name: string) => `Contract ${name} not found in deployment ${prefix}`)

  static NotFound2        = this.define('NotFound2',
    () => "Contract not found. Try .getOrDeploy(template, init)")

  static ProvideBuilder   = this.define('ProvideBuilder',
    (id: string) => `Provide a "${id}" builder`)

  static ProvideUploader  = this.define('ProvideUploader',
    (id: string) => `Provide a "${id}" uploader`)

  static Unpopulated      = this.define('Unpopulated',
    () => "template.codeId and template.codeHash must be defined to use template.asLink")

}
/// # Logging

const bold = Konzola.bold

export class ClientConsole extends Konzola.CustomConsole {
  constructor (readonly name: string) {
    super()
  }
  beforeDeploy (template: Template, label: Label) {
    console.info(
      'Deploy   ', bold(label),
      'from code id', bold(String(template.codeId  ||'(unknown)')),
      'hash', bold(String(template.codeHash||'(unknown)'))
    )
  }
  afterDeploy (contract: Partial<Client>) {
    console.info(
      'Deployed ', bold(contract.name!), 'is', bold(contract.address!),
      'from code id', bold(contract.codeId!)
    )
  }
  deployFailed (e: Error, template: Template, name: Label, msg: Message) {
    this.error()
    this.error(`  Deploy of ${bold(name)} failed:`)
    this.error(`    ${e.message}`)
    this.deployFailedTemplate(template)
    this.error()
    this.error(`  Init message: `)
    this.error(`    ${JSON.stringify(msg)}`)
    this.error()
  }
  deployManyFailed (template: Template, contracts: DeployArgs[] = [], e: Error) {
    this.error()
    this.error(`  Deploy of multiple contracts failed:`)
    this.error(`    ${e.message}`)
    if (template) {
      this.error(`  Template:   `)
      this.error(`    Chain ID: `, bold(template.chainId ||''))
      this.error(`    Code ID:  `, bold(template.codeId  ||''))
      this.error(`    Code hash:`, bold(template.codeHash||''))
    } else {
      this.error(`  No template was providede.`)
    }
    this.error()
    this.error(`  Configs: `)
    for (const [name, init] of contracts) {
      this.error(`    ${bold(name)}: `, JSON.stringify(init))
    }
    this.error()
  }
  deployFailedTemplate (template?: Template) {
    this.error()
    if (template) {
      this.error(`  Template:   `)
      this.error(`    Chain ID: `, bold(template.chainId ||''))
      this.error(`    Code ID:  `, bold(template.codeId  ||''))
      this.error(`    Code hash:`, bold(template.codeHash||''))
    } else {
      this.error(`  No template was providede.`)
    }
  }
}
