import type { Path, JSONFile, Directory } from './system'
import type { Docker } from './network'

export { Path }

export type CommandName = string
export type CommandInfo = string
export type Command  = [CommandName|Array<CommandName>, CommandInfo, Function, Commands?]
export type Commands = Array<Command|null>

/* Represents an interface to a particular Cosmos blockchain.
 * Used to construct agents, builders, and contracts that are
 * bound to a particular chain. */
export interface Chain extends ChainOptions {

  /** Stuff that should be in the constructor but is asynchronous.
    * FIXME: How come nobody has proposed sugar for async constructors yet?
    * Feeling like writing a `@babel/plugin-async-constructor`, as always
    * bonus internet points for whoever beats me to it. */
  init (): Promise<Chain>

  /** The connection address is stored internally as a URL object,
    * but returned as a string.
    * FIXME why so? */
  get url (): string

  /** Get an Agent that works with this Chain. */
  getAgent (options?: Identity): Promise<Agent>

  /** Get a Builder that works with this Chain,
    * optionally providing a specific Agent to perform
    * the contract upload operation. */
  getBuilder (agent?: Agent): Promise<BuildUploader>

  /** Get a Contract that exists on this Chain, or a non-existent one
    * which you can then create via Agent#instantiate
    *
    * FIXME: awkward inversion of control */
  getContract<T> (api: T, address: string, agent: any): T

  /** Credentials of the default agent for this network.
    * Picked up from environment variable, see the subclass
    * implementation for more info. */
  defaultAgent: Identity

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

  printStatusTables (): void
}

export interface ChainState extends ChainOptions {
  readonly stateRoot?:  string
  readonly identities?: string
  readonly uploads?:    string
  readonly instances?:  string
}

export interface ChainOptions {
  chainId?: string
  apiURL?:  URL
  node?:    ChainNode
  defaultAgent?: {
    name?:     string,
    address?:  string,
    mnemonic?: string
  }
}

export interface ChainConnectOptions extends ChainOptions {
  apiKey?: string
}

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

export interface Agent extends Identity {
  fees: Record<string, any>
  readonly name:    string
  readonly address: string
  readonly chain: Chain

  get nextBlock (): Promise<void>
  get block     (): Promise<any>
  get account   (): Promise<any>
  get balance   (): Promise<any>

  getBalance (denomination: string): Promise<any>

  send       (recipient:        any,
              amount: string|number,
              denom?:           any,
              memo?:            any,
              fee?:             any): Promise<any>

  sendMany   (txs: Array<any>,
              memo?:   string,
              denom?:  string,
              fee?:       any): Promise<any>

  upload      (path:   string): Promise<any>

  instantiate (instance:  any): Promise<any>

  query       (link:      any,
               method: string,
               args?:     any): Promise<any>

  execute     (link:      any,
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

export interface BuildUploader {
  build          (options: BuildOptions): Promise<Path>
  buildOrCached  (options: BuildOptions): Promise<Path>
  upload         (artifact: Artifact): Promise<Upload>
  uploadOrCached (artifact: Artifact): Promise<Upload>
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

export interface Ensemble {
  /* Build, upload, and initialize. */
  deploy (options: EnsembleDeploy): Promise<Instances>

  /* Compile the contracts from source using a Builder. */
  build (options: EnsembleBuild):  Promise<Artifacts>

  /* Upload the contracts to a Chain using a BuildUploader. */
  upload (options: EnsembleUpload): Promise<Uploads>

  /* Init instances of uploaded contracts using an Agent. */
  initialize (options: EnsembleInit):   Promise<Instances>

  /* Definitions of all user-available actions for this ensemble. */
  commands       (): Commands

  /* Definitions of commands that don't require a connection. */
  localCommands  (): Commands

  /* Definitions of commands that require a connection. */
  remoteCommands (): Commands
}

export type EnsembleContractInfo = { crate: string }

export type EnsembleOptions = {
  prefix?:    string
  chain?:     Chain
  agent?:     Agent
  builder?:   BuildUploader
  workspace?: Path
}

export type EnsembleDeploy = {
  task?:      Taskmaster
  chain?:     Chain
  agent?:     Agent
  builder?:   BuildUploader
  workspace?: Path
  initMsgs?:  Record<string, any>
  additionalBinds?: Array<string>
}

export type EnsembleBuild = {
  task?:      Taskmaster
  builder?:   BuildUploader
  workspace?: Path
  outputDir?: Path
  parallel?:  boolean
  additionalBinds?: Array<string>
}

export type EnsembleUpload = {
  task?:      Taskmaster
  agent?:     Agent
  chain?:     Chain
  builder?:   BuildUploader
  artifacts?: Artifacts
}

export type EnsembleInit = {
  task?:      Taskmaster
  initMsgs?:  Record<string, any>
  chain?:     Chain
  uploads?:   Uploads
  agent?:     Agent
}

export type Artifact  = any
export type Artifacts = Record<string, Artifact>
export type Upload    = any
export type Uploads   = Record<string, Upload>
export type Instance  = any
export type Instances = Record<string, Instance>

/* Taskmaster is a quick and dirty stopwatch/logging helper that can
 * generate a rough profile of one or more contract operations
 * in terms of time and gas. */
export type Taskmaster = Function & {
  /* Call when complete. */
  done:     Function
  /* Run several operations in parallel. */
  parallel: Function
}
