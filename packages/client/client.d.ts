declare module '@fadroma/client' {

  export interface Artifact {
    url:      URL
    codeHash: string
  }

  export interface Template {
    chainId?:  string
    codeId?:   string
    codeHash?: string
  }

  export interface Instance extends Template {
    address:   string
    label?:    string
  }

  export interface Querier {
    query <T, U> (contract: Instance, msg: T): Promise<U>
    getCodeId (address: string): Promise<string>
    getLabel  (address: string): Promise<string>
    getHash   (address: string): Promise<string>
  }

  export interface Executor extends Querier {
    address: string
    execute <T, U> (contract: Instance, msg: T, funds: any[], memo?: any, fee?: any): Promise<U>
  }

  export interface Deployer extends Executor {
    upload          (code: Uint8Array):                               Promise<Template>
    uploadMany      (code: Uint8Array[]):                             Promise<Template[]>
    instantiate     (template: Template, label: string, msg: object): Promise<Instance>
    instantiateMany (configs: [Template, string, object][]):          Promise<Instance[]>
  }

  export interface ChainMode {
    Mainnet
    Testnet
    Devnet
    Mocknet
  }

  export interface ChainOptions {
    url?:  string
    mode?: ChainMode
    node?: DevnetHandle
  }

  export interface DevnetHandle {
    terminate:         ()             => Promise<void>
    getGenesisAccount: (name: string) => Promise<AgentOptions>
  }

  export class Chain implements Querier {
    static Mode: ChainMode
    constructor (id: string, options: ChainOptions)
    readonly id:        string
    readonly url:       string
    readonly mode:      ChainMode
    readonly isMainnet: boolean
    readonly isTestnet: boolean
    readonly isDevnet:  boolean
    readonly isMocknet: boolean

    query <T, U> (contract: Instance, msg: T): Promise<U>
    getCodeId (address: string): Promise<string>
    getLabel  (address: string): Promise<string>
    getHash   (address: string): Promise<string>

    Agent: AgentCtor<any>
    getAgent (options: AgentOptions): Promise<Agent>
  }

  export interface AgentCtor<A extends Agent> {
    new    (chain: Chain, options: AgentOptions): A
    create (chain: Chain, options: AgentOptions): Promise<A>
  }

  export interface AgentOptions {
    name?:     string
    mnemonic?: string
    address?:  string
  }

  export class Agent implements Deployer {
    static create (chain: Chain, options: AgentOptions): Promise<Agent>
    chain:   Chain
    address: string
    name:    string
    defaultDenom: string
    constructor (chain: Chain, options: AgentOptions)
    getClient <C extends Client> (Client: ClientCtor<C>, options: ClientOptions): C
    getCodeId   (address: string): Promise<string>
    getLabel    (address: string): Promise<string>
    getHash     (address: string): Promise<string>
    getBalance  (denom: string): Promise<bigint>
    readonly balance: Promise<bigint>
    query           (contract: Instance, msg: never): Promise<any>
    execute         (contract: Instance, msg: never, ...args: any[]): Promise<any>
    upload          (blob: Uint8Array): Promise<Template>
    uploadMany      (blobs: Uint8Array[])
    instantiate     (template: Template, label: string, msg: object)
    instantiateMany (configs: [Template, string, object][])
    bundle      <T> (): T
  }

  export interface ClientOptions extends Instance {}

  export interface ClientCtor<C extends Client> {
    new (agent: Agent, options: ClientOptions): C
  }

  export class Client implements Instance {
    constructor (agent: Agent, options: ClientOptions)
    agent:    Agent
    address:  string
    codeId:   string
    codeHash: string
    label:    string
    name:     string
    query   <T, U> (msg: T): Promise<U>
    execute <T, U> (msg: T): Promise<U>
    populate (): Promise<void>
    withFees (fees: Fees): this
  }

  export interface Coin {
    amount: string
    denom:  string
  }

  export class Gas {
    amount: Coin[]
    gas:    string
    constructor (x: number)
  }

  export interface Fees {
    upload: Gas
    init:   Gas
    exec:   Gas
    send:   Gas
  }

}
