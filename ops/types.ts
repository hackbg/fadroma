import type { Docker } from './network'

export type Path = string

export type CommandName = string
export type CommandInfo = string
export type Command  = [CommandName|Array<CommandName>, CommandInfo, Function, Commands?]
export type Commands = Array<Command|null>

export type Taskmaster = Function & {
  done:     Function
  parallel: Function
}

export interface Chain extends ChainState {
  get url        (): string
  connect        (): Promise<Connection>
  getAgent       (options?: JSAgentCreateArgs): Promise<Agent>
  getBuilder     (agent: Agent): BuildUploader
  getContract<T> (api: T, address: string, agent: any): T

  defaultAgent: Agent

  readonly wallets:   string
  readonly receipts:  string
  readonly instances: string
}

export interface ChainState extends ChainOptions {
  stateBase?: Path
  state?:     Path
  wallets?:   Path
  receipts?:  Path
  instances?: Path
}

export interface ChainOptions {
  chainId?: string
  apiURL?:  URL
  node?:    ChainNode
  defaultAgentName?:     string
  defaultAgentAddress?:  string
  defaultAgentMnemonic?: string
}

export interface ChainConnectOptions extends ChainOptions {
  apiKey?: string
}

export type Connection = {
  node:    ChainNode
  chain:   Chain
  agent:   Agent
  builder: BuildUploader
}

export interface ChainNode {
  chainId?: string
  apiURL?:  URL
  port:     number

  readonly ready: Promise<any>

  new       (args: ChainNodeOptions)
  load      (): Record<any, any>
  save      (): Promise<void>
  erase     (): Promise<void>
  respawn   (): Promise<void>
  spawn     (): Promise<void>
  suspend   (): Promise<void>
  terminate (): Promise<void>

  genesisAccount(name: string): any
}

export type ChainNodeOptions = {
  docker?:  Docker
  image?:   string
  chainId?: string
  genesisAccounts?: Array<string>
  state?:   string,
}

export interface Agent {
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
  typeof maybeAgent.execute === "function");

export interface JSAgentCreateArgs {
  name?:     string,
  address?:  string,
  mnemonic?: string,
  keyPair?:  any
  chain?:    Chain
}

export interface JSAgentCtorArgs {
  chain?:    Chain
  pen?:      any
  mnemonic?: any
  keyPair?:  any
  name?:     any
  fees?:     any
}

export interface BuildUploader {
  build        (options: BuildArgs): Promise<Path>
  uploadCached (artifact: Artifact): Promise<Upload>
}

export type BuilderOptions = {
  docker?: Docker
}

export type BuildArgs = {
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
  task?:       Function
  count?:      number
  budget?:     bigint

  chain?:      Chain|string
  agent?:      Agent

  recipients?: Record<any, {agent: Agent}>
  wallets?:    any
}

export interface Ensemble {
  deploy     (options: EnsembleDeploy): Promise<Instances>
  build      (options: EnsembleBuild):  Promise<Artifacts>
  upload     (options: EnsembleUpload): Promise<Uploads>
  initialize (options: EnsembleInit):   Promise<Instances>

  commands       (): Commands
  localCommands  (): Commands
  remoteCommands (): Commands
}

export type EnsembleContractInfo = { crate: string }

export type EnsembleOptions = {
  chain?:     Chain,
  agent?:     Agent,
  builder?:   BuildUploader,
  workspace?: Path
}

export type EnsembleDeploy = {
  task?:      Taskmaster,
  chain?:     Chain,
  agent?:     Agent,
  builder?:   BuildUploader,
  workspace?: Path,
  initMsgs?:  Record<string, any>,
  additionalBinds?: Array<string>
}

export type EnsembleBuild = {
  task?:      Taskmaster,
  builder?:   BuildUploader,
  workspace?: Path,
  outputDir?: Path,
  parallel?:  boolean,
  additionalBinds?: Array<string>
}

export type EnsembleUpload = {
  task?:      Taskmaster,
  agent?:     Agent,
  chain?:     Chain,
  builder?:   BuildUploader,
  artifacts?: Artifacts
}

export type EnsembleInit = {
  task?:      Taskmaster,
  initMsgs?:  Record<string, any>,
  chain?:     Chain,
  uploads?:   Uploads,
  agent?:     Agent
}

export type Artifact  = any
export type Artifacts = Record<string, Artifact>
export type Upload    = any
export type Uploads   = Record<string, Upload>
export type Instance  = any
export type Instances = Record<string, Instance>
