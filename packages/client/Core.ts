/** Core types. */
export type Address    = string
export type ChainId    = string
export type CodeHash   = string
export type CodeId     = string
export type Decimal    = string
export type Decimal256 = string
export type Duration   = number
export type Label      = string
export type Name       = string
export type Message    = string|Record<string, unknown>
export type Moment     = number
export type TxHash     = string
export type Uint128    = string
export type Uint256    = string
/** Reference to an instantiated smart contract.
  * May contain reference to the template from wich it was instantiated. */
export interface Instance {
  address:   Address
  codeHash?: CodeHash
  codeId?:   CodeId
  chainId?:  ChainId
  initTx?:   TxHash
  label?:    Label
  template?: Template
}
/** Something that can execute read-only API calls. */
export interface Spectator {
  /** The chain on which this object operates. */
  chain:        Chain
  /** Query a smart contract. */
  query <U>     (contract: Instance, msg: Message):      Promise<U>
  /** Get the code id of a smart contract. */
  getCodeId     (address: Address):                      Promise<string>
  /** Get the label of a smart contract. */
  getLabel      (address: Address):                      Promise<string>
  /** Get the code hash of a smart contract. */
  getHash       (addressOrCodeId: Address|number):       Promise<string>
  /** Get the code hash of a smart contract. */
  checkHash     (address: Address, codeHash?: CodeHash): Promise<string>
  /** Get the current block height. */
  get height    ():                                      Promise<number>
  /** Wait for the block height to increment. */
  get nextBlock ():                                      Promise<number>
}
/** Something that can execute mutating transactions. */
export interface Executor extends Spectator {
  /** The address from which transactions are signed and sent. */
  address:         Address
  /** Default fee maximums for send, upload, init, and execute. */
  fees?:           AgentFees
  /** Send native tokens to 1 recipient. */
  send            (to: Address, amounts: ICoin[], opts?: ExecOpts):   Promise<void|unknown>
  /** Send native tokens to multiple recipients. */
  sendMany        (outputs: [Address, ICoin[]][], opts?: ExecOpts):   Promise<void|unknown>
  /** Upload code, generating a new code id/hash pair. */
  upload          (code: Uint8Array):                                 Promise<void|Template>
  /** Upload multiple pieces of code, generating multiple code id/hash pairs. */
  uploadMany      (code: Uint8Array[]):                               Promise<void|Template[]>
  /** Create a new smart contract from a code id, label and init message. */
  instantiate     (template: Template, label: string, msg: Message):  Promise<void|Instance>
  /** Create multiple smart contracts from a list of code id/label/init message triples. */
  instantiateMany (configs: [Template, string, Message][]):           Promise<void|Instance[]>
  /** Call a transaction method on a smart contract. */
  execute         (contract: Instance, msg: Message, opts?: ExecOpts): Promise<void|unknown>
  /** Begin a transaction bundle. */
  bundle          (): Bundle
  /** Get a client instance for talking to a specific smart contract as this executor. */
  getClient <C extends Client, O extends Instance> (Client: ClientCtor<C, O>, arg: Address|O): C
}
/** Options for a compute transaction. */
export interface ExecOpts {
  /** The maximum fee. */
  fee?:  IFee
  /** A list of native tokens to send alongside the transaction. */
  send?: ICoin[]
  /** A transaction memo. */
  memo?: string
}
/** Represents some amount of native token. */
export interface ICoin {
  amount: Uint128,
  denom:  string
}
/** Represents some amount of native token. */
export class Coin implements ICoin {
  constructor (
    amount:         number|string,
    readonly denom: string
  ) {
    this.amount = String(amount)
  }
  readonly amount: string
}
/** A gas fee, payable in native tokens. */
export interface IFee {
  amount: readonly ICoin[]
  gas:    Uint128
}
/** A constructable gas fee in native tokens. */
export class Fee implements IFee {
  constructor (
    amount:       Uint128|number,
    denom:        string,
    readonly gas: string = String(amount)
  ) {
    this.amount = [{ amount: String(amount), denom }]
  }
  readonly amount: readonly ICoin[]
}
export enum ChainMode {
  Mainnet = 'Mainnet',
  Testnet = 'Testnet',
  Devnet  = 'Devnet',
  Mocknet = 'Mocknet'
}
export abstract class Chain implements Spectator {
  isSecretNetwork = false
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
  /** Return self. */
  get chain     () { return this }
  /** If this is a devnet, this contains an interface to the devnet container. */
  readonly node?: DevnetHandle
  /** The default denomination of the chain's native token. */
  abstract defaultDenom: string
  /** Get the balance of this or another address. */
  abstract getBalance (denom: string, address: Address): Promise<string>
  abstract query <U> (contract: Instance, msg: Message): Promise<U>
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
  url:     URL
  respawn:           ()             => Promise<unknown>
  terminate:         ()             => Promise<void>
  getGenesisAccount: (name: string) => Promise<AgentOpts>
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
  //@ts-ignore
  address: Address
  /** The friendly name of the agent. */
  name?:   string
  /** Default transaction fees to use for interacting with the chain. */
  fees?:   AgentFees
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
  getCodeId (address: Address) { return this.chain.getCodeId(address) }
  getLabel  (address: Address) { return this.chain.getLabel(address) }
  getHash   (address: Address|number) { return this.chain.getHash(address) }
  checkHash (address: Address, codeHash?: CodeHash) {
    return this.chain.checkHash(address, codeHash)
  }
  getClient <C extends Client, O extends Instance> (
    _Client: ClientCtor<C, O>   = Client as ClientCtor<C, O>,
    arg:     Address|Partial<O> = {},
    hash?:   CodeHash
  ): C {
    hash ??= (arg as Partial<O>).codeHash
    return new _Client(this, arg, hash)
  }
  query <R> (contract: Instance, msg: Message): Promise<R> {
    return this.chain.query(contract, msg)
  }
  abstract send     (to: Address, amounts: ICoin[], opts?: ExecOpts): Promise<void|unknown>
  abstract sendMany (outputs: [Address, ICoin[]][], opts?: ExecOpts): Promise<void|unknown>
  abstract upload (blob: Uint8Array): Promise<Template>
  uploadMany (blobs: Uint8Array[] = []): Promise<Template[]> {
    return Promise.all(blobs.map(blob=>this.upload(blob)))
  }
  abstract instantiate <T> (template: Template, label: string, msg: T): Promise<Instance>
  instantiateMany (configs: [Template, string, Message][] = []): Promise<Instance[]> {
    return Promise.all(configs.map(
      async ([template, label, msg])=>Object.assign(await this.instantiate(template, label, msg), {
        codeHash: template.codeHash
      })
    ))
  }
  abstract execute (contract: Instance, msg: Message, opts?: ExecOpts): Promise<void|unknown>
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
//@ts-ignore
Chain.Agent = Agent as AgentCtor<Agent>
/** Bundle is an alternate executor that collects collects messages to broadcast
  * as a single transaction in order to execute them simultaneously. For that, it
  * uses the API of its parent Agent. You can use it in scripts with:
  *    agent.bundle().wrap(async bundle=>{ client.as(bundle).exec(...) })
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
  ): Promise<Instance> {
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
  async instantiateMany (configs: [Template, Label, Message][]): Promise<Instance[]> {
    return await Promise.all(configs.map(([template, label, initMsg])=>
      this.instantiate(template, label, initMsg)
    ))
  }
  //@ts-ignore
  async execute (instance: Instance, msg: Message, { send }: ExecOpts = {}): Promise<this> {
    this.add({
      exec: {
        sender:   this.address,
        contract: instance.address,
        codeHash: instance.codeHash,
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
  async query <U> (contract: Instance, msg: Message): Promise<U> {
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
  getClient <C extends Client, O extends Instance> (
    Client: ClientCtor<C, O>, arg: Address|O
  ): C {
    return new Client(this as Executor, arg)
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
  assertCanSubmit () {
    if (this.msgs.length < 1) throw new Error('Trying to submit bundle with no messages')
  }
  abstract submit (memo: string): Promise<unknown>
  abstract save   (name: string): Promise<unknown>
}
export interface BundleCtor<B extends Bundle> {
  new (agent: Agent): B
}
/** Function passed to Bundle#wrap */
export type BundleCallback<B extends Bundle> = (bundle: B)=>Promise<void>

//@ts-ignore
Agent.Bundle = Bundle
