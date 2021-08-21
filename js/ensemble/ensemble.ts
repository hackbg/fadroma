import {Network, Scrt, Agent}             from '@fadroma/agent'
import {BuildUploader}                    from '@fadroma/builder'
import {Docker, pulled}                   from '@fadroma/net'
import {resolve, relative, existsSync}    from '@fadroma/sys'
import {Commands, Taskmaster, taskmaster} from '@fadroma/cli'

import {table} from 'table'
import colors from 'colors'
const {bold} = colors

const required = (label: string) => { throw new Error(`required key: ${label}`) }

export type Path = string

export type ContractInfo = { crate: string }

export type CtorArgs<N extends Network> =
  { Network?:   NetworkType<N>
  , network?:   Network|string
  , agent?:     Agent
  , builder?:   BuildUploader
  , workspace?: Path }

export type NetworkType<N> = (new () => N) & { hydrate: any }

export type BuildArgs =
  { task?:      Taskmaster
  , builder?:   BuildUploader
  , workspace?: Path
  , outputDir?: Path
  , parallel?:  boolean }
export type Artifact  = any
export type Artifacts = Record<string, Artifact>

export type UploadArgs =
  { task?:      Taskmaster
  , agent?:     Agent
  , network?:   Network
  , builder?:   BuildUploader
  , artifacts?: Artifacts }
export type Upload  = any
export type Uploads = Record<string, Upload>

export type InitArgs =
  { task?:      Taskmaster
  , initMsgs?:  Record<string, any>
  , network?:   Network
  , uploads?:   Uploads
  , agent?:     Agent }

export type Instance  = any
export type Instances = Record<string, Instance>

export type DeployArgs =
  { network?:   Network
  , task?:      Taskmaster
  , initMsgs?:  Record<string, any>
  , workspace:  Path
  , additionalBinds: Array<string> }

const timestamp = (d = new Date()) =>
  d.toISOString()
    .replace(/[-:\.Z]/g, '')
    .replace(/[T]/g, '_')
    .slice(0, -3)

export class Ensemble<N extends Network> {

  static Errors = {
    NOTHING: "Please specify a network, agent, or builder",
    AGENT:   "Can't use agent with different network",
    BUILDER: "Can't use builder with different network", }

  static Info = {
    BUILD:  '👷 Compile contracts from working tree',
    DEPLOY: '🚀 Build, init, and deploy this component' }

  prefix     = `${timestamp()}`
  contracts: Record<string, ContractInfo>
  workspace: Path           | null
  Network:   NetworkType<N> | null
  network:   N              | null
  agent:     Agent          | null
  builder:   BuildUploader  | null
  docker     = new Docker({ socketPath: '/var/run/docker.sock' })
  buildImage = 'enigmampc/secret-contract-optimizer:latest'

  /** Composition goes `builder { agent { network } }`.
    * `agent` and `builder` can be different if you want the contract
    * to be uploaded from one address and instantiated from another,
    * but obviously they both need to reference the same network.
    *
    * It is also possible to instantiate an Ensemble without network,
    * agent, or builder; it would only be able to run local commands. */
  constructor (provided: CtorArgs<N> = {}) {
    this.Network = provided.Network   || null
    this.network = (typeof provided.network === 'string')
      ? provided.Network[provided.network].hydrate()
      : provided.network
    this.agent     = provided.agent     || null
    this.builder   = provided.builder   || null
    this.workspace = provided.workspace || null }

  /* Build, upload, and instantiate the contracts. */
  async deploy (options: DeployArgs): Promise<Instances> {
    let network = this.Network.hydrate(options.network || this.network)
    if (!(network instanceof this.Network)) {
      throw new Error('need a Network to deploy to') }
    const { agent, builder } = await network.connect()
    const { task = taskmaster(), initMsgs = {} } = options
    return await task('build, upload, and initialize contracts', async () => {
      const workspace = options.workspace || this.workspace
      const artifacts = await this.build({ ...options, task, builder, workspace })
      const uploads   = await this.upload({ task, network, builder, artifacts })
      const instances = await this.initialize({ task, network, uploads, agent, initMsgs })
      return instances }) }

  /* Compile the contracts for production. */
  async build (options: BuildArgs = {}): Promise<Artifacts> {
    const { task      = taskmaster()
          , builder   = this.builder   || new BuildUploader({ docker: this.docker })
          , workspace = this.workspace || required('workspace')
          , outputDir = resolve(workspace, 'artifacts')
          , parallel  = true } = options || {}
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
          return await builder.build({...options, outputDir, workspace, crate}) } }) } }

  /* Upload the contracts to the network, and write upload receipts in the corresponding directory.
   * If receipts are already present, return their contents instead of uploading. */
  async upload ({
    task    = taskmaster(),
    network = this.network,
    builder = this.builder,
    artifacts
  }: UploadArgs): Promise<Uploads> {
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
  async initialize (_: InitArgs): Promise<Instances> {
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
