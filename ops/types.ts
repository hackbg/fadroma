import type { Path, JSONFile, Directory } from './system'
import type { Docker } from './network'

export { Path }

export type CommandName = string
export type CommandInfo = string
export type Command  = [CommandName|Array<CommandName>, CommandInfo, Function, Commands?]
export type Commands = Array<Command|null>

// Chain ///////////////////////////////////////////////////////////////////////////////////////////

export interface ChainOptions {
  chainId?: string
  apiURL?:  URL
  node?:    ChainNode
  defaultAgent?: Identity
}

export interface ChainConnectOptions extends ChainOptions {
  apiKey?: string
}

export interface ChainState extends ChainOptions {
  readonly stateRoot?:  string
  readonly identities?: string
  readonly uploads?:    string
  readonly instances?:  string
}

/* Represents an interface to a particular Cosmos blockchain.
 * Used to construct agents, builders, and contracts that are
 * bound to a particular chain. */
export abstract class Chain implements ChainOptions {
  chainId?: string
  apiURL?:  URL
  node?:    ChainNode

  /** Credentials of the default agent for this network. */
  defaultAgent?: Identity

  /** Stuff that should be in the constructor but is asynchronous.
    * FIXME: How come nobody has proposed sugar for async constructors yet?
    * Feeling like writing a `@babel/plugin-async-constructor`, as always
    * bonus internet points for whoever beats me to it. */
  abstract init (): Promise<Chain>

  /** The connection address is stored internally as a URL object,
    * but returned as a string.
    * FIXME why so? */
  abstract get url (): string

  /** Get an Agent that works with this Chain. */
  abstract getAgent (options?: Identity): Promise<Agent>

  /** Get a Builder that works with this Chain,
    * optionally providing a specific Agent to perform
    * the contract upload operation. */
  abstract getBuilder (agent?: Agent): Promise<BuildUploader>

  /** Get a Contract that exists on this Chain, or a non-existent one
    * which you can then create via Agent#instantiate
    *
    * FIXME: awkward inversion of control */
  abstract getContract<T> (api: T, address: string, agent: any): T

  /** This directory contains all the others. */
  readonly stateRoot: Directory

  /** This directory stores all private keys that are available for use. */
  readonly identities: Directory

  /** This directory stores receipts from the upload transactions,
    * containing provenance info for uploaded code blobs. */
  readonly uploads: Directory

  /** This directory stores receipts from the instantiation (init) transactions,
    * containing provenance info for initialized contract instances.
    *
    * NOTE: the current domain vocabulary considers initialization and instantiation,
    * as pertaining to contracts on the blockchain, to be the same thing. */
  readonly instances: Directory

  abstract printStatusTables (): void
}

// Node ////////////////////////////////////////////////////////////////////////////////////////////

export interface ChainNode {
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

export type ChainNodeOptions = {
  /** Handle to Dockerode or compatible
   *  TODO mock! */
  docker?:    Docker
  /** Docker image of the chain's runtime. */
  image?:     string
  /** Internal name that will be given to chain. */
  chainId?:   string
  /** Path to directory where state will be stored. */
  stateRoot?: string,
  /** Names of genesis accounts to be created with the node */
  identities?: Array<string>
}

// Identities //////////////////////////////////////////////////////////////////////////////////////

export type Identity = {
  chain?:    Chain,
  name?:     string,
  type?:     string,
  address?:  string
  pubkey?:   string
  mnemonic?: string
  keyPair?:  any
  pen?:      any
  fees?:     any
}

export abstract class Agent implements Identity {
  readonly chain:   Chain
  readonly address: string
  readonly name:    string
  fees: Record<string, any>

  type?:     string
  pubkey?:   string
  mnemonic?: string
  keyPair?:  any
  pen?:      any

  abstract get nextBlock (): Promise<void>
  abstract get block     (): Promise<any>
  abstract get account   (): Promise<any>
  abstract get balance   (): Promise<any>

  abstract getBalance (denomination: string): Promise<any>

  abstract send (recipient:        any,
                 amount: string|number,
                 denom?:           any,
                 memo?:            any,
                 fee?:             any): Promise<any>

  abstract sendMany (txs: Array<any>,
                     memo?:   string,
                     denom?:  string,
                     fee?:       any): Promise<any>

  abstract upload (path:   string): Promise<any>

  abstract instantiate (codeId: number,
                        label:  string,
                        initMsg:   any): Promise<any>

  abstract query (link:      any,
                  method: string,
                  args?:     any): Promise<any>

  abstract execute (link:      any,
                    method: string,
                    args?:     any,
                    memo?:     any,
                    transfer?: any,
                    fee?:      any): Promise<any>
}

/** Check if the passed instance has required methods to behave like an Agent */
export const isAgent = (maybeAgent: any): boolean => (
  maybeAgent &&
  typeof maybeAgent === "object" &&
  typeof maybeAgent.query === "function" &&
  typeof maybeAgent.execute === "function"
)

export type Prefund = {
  /** Taskmaster. TODO replace with generic observability mechanism (RxJS?) */
  task?:       Function
  /** How many identities to create */
  count?:      number
  /** How many native tokens to send to each identity */
  budget?:     bigint
  /** On which chain is this meant to happen? */
  chain?:      Chain
  /** Agent that distributes the tokens -
   *  needs to have sufficient balance 
   *  e.g. genesis account on localnet) */
  agent?:      Agent
  /** Map of specific recipients to receive funds. */
  recipients?: Record<any, {agent: Agent}>
  /** Map of specific identities to receive funds.
   *  FIXME redundant with the above*/
  identities?: any
}

// Gas fees ////////////////////////////////////////////////////////////////////////////////////////

export interface Gas {
  amount: Array<{amount: string, denom: string}>
  gas:    string
}

export type Fees = {
  upload: Gas
  init:   Gas
  exec:   Gas
  send:   Gas
}

// Contract deployment /////////////////////////////////////////////////////////////////////////////

export interface BuildUploader {
  build          (options: BuildOptions): Promise<Path>
  buildOrCached  (options: BuildOptions): Promise<Path>
  upload         (artifact: any): Promise<any>
  uploadOrCached (artifact: any): Promise<any>
}
 
export type BuilderOptions = {
  docker?: Docker
}

export type BuildOptions = {
  /* Set this to build a remote commit instead of the working tree. */
  repo?:           { origin: string, ref: string },
  /* Path to root Cargo workspace of project. */
  workspace:        Path
  /* Name of contract crate to build. */
  crate:            string
  /* Path where the build artifacts will be produced. */
  outputDir?:       string
  /* Allows additional directories to be bound to the build container. */
  additionalBinds?: Array<any>
  /* Allow user to specify that the contracts shouldn't be built in parallel. */
  sequential?:      boolean
}

export abstract class ContractConfig {
  readonly workspace: string
  readonly crate:     string
  readonly label:     string
  readonly initMsg:   any = {}
}

export interface Contract {
  readonly workspace?: string
  readonly crate?:     string
  readonly artifact?:  string
  readonly codeHash?:  string
  build (workspace?: string, crate?: string): Promise<any>

  readonly chain:         Chain
  readonly uploader:      Agent
  readonly uploadReceipt: any
  readonly codeId:        number
  upload (chainOrAgent?: Chain|Agent): Promise<any>

  readonly instantiator: Agent
  readonly address:      string
  readonly link:         { address: string, code_hash: string }
  readonly linkPair:     [ string, string ]
  readonly label:        string
  readonly initMsg:      any
  readonly initTx:       any
  readonly initReceipt:  any
  instantiate (agent?: Agent): Promise<any>

  query (method: string, args: any, agent?: Agent): any
  execute (method: string, args: any, memo: string, 
           transferAmount: Array<any>, fee: any, agent?: Agent): any

  save (): void
}

export interface Ensemble {
  /* Build, upload, and initialize. */
  deploy (): Promise<Instances>

  /* Compile the contracts from source using a Builder. */
  build (parallel: boolean): Promise<Artifacts>

  /* Upload the contracts to a Chain using a BuildUploader. */
  upload (): Promise<Uploads>

  /* Init instances of uploaded contracts using an Agent. */
  initialize (): Promise<Instances>

  /* Definitions of all user-available actions for this ensemble. */
  commands (): Commands

  /* Definitions of commands that don't require a connection. */
  localCommands (): Commands

  /* Definitions of commands that require a connection. */
  remoteCommands (): Commands
}

export type EnsembleOptions = {
  task?:  Taskmaster
  chain?: Chain
  agent?: Agent
  additionalBinds?: Array<any>
}

// TODO populate with correct contract parent classes
export type Artifacts = Record<string, any>
export type Uploads   = Record<string, any>
export type Instances = Record<string, any>

/* Taskmaster is a quick and dirty stopwatch/logging helper that can
 * generate a rough profile of one or more contract operations
 * in terms of time and gas. */
export type Taskmaster = Function & {
  /* Call when complete. */
  done:     Function
  /* Run several operations in parallel. */
  parallel: Function
}
