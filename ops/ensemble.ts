import type {
  Path, Commands,
  Chain, Agent,
  BuildUploader,
  Ensemble, EnsembleContractInfo, EnsembleOptions, EnsembleDeploy,
  EnsembleBuild, EnsembleUpload, EnsembleInit,
  Artifacts, Uploads, Instances } from './types'

import {Docker, pulled} from './network'
import {BinaryFile, Directory, relative} from './system'
import {taskmaster} from './command'
import {ScrtBuilder, ScrtUploader} from './builder'

import {table} from 'table'
import colors from 'colors'
const {bold} = colors

const required = (label: string) => { throw new Error(`required key: ${label}`) }

const timestamp = (d = new Date()) =>
  d.toISOString()
    .replace(/[-:\.Z]/g, '')
    .replace(/[T]/g, '_')
    .slice(0, -3)

export abstract class BaseEnsemble implements Ensemble {

  static Errors = {
    NOTHING: "Please specify a chain, agent, or builder",
    AGENT:   "Can't use agent with different chain",
    BUILDER: "Can't use builder with different chain", }

  static Info = {
    BUILD:  '👷 Compile contracts from working tree',
    DEPLOY: '🚀 Build, init, and deploy this component' }

  prefix:    string = `${timestamp()}`
  docker:    Docker = new Docker({ socketPath: '/var/run/docker.sock' })
  contracts: Record<string, EnsembleContractInfo>
  workspace: Path          | null
  chain:     Chain         | null
  agent:     Agent         | null

  BuildUploader: new () => BuildUploader
  builder:       BuildUploader | null
  buildImage:    string

  constructor (provided: EnsembleOptions = {}) {
    this.chain     = provided.chain     || null
    this.agent     = provided.agent     || null
    this.builder   = provided.builder   || null
    this.workspace = provided.workspace || null }

  async init () {
    if (this.chain) {
      await this.chain.init()
      this.agent   = this.agent   || await this.chain.getAgent()
      this.builder = this.builder || await this.chain.getBuilder(this.agent) }
    else {
      // FIXME move the uploader code goes into Chain to remove the dependency in Builder
      this.builder = new ScrtBuilder() as unknown as BuildUploader }
    return this }

  /* Build, upload, and instantiate the contracts. */
  async deploy ({
    task      = taskmaster(),
    chain     = this.chain,
    agent     = this.agent,
    builder   = this.builder,
    initMsgs  = {},
    workspace = this.workspace,
    additionalBinds
  }: EnsembleDeploy = {}): Promise<Instances> {
    await this.init()
    if (!chain) throw new Error('need a Chain to deploy to')
    return await task('build, upload, and initialize contracts', async () => {
      const artifacts = await this.build({ task, builder, workspace, additionalBinds })
      const uploads   = await this.upload({ task, chain, builder, artifacts })
      const instances = await this.initialize({ task, chain, uploads, agent, initMsgs })
      return instances }) }

  /* Compile the contracts for production. */
  async build ({
    task      = taskmaster(),
    workspace = this.workspace || required('workspace'),
    outputDir = new Directory(workspace, 'artifacts').path,
    parallel  = true,
    additionalBinds
  }: EnsembleBuild = {}): Promise<Artifacts> {
    await this.init()

    // pull build container
    await pulled(this.buildImage, this.docker)

    // build all contracts
    const { contracts
          , constructor: { name: ensembleName }
          , builder = new ScrtUploader({ docker: this.docker }) } = this

    const artifacts = {}
    await (parallel ? buildInParallel() : buildInSeries())

    console.log(table(Object.entries(artifacts).map(([name, path])=>
      ([bold(name), relative(process.cwd(), path as string)]))))

    return artifacts

    async function buildInParallel () {
      await task.parallel(`build ${ensembleName}`,
        ...Object.entries(contracts).map(async ([contractName, {crate}])=>
          artifacts[contractName] = await buildOne(ensembleName, contractName, crate))) }

    async function buildInSeries () {
      for (const [contractName, {crate}] of Object.entries(contracts)) {
        artifacts[contractName] = await buildOne(ensembleName, contractName, crate) } }

    function buildOne (ensembleName: string, contractName: string, crate: string) {
      return task(`build ${ensembleName}/${contractName}`, async () => {
        const buildOutput = new BinaryFile(outputDir, `${crate}@HEAD.wasm`)
        if (buildOutput.exists()) {
          console.info(`ℹ️  ${bold(relative(process.cwd(), buildOutput.path))} exists, delete to rebuild.`)
          return buildOutput.path }
        else {
          return await builder.build({workspace, crate, outputDir, additionalBinds}) } }) } }

  /* Upload the contracts to the chain, and write upload receipts in the corresponding directory.
   * If receipts are already present, return their contents instead of uploading. */
  async upload ({
    task = taskmaster(),
    artifacts
  }: EnsembleUpload): Promise<Uploads> {
    await this.init()
    // if artifacts are not passed, build 'em
    artifacts = artifacts || await this.build()
    const uploads = {}
    for (const contract of Object.keys(this.contracts)) {
      await task(`upload ${contract}`, async (report: Function) => {
        const receipt = uploads[contract] = await this.builder.uploadOrCached(artifacts[contract])
        console.log(`⚖️  compressed size ${receipt.compressedSize} bytes`)
        report(receipt.transactionHash) }) }
    return uploads }

  /** Stub to be implemented by the subclass.
   *  In the future it might be interesting to see if we can add some basic dependency resolution.
   *  It just needs to be standardized on the Rust side (in fadroma-callback)? */
  async initialize (_: EnsembleInit): Promise<Instances> {
    throw new Error('You need to implement the initialize() method.') }

  /** Commands to expose to the CLI. */
  commands (): Commands {
    return [ ...this.localCommands(), null, ...this.remoteCommands() ] }

  /** Commands that can be executed locally. */
  localCommands (): Commands {
    return [[ "build"
            , BaseEnsemble.Info.BUILD
            , (ctx: any, sequential: boolean) => this.build({...ctx, parallel: !sequential})]] }

  /** Commands that require a connection to a chain. */
  remoteCommands (): Commands {
    return [[ "deploy"
            , BaseEnsemble.Info.DEPLOY
            , (ctx: any) => this.deploy(ctx).then(console.info) ]] } }

export class ScrtEnsemble extends BaseEnsemble {
  BuildUploader = ScrtUploader
  buildImage = 'enigmampc/secret-contract-optimizer:latest' }
