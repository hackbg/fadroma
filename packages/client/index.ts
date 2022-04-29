export enum ChainMode {
  Mainnet = 'Mainnet',
  Testnet = 'Testnet',
  Devnet  = 'Devnet',
  Mocknet = 'Mocknet'
}

export interface ChainOptions {
  mode?: string
  url?:  string
}

export interface Querier {
  query <T, U> (contract: Instance, msg: T): Promise<U>
  getLabel (address: string): Promise<string>
  getHash  (address: string): Promise<string>
}

export class Chain implements Querier {
  static Mode = ChainMode

  constructor (
    public readonly id: string,
    options: ChainOptions = {}
  ) {
    if (!id) {
      throw new Error('Chain: need to pass chain id')
    }
    const { mode, url } = options
    this.mode = mode
    this.url  = url
  }

  mode: string
  get isMainnet () { return this.mode === Chain.Mode.Mainnet }
  get isTestnet () { return this.mode === Chain.Mode.Testnet }
  get isDevnet  () { return this.mode === Chain.Mode.Devnet  }
  get isMocknet () { return this.mode === Chain.Mode.Mocknet }

  url:  string
  async query <T, U> (contract: Instance, msg: T): Promise<U> {
    return
  }
  async getLabel (address: string): Promise<string> {
    return ''
  }
  async getHash (address: string): Promise<string> {
    return ''
  }

  Agent: AgentCtor = Agent
  async getAgent (options: AgentOptions) {
    return await this.Agent.create(this, options)
  }
}

export interface Template {
  codeId?:   string
  codeHash?: string
}

export interface Instance extends Template {
  address:   string
}

export interface Executor {
  address: string
  execute <T, U> (contract: Instance, msg: T, funds: any[], memo?: any, fee?: any): Promise<U>
}

export interface AgentCtor {
  new    (chain: Chain, options: AgentOptions): Agent
  create (chain: Chain, options: AgentOptions): Promise<Agent>
}

export interface AgentOptions {
  name?:     string
  mnemonic?: string
  address?:  string
}

export class Agent implements Executor {
  static async create (chain: Chain, options: AgentOptions) {
    return new Agent(chain, options)
  }
  constructor (
    public readonly chain: Chain,
    options: AgentOptions
  ) {
    const { name, mnemonic } = options
    this.name = name
  }
  name:    string = 'Anonymous'
  address: string
  async query <T, U> (contract: Instance, msg: T): Promise<U> {
    return
  }
  async execute <T, U> (contract: Instance, msg: T): Promise<U> {
    return
  }
  async getLabel (address: string): Promise<string> {
    return this.chain.getLabel(address)
  }
  async getHash (address: string): Promise<string> {
    return this.chain.getHash(address)
  }
  get balance (): Promise<bigint> {
    return this.getBalance(this.defaultDenom)
  }
  async getBalance (denom: string = this.defaultDenom): Promise<bigint> {
    return 0n
  }
  defaultDenom = ''
}

export interface ClientOptions extends Instance {
}

export interface ClientCtor<C extends Client> {
  new (agent: Agent, options: ClientOptions): C
}

export class Client implements Instance {
  constructor (
    private readonly agent: Agent,
    options: ClientOptions
  ) {
    const { address } = options
  }
  address: string
  query <T, U> (msg: T): Promise<U> {
    return this.agent.query(this, msg)
  }
  execute <T, U> (msg: T) {
    return this.agent.execute(this, msg)
  }
}

export interface Coin {
  amount: string
  denom:  string
}

export class Gas {
  amount: Coin[] = []
  gas:    string
  constructor (x: number) {
    const amount = String(x)
    this.gas = amount
  }
}

export interface Fees {
  upload: Gas
  init:   Gas
  exec:   Gas
  send:   Gas
}
