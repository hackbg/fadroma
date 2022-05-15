export type Address = string

export abstract class Agent implements Executor {
  static create (chain: Chain, options: AgentOptions = {}): Promise<Agent> {
    throw Object.assign(new Error('Agent.create: abstract, use subclass'), { options })
  }
  constructor (readonly chain: Chain, options: AgentOptions = {}) {
    this.chain = chain
    this.name  = options.name
  }
  address:      Address
  name:         string
  defaultDenom: string
  get balance (): Promise<string> {
    return this.getBalance(this.defaultDenom)
  }
  get height (): Promise<number> {
    return Promise.resolve(0)
  }
  get nextBlock () {
    return new Promise<void>(async resolve=>{
      this.height.then(async startingHeight=>{
        while (true) {
          await new Promise(ok=>setTimeout(ok, 1000))
          const height = await this.height
          if (height > startingHeight) {
            resolve()
          }
        }
      })
    })
  }
  getCodeId (address: Address) {
    return this.chain.getCodeId(address)
  }
  getLabel (address: Address) {
    return this.chain.getLabel(address)
  }
  getHash (address: Address) {
    return this.chain.getHash(address)
  }
  getBalance (denom = this.defaultDenom): Promise<string> {
    return Promise.resolve('0')
  }
  getClient <C extends Client> (Client: ClientCtor<C>, options: ClientOptions) {
    return new Client(this, options)
  }
  query <M, R> (contract: Instance, msg: M): Promise<R> {
    return this.chain.query(contract, msg)
  }
  abstract execute <M, R> (contract: Instance, msg: M, opts?: ExecOpts): Promise<R>
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
  bundle <T> (): T {
    throw new Error('Agent#bundle: not implemented')
  }
  Bundle: Bundle
}

export interface AgentCtor<A extends Agent> {
  new    (chain: Chain, options: AgentOptions): A
  create (chain: Chain, options: AgentOptions): Promise<A>
}

export interface AgentOptions {
  name?:     string
  mnemonic?: string
  address?:  Address
}

export interface Artifact {
  url:      URL
  codeHash: CodeHash
}

export abstract class Bundle implements Executor {
  address: Address
  abstract query <T, U> (contract: Instance, msg: T): Promise<U>
  abstract getCodeId (address: Address): Promise<string>
  abstract getLabel  (address: Address): Promise<string>
  abstract getHash   (address: Address): Promise<string>
  abstract upload (code: Uint8Array): Promise<Template>
  abstract uploadMany (code: Uint8Array[]): Promise<Template[]>
  abstract instantiate (template: Template, label: string, msg: Message): Promise<Instance>
  abstract instantiateMany (configs: [Template, string, Message][]): Promise<Instance[]>
  abstract execute <T, R> (contract: Instance, msg: T, opts?: ExecOpts): Promise<R>
}

export type ChainId = string

export enum ChainMode {
  Mainnet = 'Mainnet',
  Testnet = 'Testnet',
  Devnet  = 'Devnet',
  Mocknet = 'Mocknet'
}

export interface ChainOptions {
  url?:  string
  mode?: ChainMode
  node?: DevnetHandle
}

export abstract class Chain implements Querier {
  static Mode = ChainMode
  constructor (
    readonly id: ChainId,
    options: ChainOptions = {}
  ) {
    if (!id) {
      throw new Error('Chain: need to pass chain id')
    }
    this.id = id
    if (options.url)  this.url  = options.url
    if (options.mode) this.mode = options.mode
    if (options.node) {
      if (options.mode === Chain.Mode.Devnet) {
        this.node = options.node
      } else {
        console.warn('Chain: "node" option passed to non-devnet. Ignoring')
      }
    }
  }
  readonly url:   string
  readonly mode:  ChainMode
  readonly node?: DevnetHandle
  get isMainnet () {
    return this.mode === Chain.Mode.Mainnet
  }
  get isTestnet () {
    return this.mode === Chain.Mode.Testnet
  }
  get isDevnet  () {
    return this.mode === Chain.Mode.Devnet
  }
  get isMocknet () {
    return this.mode === Chain.Mode.Mocknet
  }
  abstract query <T, U> (contract: Instance, msg: T): Promise<U>
  abstract getCodeId (address: Address): Promise<CodeId>
  abstract getLabel (address: Address): Promise<string>
  abstract getHash (address: Address): Promise<CodeHash>
  abstract Agent: AgentCtor<Agent>
  async getAgent (options) {
    if (!options.mnemonic && options.name && this.node) {
      console.info('Using devnet genesis account:', options.name)
      options = await this.node.getGenesisAccount(options.name)
    }
    return await this.Agent.create(this, options)
  }
}

export class Client implements Instance {
  constructor (readonly agent: Agent, options) {
    this.address  = options.address
    this.codeHash = options.codeHash
    this.fees     = options.fees
  }
  name:     string
  codeHash: CodeHash
  codeId:   CodeId
  label:    string
  address:  Address
  fees:     Fees
  get chain () {
    return this.agent.chain
  }
  async query <T, U> (msg: T): Promise<U> {
    return await this.agent.query(this, msg)
  }
  async execute <M, R> (msg: M, opt?: ExecOpts): Promise<R> {
    return await this.agent.execute(this, msg, opt)
  }
  async populate (): Promise<void> {
    const [label, codeId, codeHash] = await Promise.all([
      this.agent.getLabel(this.address),
      this.agent.getCodeId(this.address),
      this.agent.getHash(this.address)
    ])
    // TODO warn if retrieved values contradict current ones
    this.label    = label
    this.codeId   = codeId
    this.codeHash = codeHash
  }
  withFees (fees: Fees): this {
    return new (this.constructor as ClientCtor<typeof this>)(this.agent, {...this, fees})
  }
}

export interface ClientCtor<C extends Client> {
  new (agent: Agent, options: ClientOptions): C
}

export interface ClientOptions extends Instance {}

export type CodeHash = string

export type CodeId = string

export class Coin implements ICoin {
  constructor (amount: number|string, readonly denom: string) {
    this.amount = String(amount)
  }
  readonly amount: string
}

export class ContractLink {
  constructor (readonly address: Address, readonly code_hash: CodeHash) {}
}

export type Decimal = string

export type Decimal256 = string

export interface DevnetHandle {
  terminate:         ()             => Promise<void>
  getGenesisAccount: (name: string) => Promise<AgentOptions>
}

export type Duration = number

export interface ExecOpts {
  fee?:  IFee
  send?: ICoin[]
  memo?: string
}

export interface Executor extends Querier {
  address:        Address
  upload          (code: Uint8Array):   Promise<Template>
  uploadMany      (code: Uint8Array[]): Promise<Template[]>
  instantiate     (template: Template, label: string, msg: Message): Promise<Instance>
  instantiateMany (configs: [Template, string, Message][]):          Promise<Instance[]>
  execute <T, R>  (contract: Instance, msg: T, opts?: ExecOpts):     Promise<R>
}

export class Fee implements IFee {
  constructor (amount: Uint128|number, denom: string, readonly gas = String(amount)) {
    this.amount = [{ amount: String(amount), denom }]
  }
  readonly amount: readonly ICoin[]
}

export interface Fees {
  upload?: IFee
  init?:   IFee
  exec?:   IFee
  send?:   IFee
}

export interface ICoin {
  amount: Uint128
  denom:  string
}

export interface IFee {
  amount: readonly ICoin[]
  gas:    Uint128
}

export interface Instance extends Template {
  address: Address
  label?:  string
}

export type Moment = number

export type Message = object|string

export interface Querier {
  query <T, U> (contract: Instance, msg: T): Promise<U>
  getCodeId (address: Address): Promise<string>
  getLabel  (address: Address): Promise<string>
  getHash   (address: Address): Promise<string>
}

export interface Template {
  uploadTx?: TxHash
  chainId?:  ChainId
  codeId?:   CodeId
  codeHash?: CodeHash
}

export type TxHash = string

export type Uint128 = string

export type Uint256 = string
