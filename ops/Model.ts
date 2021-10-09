/// # Data model of Fadroma Ops


import { URL } from 'url'
import { Directory, JSONFile } from '@fadroma/tools'


/// ## Chain


export interface IChainOptions {
  chainId?: string
  apiURL?:  URL
  node?:    IChainNode
  defaultIdentity?: Identity
}

export interface IChainConnectOptions extends IChainOptions {
  apiKey?:     string
  identities?: Array<string>
}

export interface IChainState extends IChainOptions {
  readonly isMainnet?:  boolean
  readonly isTestnet?:  boolean
  readonly isLocalnet?: boolean

  readonly stateRoot?:  string
  readonly identities?: string
  readonly uploads?:    string
  readonly instances?:  string
}

export interface IChain extends IChainOptions {
  readonly url: string

  init (): Promise<this>
  getAgent (options?: Identity): Promise<IAgent>
  getContract<T> (api: new()=>T, address: string, agent: IAgent): T

  readonly stateRoot?:  Directory
  readonly identities?: Directory
  readonly uploads?:    Directory
  readonly instances?:  Directory
}


/// ### Running our own chain


export type ChainNodeState = Record<any, any>

export type ChainNodeOptions = {
  /** Handle to Dockerode or compatible
   *  TODO mock! */
  docker?:    IDocker
  /** Docker image of the chain's runtime. */
  image?:     string
  /** Internal name that will be given to chain. */
  chainId?:   string
  /** Path to directory where state will be stored. */
  stateRoot?: string,
  /** Names of genesis accounts to be created with the node */
  identities?: Array<string>
}

export interface IChainNode {
  chainId: string
  apiURL:  URL
  port:    number
  /** Resolved when the node is ready */
  readonly ready: Promise<void>
  /** Path to the node state directory */
  readonly stateRoot: Directory
  /** Path to the node state file */
  readonly nodeState: JSONFile
  /** Path to the directory containing the keys to the genesis accounts. */
  readonly identities: Directory
  /** Retrieve the node state */
  load      (): ChainNodeState
  /** Start the node */
  spawn     (): Promise<void>
  /** Save the info needed to respawn the node */
  save      (): this
  /** Stop the node */
  kill      (): Promise<void>
  /** Start the node if stopped */
  respawn   (): Promise<void>
  /** Erase the state of the node */
  erase     (): Promise<void>
  /** Stop the node and erase its state from the filesystem. */
  terminate () : Promise<void>
  /** Retrieve one of the genesis accounts stored when creating the node. */
  genesisAccount (name: string): Identity
}


/// ### Gas handling


export type Gas = {
  amount: Array<{amount: string, denom: string}>
  gas:    string
}

export type Fees = {
  upload: Gas
  init:   Gas
  exec:   Gas
  send:   Gas
}

export type Prefund = {
  /** Taskmaster. TODO replace with generic observability mechanism (RxJS?) */
  task?:       Function
  /** How many identities to create */
  count?:      number
  /** How many native tokens to send to each identity */
  budget?:     bigint
  /** On which chain is this meant to happen? */
  chain?:      IChain
  /** Agent that distributes the tokens -
   *  needs to have sufficient balance 
   *  e.g. genesis account on localnet) */
  agent?:      IAgent
  /** Map of specific recipients to receive funds. */
  recipients?: Record<any, {agent: IAgent}>
  /** Map of specific identities to receive funds.
   *  FIXME redundant with the above*/
  identities?: any
}


/// ## Identities


export type Identity = {
  chain?:    IChain,
  address?:  string

  name?:     string,
  type?:     string,
  pubkey?:   string
  mnemonic?: string
  keyPair?:  any
  pen?:      any
  fees?:     any
}


/// ### Agent


export interface IAgent extends Identity {
  readonly chain:   IChain
  readonly address: string
  readonly name:    string
  fees: Record<string, any>

  readonly nextBlock: Promise<void>
  readonly block: Promise<any>
  readonly account: Promise<any>
  readonly balance: Promise<any>

  getBalance  (denomination: string): Promise<any>
  send        (to: any, amount: string|number, denom?: any, memo?: any, fee?: any): Promise<any>
  sendMany    (txs: Array<any>, memo?: string, denom?: string, fee?: any): Promise<any>
  upload      (path: string): Promise<any>
  instantiate (codeId: number, label: string, initMsg: any): Promise<any>
  query       (link: any, method: string, args?: any): Promise<any>
  execute     (link: any, method: string, args?: any, memo?: any, send?: any, fee?: any): Promise<any>
}


/// ## Contracts


export interface IContract {

  save (): this


  // ### Compilation
  // Info needed to compile a contract from source to WASM blob:


  code: ContractCodeOptions
  readonly workspace?: string
  readonly crate?:     string
  readonly artifact?:  string
  readonly codeHash?:  string
  build (workspace?: string, crate?: string): Promise<any>


  // ### Upload
  // Info needed to upload a WASM blob to a chain,
  // resulting in a code id:


  blob: {
    chain?:    IChain
    agent?:    IAgent
    codeId?:   number
    codeHash?: string
    receipt?: {
      codeId:             number
      compressedChecksum: string
      compressedSize:     string
      logs:               Array<any>
      originalChecksum:   string
      originalSize:       number
      transactionHash:    string
    }
  }
  readonly chain:         IChain
  readonly uploader:      IAgent
  readonly uploadReceipt: any
  readonly codeId:        number
  upload (chainOrAgent?: IChain|IAgent): Promise<any>


  // ### Instantiation and operation
  // Info needed to create a contract instance
  // from a code id and an init message,
  // as well as perform queries and transactions
  // on that instance:


  init: {
    prefix?:  string
    agent?:   IAgent
    address?: string
    label?:   string
    msg?:     any
    tx?: {
      contractAddress: string
      data:            string
      logs:            Array<any>
      transactionHash: string
    }
  }
  readonly instantiator: IAgent
  readonly address:      string
  readonly link:         { address: string, code_hash: string }
  readonly linkPair:     [ string, string ]
  readonly label:        string
  readonly initMsg:      any
  readonly initTx:       any
  readonly initReceipt:  any
  instantiate (agent?: IAgent): Promise<any>
  query   (method: string, args: any, agent?: IAgent): any
  execute (method: string, args: any, memo: string, send: Array<any>, fee: any, agent?: IAgent): any
}

export type ContractCodeOptions = {
  workspace?: string
  crate?:     string
  artifact?:  string
  codeHash?:  string
}

export type ContractUploadOptions = ContractCodeOptions & {
  agent?:  IAgent
  chain?:  IChain
  codeId?: number
}

export type ContractInitOptions = ContractUploadOptions & {
  agent?:   IAgent
  address?: string
  prefix?:  string
  label?:   string
  initMsg?: Record<any, any>
}

export type ContractAPIOptions = ContractInitOptions & {
  schema?: Record<string, any>,
}
