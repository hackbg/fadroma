import {Commands, Taskmaster, table, bold, relative, timestamp, taskmaster} from '@fadroma/tools'

import {Chain} from './ChainAPI'
import {Agent} from './Agent'
import {Contract} from './Contract'

export interface Ensemble {
  /* Build, upload, and initialize. */
  deploy (): Promise<InstancesTable>

  /* Compile this ensemble's contracts from source. */
  build (parallel: boolean): Promise<Artifacts>

  /* Upload this ensemble's contracts to the chain. */
  upload (): Promise<Uploads>

  /* Init instances of uploaded contracts using an Agent. */
  initialize (): Promise<InstancesTable>

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

export type InstancesTable = string[][]

const Errors = {
  NOTHING: "Please specify a chain, agent, or builder",
  AGENT:   "Can't use agent with different chain",
  BUILDER: "Can't use builder with different chain", }

const Info = {
  BUILD:  '👷 Compile contracts from working tree',
  DEPLOY: '🚀 Build, init, and deploy this component' }

export abstract class BaseEnsemble implements Ensemble {

  name: string = this.constructor.name

  prefix: string = `${timestamp()}`

  contracts: Record<string, Contract>

  agent: Agent

  readonly chain: Chain

  readonly task: Taskmaster = taskmaster()

  readonly additionalBinds?: Array<any>

  protected instances: Record<string, Contract>

  constructor (options: EnsembleOptions = {}) {
    const { task, chain, agent, additionalBinds } = options
    if (agent && chain && agent.chain.chainId !== chain.chainId) throw new Error(Errors.AGENT)
    this.task  = task || taskmaster()
    this.chain = chain
    this.agent = agent
    this.additionalBinds = additionalBinds }

  /** Commands to expose to the CLI. */
  commands (): Commands {
    return [...this.localCommands(), null, ...this.remoteCommands()]}

  /** Commands that can be executed locally. */
  localCommands (): Commands {
    return [["build", Info.BUILD, (_: any, seq: boolean)=>this.build(!seq)]]}

  /** Commands that require a connection to a chain. */
  remoteCommands (): Commands {
    return [["deploy", Info.DEPLOY, (_: any)=>this.deploy().then(console.info)]]}

  /* Build, upload, and instantiate the contracts. */
  async deploy (): Promise<InstancesTable> {
    return this.task('build, upload, and initialize contracts', async () => {
      await this.build()
      await this.upload()
      return await this.initialize() }) }

  /* Compile the contracts for production. */
  async build (parallel = false): Promise<Artifacts> {
    const artifacts = {}
    await (parallel ? this.buildParallel(artifacts) : this.buildSeries(artifacts))
    const row = ([name, path])=>[bold(name), relative(process.cwd(), path as string)]
    console.log(table(Object.entries(artifacts).map(row)))
    return artifacts }

  private buildParallel = (artifacts = {}) =>
    this.task.parallel(`build ${bold(this.name)}`,
      ...Object.entries(this.contracts).map(async ([name, contract])=>
        artifacts[name] = await this.buildOne(name, contract)))

  private buildSeries = async (artifacts = {}) => {
    for (const [name, contract] of Object.entries(this.contracts)) {
      artifacts[name] = await this.buildOne(name, contract) } }

  private buildOne = (name: string, contract: Contract) =>
    this.task(`build ${this.name}_${name}`, () => contract.build())

  /** Upload the contracts to the chain, and write upload receipts in the corresponding directory.
    * If receipts are already present, return their contents instead of uploading. */
  async upload (): Promise<Uploads> {
    await this.chain.init()
    const uploads = {}
    for (const [name, contract] of Object.entries(this.contracts)) {
      await this.task(`upload ${name}`, async (report: Function) => {
        const {compressedSize, transactionHash} = await contract.upload(this.agent||this.chain)
        console.log(`⚖️  compressed size ${compressedSize} bytes`)
        report(transactionHash) }) }
    return uploads }

  /** Instantiate the contracts from this ensemble.
    * As each deployment is different, the actual instantiations
    * must be implemented in a subclass downstream.
    * In the future, it might be interesting to see if we can
    * add some basic dependency resolution. It just needs to be
    * standardized on the Rust side (in fadroma-callback)?
    * @returns Table of resulting contract instances. */
  async initialize (): Promise<InstancesTable> {
    await this.chain.init()
    this.agent = await this.chain.getAgent()
    Object.values(this.contracts).forEach(contract=>contract.setPrefix(this.prefix))
    return [] } }
