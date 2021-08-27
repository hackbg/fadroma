import type {
  Commands, Taskmaster,
  Chain, Agent, Contract, ContractConfig, Ensemble, EnsembleOptions,
  Artifacts, Uploads, Instances } from './types'

import {relative, timestamp} from './system'
import {taskmaster} from './command'
import {ScrtUploader} from './builder'

import {table} from 'table'
import colors from 'colors'
const {bold} = colors

const Errors = {
  NOTHING: "Please specify a chain, agent, or builder",
  AGENT:   "Can't use agent with different chain",
  BUILDER: "Can't use builder with different chain", }

const Info = {
  BUILD:  '👷 Compile contracts from working tree',
  DEPLOY: '🚀 Build, init, and deploy this component' }

export abstract class BaseEnsemble implements Ensemble {
  name:      string = this.constructor.name
  prefix:    string = `${timestamp()}`
  contracts: Record<string, ContractConfig>
  protected instances: Record<string, Contract>
  readonly  task:      Taskmaster = taskmaster()
  readonly  chain:     Chain
  readonly  agent?:    Agent
  readonly  additionalBinds?: Array<any>
  constructor ({ task, chain, agent, additionalBinds }: EnsembleOptions) {
    if (agent.chain.chainId !== chain.chainId) throw new Error(Errors.AGENT)
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
  async deploy (): Promise<Instances> {
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
  private buildOne = (name: string, contract: ContractConfig) =>
    this.task(`build ${this.name}_${name}`, () => contract.build())
  /* Upload the contracts to the chain, and write upload receipts in the corresponding directory.
   * If receipts are already present, return their contents instead of uploading. */
  async upload (): Promise<Uploads> {
    const uploads = {}
    for (const [name, contract] of Object.entries(this.contracts)) {
      await this.task(`upload ${name}`, async (report: Function) => {
        const {compressedSize, transactionHash} = await contract.upload()
        console.log(`⚖️  compressed size ${compressedSize} bytes`)
        report(transactionHash) }) }
    return uploads }
  /** Stub to be implemented by the subclass.
   *  In the future it might be interesting to see if we can add some basic dependency resolution.
   *  It just needs to be standardized on the Rust side (in fadroma-callback)? */
  async initialize (): Promise<Instances> {
    throw new Error('You need to implement the initialize() method.') } }

export class ScrtEnsemble extends BaseEnsemble {
  BuildUploader = ScrtUploader
  buildImage    = 'enigmampc/secret-contract-optimizer:latest' }
