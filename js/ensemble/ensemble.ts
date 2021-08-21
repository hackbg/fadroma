import {Network, Agent}                   from '@fadroma/agent'
import {BuildUploader}                    from '@fadroma/builder'
import {Docker, pulled}                   from '@fadroma/net'
import {resolve, relative, existsSync}    from '@fadroma/sys'
import {Commands, Taskmaster, taskmaster} from '@fadroma/cli'

import {table} from 'table'
import colors from 'colors'
const {bold} = colors

const required = (label: string) => { throw new Error(`required key: ${label}`) }

export type Path = string

export type EnsembleContractInfo = { crate: string }

export type EnsembleOptions =
  { network?:   Network
  , agent?:     Agent
  , builder?:   BuildUploader
  , workspace?: Path }

export type EnsembleDeployOptions =
  { task?:      Taskmaster
  , network?:   Network
  , agent?:     Agent
  , builder?:   BuildUploader
  , workspace?: Path
  , initMsgs?:  Record<string, any>
  , additionalBinds?: Array<string> }

export type EnsembleBuildOptions =
  { task?:      Taskmaster
  , builder?:   BuildUploader
  , workspace?: Path
  , outputDir?: Path
  , parallel?:  boolean
  , additionalBinds?: Array<string> }

export type EnsembleUploadOptions =
  { task?:      Taskmaster
  , agent?:     Agent
  , network?:   Network
  , builder?:   BuildUploader
  , artifacts?: Artifacts }

export type EnsembleInitOptions =
  { task?:      Taskmaster
  , initMsgs?:  Record<string, any>
  , network?:   Network
  , uploads?:   Uploads
  , agent?:     Agent }

export type Artifact  = any
export type Artifacts = Record<string, Artifact>
export type Upload    = any
export type Uploads   = Record<string, Upload>
export type Instance  = any
export type Instances = Record<string, Instance>

const timestamp = (d = new Date()) =>
  d.toISOString()
    .replace(/[-:\.Z]/g, '')
    .replace(/[T]/g, '_')
    .slice(0, -3)

export class Ensemble {

  static Errors = {
    NOTHING: "Please specify a network, agent, or builder",
    AGENT:   "Can't use agent with different network",
    BUILDER: "Can't use builder with different network", }

  static Info = {
    BUILD:  '👷 Compile contracts from working tree',
    DEPLOY: '🚀 Build, init, and deploy this component' }

  prefix     = `${timestamp()}`
  contracts: Record<string, EnsembleContractInfo>
  workspace: Path          | null
  network:   Network       | null
  agent:     Agent         | null
  builder:   BuildUploader | null
  docker     = new Docker({ socketPath: '/var/run/docker.sock' })
  buildImage = 'enigmampc/secret-contract-optimizer:latest'

  constructor (provided: EnsembleOptions = {}) {
    this.network   = provided.network   || null
    console.trace(this.network)
    this.agent     = provided.agent     || this.network?.defaultAgent || null
    this.builder   = provided.builder   || this.network?.getBuilder(this.agent) || null
    this.workspace = provided.workspace || null }

  /* Build, upload, and instantiate the contracts. */
  async deploy ({
    task      = taskmaster(),
    network   = this.network,
    agent     = this.agent,
    builder   = this.builder,
    initMsgs  = {},
    workspace = this.workspace,
    additionalBinds
  }: EnsembleDeployOptions = {}): Promise<Instances> {
    if (!network) throw new Error('need a Network to deploy to')
    return await task('build, upload, and initialize contracts', async () => {
      const artifacts = await this.build({ task, builder, workspace, additionalBinds })
      const uploads   = await this.upload({ task, network, builder, artifacts })
      const instances = await this.initialize({ task, network, uploads, agent, initMsgs })
      return instances }) }

  /* Compile the contracts for production. */
  async build ({
    task      = taskmaster(),
    builder   = this.builder   || new BuildUploader({ docker: this.docker }),
    workspace = this.workspace || required('workspace'),
    outputDir = resolve(workspace, 'artifacts'),
    parallel  = true,
    additionalBinds
  }: EnsembleBuildOptions = {}): Promise<Artifacts> {
    // pull build container
    await pulled(this.buildImage, this.docker)
    // build all contracts
    const { contracts, constructor: { name: ensembleName } } = this
    const artifacts = {}
    await (parallel ? buildInParallel() : buildInSeries())
    console.log(table(Object.entries(artifacts).map(
      ([name, path])=>([bold(name), relative(process.cwd(), path as string)]))))
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
        const buildOutput = resolve(outputDir, `${crate}@HEAD.wasm`)
        if (existsSync(buildOutput)) {
          const path = relative(process.cwd(), buildOutput)
          console.info(`ℹ️  ${bold(path)} exists, delete to rebuild.`)
          return buildOutput }
        else {
          return await builder.build({workspace, crate, outputDir, additionalBinds}) } }) } }

  /* Upload the contracts to the network, and write upload receipts in the corresponding directory.
   * If receipts are already present, return their contents instead of uploading. */
  async upload ({
    task    = taskmaster(),
    builder = this.builder,
    artifacts
  }: EnsembleUploadOptions): Promise<Uploads> {
    // if artifacts are not passed, build 'em
    artifacts = artifacts || await this.build()
    const uploads = {}
    for (const contract of Object.keys(this.contracts)) {
      await task(`upload ${contract}`, async (report: Function) => {
        const receipt = uploads[contract] = await builder.uploadCached(artifacts[contract])
        console.log(`⚖️  compressed size ${receipt.compressedSize} bytes`)
        report(receipt.transactionHash) }) }
    return uploads }

  /** Stub to be implemented by the subclass.
   *  In the future it might be interesting to see if we can add some basic dependency resolution.
   *  It just needs to be standardized on the Rust side (in scrt-callback)? */
  async initialize (_: InitOptions): Promise<Instances> {
    throw new Error('You need to implement the initialize() method.') }

  /** Commands to expose to the CLI. */
  commands (): Commands {
    return [ ...this.localCommands(), null, ...this.remoteCommands() ] }

  /** Commands that can be executed locally. */
  localCommands (): Commands {
    return [[ "build"
            , Ensemble.Info.BUILD
            , (ctx: any, sequential: boolean) => this.build({...ctx, parallel: !sequential})]] }

  /** Commands that require a connection to a network. */
  remoteCommands (): Commands {
    return [[ "deploy"
            , Ensemble.Info.DEPLOY
            , (ctx: any) => this.deploy(ctx).then(console.info) ]] } }
