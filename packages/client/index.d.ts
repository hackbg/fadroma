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
    getLabel (address: string): Promise<string>
    getHash  (address: string): Promise<string>
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

  export enum ChainMode {
    Mainnet = 'Mainnet',
    Testnet = 'Testnet',
    Devnet  = 'Devnet',
    Mocknet = 'Mocknet'
  }

  export interface ChainOptions {
    mode?: ChainMode
    url?:  string
  }

  export class Chain implements Querier {
    constructor (id: string, options: ChainOptions)
    readonly id:   string
    readonly url:  string
    readonly mode: ChainMode

    query <T, U> (contract: Instance, msg: T): Promise<U>
    getLabel (address: string): Promise<string>
    getHash  (address: string): Promise<string>

    Agent: AgentCtor
    getAgent (options: AgentOptions): Promise<Agent>
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

  export class Agent implements Deployer {
    static create (chain: Chain, options: AgentOptions): Promise<Agent>
    chain:   Chain
    address: string
    name:    string
    defaultDenom: string
    constructor (chain: Chain, options: AgentOptions)
    getLabel    (address: string): Promise<string>
    getHash     (address: string): Promise<string>
    getBalance  (denom: string): Promise<bigint>
    readonly balance: Promise<bigint>
    query   <T, U>  (contract: Instance, msg: T): Promise<U> 
    execute <T, U>  (contract: Instance, msg: T): Promise<U> 
    upload          (blob: Uint8Array): Promise<Template> 
    uploadMany      (blobs: Uint8Array[]) 
    instantiate     (template: Template, label: string, msg: object) 
    instantiateMany (configs: [Template, string, object][]) 
  }

  export interface ClientOptions extends Instance {}

  export interface ClientCtor<C extends Client> {
    new (agent: Agent, options: ClientOptions): C
  }

  export class Client implements Instance {
    constructor (agent: Agent, options: ClientOptions)
    address: string
    query <T, U> (msg: T): Promise<U>
    execute <T, U> (msg: T)
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
