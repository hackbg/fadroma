/// # Data model of Fadroma Ops
///
/// As of 2021-10-10 there are 22 types/interfaces
/// exported from this module. This is way too many,
/// and measures should be taken to remove
/// redundant/single-use interfaces.


import { URL } from 'url'
import { Directory, JSONFile } from '@fadroma/tools'
import type { ChainInstancesDir } from './Chain'


/// ## Contracts
/// Managing smart contracts is the whole point of this library.
/// There are quite a few bits of state to manage about them!
/// The overall pipeline goes like this:


export interface IContract {

  save (): this


  /// ### Compiling from source
  ///
  /// This part can be done offline:
  ///
  /// * A contract's source code is a Rust `crate` within a Cargo `workspace`.


  code: ContractCodeOptions
  readonly workspace?: string
  readonly crate?:     string


  /// * The code is compiled in a build container (TODO specify here?),
  ///   which results in an `artifact` (WASM blob) with a particular `codeHash`.


  build (workspace?: string, crate?: string): Promise<any>
  readonly artifact?: string
  readonly codeHash?: string


  /// ### Uploading to a chain
  ///
  /// This is the point where the contract is bound to a particular chain:
  ///
  /// * You need to specify the `chain` and `uploader`.


  blob: UploadConfig
  readonly chain:    IChain
  readonly uploader: IAgent


  /// * Uploading the artifact to a chain results in an `uploadReceipt`
  ///   that contains a `codeId` corresponding to that artifact.


  upload (chainOrAgent?: IChain|IAgent): Promise<any>
  readonly uploadReceipt: any
  readonly codeId:        number


  /// ### Instantiation and operation
  ///
  /// * Given a `codeId` and an `instantiator`, an instance of the contract
  ///   can be created on the chain where this contract was uploaded.


  init: InitState
  readonly instantiator: IAgent
  instantiate (agent?: IAgent): Promise<any>


  /// * A `label` needs to be specified for each instance.
  ///   That label needs to be unique for that chain,
  ///   otherwise the instantiation fill fail.
  ///   (TODO: document `prefix`.)
  /// * The contract's `initMsg` contains the
  ///   constructor arguments for that instance.


  readonly label:   string
  readonly initMsg: any


  /// * Once a contract is instantiated, it gets an `address`.
  ///   The address and code hash constitute the `link` to the contract.
  ///   The contract link is expressed in a bunch of different formats
  ///   across our codebase - here we provide two of them.


  readonly address:  string
  readonly link:     { address: string, code_hash: string }
  readonly linkPair: [ string, string ]


  /// * The instantiation transaction is available at `initTx`
  ///   and the response from it in `initReceipt`.


  readonly initTx:      any
  readonly initReceipt: any


  /// * Finally, a contract instance can be queried with the `query` method,
  ///   and transactions can be executed with `execute`.
  /// * The schema helpers in [Schema.ts](./Schema.ts)
  ///   automatically generate wrapper methods around `query` and `execute`.


  query   (method: string, args: any, agent?: IAgent): any
  execute (method: string, args: any, memo: string, send: Array<any>, fee: any, agent?: IAgent): any

}

export type UploadConfig = {
  chain?:    IChain
  agent?:    IAgent
  codeId?:   number
  codeHash?: string
  receipt?:  UploadReceipt
}

export type UploadReceipt = {
  codeId:             number
  compressedChecksum: string
  compressedSize:     string
  logs:               Array<any>
  originalChecksum:   string
  originalSize:       number
  transactionHash:    string
}

export type InitState = {
  prefix?:  string
  agent?:   IAgent
  address?: string
  label?:   string
  msg?:     any
  tx?:      InitReceipt
}

export type InitReceipt = {
  contractAddress: string
  data:            string
  logs:            Array<any>
  transactionHash: string
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


/// ## Chain


export type DefaultIdentity =
  null |
  string |
  { name?: string, address?: string, mnemonic?: string } |
  IAgent

export interface IChainOptions {
  chainId?: string
  apiURL?:  URL
  node?:    IChainNode

  /** Credentials of the default agent for this network. */
  defaultIdentity?: DefaultIdentity
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
  readonly url:   string
  readonly ready: Promise<this>

  getAgent (options?: Identity): Promise<IAgent>
  getContract<T> (api: new()=>T, address: string, agent: IAgent): T

  readonly stateRoot?:  Directory

  readonly identities?: Directory
  printIdentities (): void

  readonly uploads?:    Directory

  readonly instances?:  ChainInstancesDir
  printActiveInstance (): void
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


/// #### Docker backend
/// These are the endpoints from [Dockerode](https://github.com/apocas/dockerode)
/// that are used to instantiate a chain locally.
/// * **Mock** in [/test/mocks.ts](../test/mocks.ts)


export interface IDocker {
  getImage (): {
    inspect (): Promise<any>
  }
  pull (image: any, callback: Function): void
  modem: {
    followProgress (
      stream:   any,
      callback: Function,
      progress: Function
    ): any
  }
  getContainer (id: any): {
    id: string,
    start (): Promise<any>
  }
  createContainer (options: any): {
    id: string
    logs (_: any, callback: Function): void
  }
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

export type Constructor =
  new (...args: any) => any

export type AgentConstructor =
  new (...args: any) => IAgent

export type ChainNodeConstructor =
  new (options?: ChainNodeOptions) => IChainNode
