declare module '@fadroma/client' {

  export type ChainId  = string

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

  export class Chain implements Querier {
    static Mode: ChainMode
    constructor <CO extends ChainOptions> (id: string, options: CO)
    readonly id:        ChainId
    readonly url:       string
    readonly mode:      ChainMode
    readonly isMainnet: boolean
    readonly isTestnet: boolean
    readonly isDevnet:  boolean
    readonly isMocknet: boolean

    query <T, U> (contract: Instance, msg: T): Promise<U>
    getCodeId (address: Address): Promise<string>
    getLabel  (address: Address): Promise<string>
    getHash   (address: Address): Promise<string>

    Agent: AgentCtor<any>
    getAgent <AO extends AgentOptions, A extends Agent> (options: AO): Promise<A>
  }

  export interface DevnetHandle {
    terminate:         ()             => Promise<void>
    getGenesisAccount: (name: string) => Promise<AgentOptions>
  }

  export type Address  = string

  export type CodeHash = string

  export type CodeId   = string

  export interface Artifact {
    url:      URL
    codeHash: CodeHash
  }

  export interface Template {
    chainId?:  ChainId
    codeId?:   CodeId
    codeHash?: CodeHash
  }

  export interface Instance extends Template {
    address: Address
    label?:  string
  }

  export interface Querier {
    query <T, U> (contract: Instance, msg: T): Promise<U>
    getCodeId (address: Address): Promise<string>
    getLabel  (address: Address): Promise<string>
    getHash   (address: Address): Promise<string>
  }

  export interface Executor extends Querier {
    address:        Address
    upload          (code: Uint8Array):                               Promise<Template>
    uploadMany      (code: Uint8Array[]):                             Promise<Template[]>
    instantiate     (template: Template, label: string, msg: object): Promise<Instance>
    instantiateMany (configs: [Template, string, object][]):          Promise<Instance[]>
    execute <T, U>  (contract: Instance, msg: T, funds: any[], memo?: any, fee?: any): Promise<U>
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

  export class Agent implements Executor {
    static create (chain: Chain, options: AgentOptions): Promise<Agent>
    chain: Chain
    address: Address
    name: string
    defaultDenom: string
    constructor (chain: Chain, options: AgentOptions)
    getClient <C extends Client> (Client: ClientCtor<C>, options: ClientOptions): C
    getCodeId (address: Address): Promise<string>
    getLabel (address: Address): Promise<string>
    getHash (address: Address): Promise<string>
    getBalance (denom: string): Promise<string>
    get balance (): Promise<string>
    query (contract: Instance, msg: never): Promise<any>
    execute (contract: Instance, msg: never, ...args: any[]): Promise<any>
    upload (blob: Uint8Array): Promise<Template>
    uploadMany (blobs: Uint8Array[])
    instantiate (template: Template, label: string, msg: object)
    instantiateMany (configs: [Template, string, object][])
    bundle <T> (): T
  }

  export interface ClientOptions extends Instance {}

  export interface ClientCtor<C extends Client> {
    new (agent: Agent, options: ClientOptions): C
  }

  export class Client implements Instance {
    constructor (agent: Agent, options: ClientOptions)
    agent:    Agent
    address:  Address
    codeId:   CodeId
    codeHash: CodeHash
    label:    string
    name:     string
    query   <T, U> (msg: T): Promise<U>
    execute <T, U> (msg: T): Promise<U>
    populate (): Promise<void>
    withFees (fees: Fees): this
  }

  export interface Coin {
    amount: Uint128
    denom:  string
  }

  export class Gas {
    amount: readonly Coin[]
    gas:    Uint128
    constructor (x: number)
  }

  export interface Fees {
    upload?: Gas
    init?:   Gas
    exec?:   Gas
    send?:   Gas
  }

  export type Uint128    = string
  export type Uint256    = string
  export type Decimal    = string
  export type Decimal256 = string
  export type Duration   = number
  export type Moment     = number

}
