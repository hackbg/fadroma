/// # Data model of Fadroma Ops
///
/// As of 2021-10-10 there are 22 types/interfaces
/// exported from this module. This is way too many,
/// and measures should be taken to remove
/// redundant/single-use interfaces.


import { URL } from 'url'
import { Directory, JSONFile } from '@hackbg/tools'
import type { DeploymentsDir } from './Chain'

export type Constructor =
  new (...args: any) => any

// Contracts ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export type ContractBuildState = {
  workspace?:     string
  crate?:         string
  repo?:          string
  ref?:           string
  artifact?:      string
  codeHash?:      string
}

export interface ContractBuild extends ContractBuildState {
  build (): Promise<any>
}

export type ContractUploadState = {
  artifact?:      string
  codeHash?:      string
  chain?:         IChain
  uploader?:      IAgent
  uploadReceipt?: UploadReceipt
  codeId?:        number
}

export interface ContractUpload extends ContractUploadState {
  upload (): Promise<any>
}

export type UploadReceipt = {
  codeId:             number
  compressedChecksum: string
  compressedSize:     string
  logs:               any[]
  originalChecksum:   string
  originalSize:       number
  transactionHash:    string
}

export type ContractClientState = {
  /** The on-chain address of this contract instance */
  chain?:        IChain
  address?:      string
  codeHash?:     string
  codeId?:       number
  /** The on-chain label of this contract instance.
    * The chain requires these to be unique, so this
    * is meant to be built from the name, prefix and suffix. */
  label?:        string
  name?:         string
  prefix?:       string
  suffix?:       string
  /** The agent that initialized this instance of the contract. */
  instantiator?: IAgent
  initMsg?:      any
  initTx?:       InitTX
  initReceipt?:  InitReceipt
  /** A reference to the contract in the format that ICC callbacks expect. */
  link?:         { address: string, code_hash: string }
  /** A reference to the contract as a tuple */
  linkPair?:     [ string, string ]
}

export interface ContractClient extends ContractClientState {
  instantiate (message: ContractMessage, agent?: IAgent): Promise<any>
  query       (message: ContractMessage, agent?: IAgent): any
  execute     (message: ContractMessage, memo: string, send: Array<any>, fee: any, agent?: IAgent): any
  save        (): this
}

export type InitTX = {
  contractAddress: string
  data:            string
  logs:            Array<any>
  transactionHash: string
}

export type InitReceipt = {
  label:    string,
  codeId:   number,
  codeHash: string,
  initTx:   InitTX
}

export type ContractState = ContractBuildState & ContractUploadState & ContractClientState

export type IContract = ContractBuild & ContractUpload & ContractClient

export type ContractConstructor<T extends IContract> =
  new (args: ContractConstructorArguments) => T

export type ContractConstructorArguments = {
  address?:  string
  codeHash?: string
  codeId?:   number
  admin?:    IAgent,
  prefix?:   string
}

export type ContractMessage =
  string|Record<string, any>

// Gas fees ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

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

/// Identities and agents ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

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

export type AgentConstructor =
  new (...args: any) => IAgent

export interface IAgent extends Identity {
  readonly chain:   IChain
  readonly address: string
  readonly name:    string
  fees: Record<string, any>

  readonly nextBlock: Promise<void>
  readonly block:     Promise<any>
  readonly account:   Promise<any>
  readonly balance:   Promise<any>

  getBalance  (denomination: string): Promise<any>
  send        (to: any, amount: string|number, denom?: any, memo?: any, fee?: any): Promise<any>
  sendMany    (txs: Array<any>, memo?: string, denom?: string, fee?: any): Promise<any>

  upload      (path: string): Promise<any>
  instantiate (contract: IContract, initMsg: ContractMessage, funds?: any[]): Promise<any>
  query       (contract: IContract, message: ContractMessage): Promise<any>
  execute     (contract: IContract, message: ContractMessage, funds?: any[], memo?: any, fee?: any): Promise<any>
}

// Chains ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

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
  readonly isMainnet?:   boolean
  readonly isTestnet?:   boolean
  readonly isLocalnet?:  boolean
  readonly url:          string
  readonly ready:        Promise<this>
  readonly stateRoot?:   Directory
  readonly identities?:  Directory
  readonly uploads?:     Directory
  readonly deployments?: DeploymentsDir
  getAgent (options?: Identity): Promise<IAgent>
  getContract<T> (api: new()=>T, address: string, agent: IAgent): T
  printIdentities ():    void
}


/// Running our own chain ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~


export type ChainNodeConstructor =
  new (options?: ChainNodeOptions) => IChainNode

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

export type ChainNodeState = Record<any, any>

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
