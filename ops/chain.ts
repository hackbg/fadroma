import type {
  Chain, ChainNode, ChainState, ChainConnectOptions,
  Agent, Identity,
  BuildUploader,
  Ensemble, EnsembleOptions } from './types'
import { defaultStateBase } from './constants'
import { open, Directory, JSONDirectory } from './system'
import { ScrtNode } from './localnet'
import { ScrtUploader } from './builder'
import { ScrtJSAgent } from './agent-secretjs'
import { ScrtCLIAgent } from './agent-secretcli'
import { Console, bold } from './command'
const console = Console(import.meta.url)

export class Scrt implements Chain {

  chainId?: string
  apiURL?:  URL
  node?:   ChainNode

  defaultAgent: { name?: string, address?: string, mnemonic?: string }

  stateRoot:  Directory
  identities: JSONDirectory
  uploads:    JSONDirectory
  instances:  JSONDirectory

  /** Interface to a Secret Network REST API endpoint.
   *  Can store identities and results of contract uploads/inits.
   * @constructor
   * @param {Object} options           - the configuration options
   * @param {string} options.chainId   - the internal ID of the chain running at that endpoint
   * TODO document the remaining options */
  constructor (options: ChainState = {}) {
    const node = this.node = options.node || null

    // info needed to connect to the chain's REST API
    this.chainId = options.chainId || node?.chainId || 'enigma-pub-testnet-3'
    this.apiURL  = options.apiURL || node?.apiURL || new URL('http://localhost:1337/')
    // directories to store state.
    const stateRoot = options.stateRoot  || defaultStateBase
    this.stateRoot   = new Directory(stateRoot),
    this.identities  = new JSONDirectory(stateRoot, 'identities')
    this.uploads     = new JSONDirectory(stateRoot, 'uploads')
    this.instances   = new JSONDirectory(stateRoot, 'instances')
    // handle to localnet node if this is localnet
    // default agent credentials
    this.defaultAgent = options.defaultAgent }

  /**Instantiate Agent and Builder objects to talk to the API,
   * respawning the node container if this is a localnet. */
  async init (): Promise<Chain> {
    // default credentials will be used as-is unless using localnet
    let { mnemonic, address } = this.defaultAgent||{}

    // if this is a localnet handle, wait for the localnet to start
    const node = await Promise.resolve(this.node); if (node) {
      this.node = node;

      // respawn that container
      console.info(`Running on localnet ${bold(this.chainId)} @ ${bold(this.stateRoot.path)}`)
      await node.respawn()
      await node.ready

      // set the correct port to connect to
      this.apiURL.port = String(node.port)
      console.info(`🟢 localnet ready @ port ${bold(this.apiURL.port)}`)

      // get the default account for the node
      const adminAccount = this.node.genesisAccount('ADMIN')
      mnemonic = adminAccount.mnemonic
      address  = adminAccount.address }

    const { protocol, hostname, port } = this.apiURL
    console.log(`⏳ connecting to ${this.chainId} via ${protocol} on ${hostname}:${port}`)
    this.defaultAgent = await this.getAgent({ name: "ADMIN", mnemonic, address })
    console.info(`🟢 connected, operating as ${address}`)
    return this as Chain }

  /** Create an instance that runs a node in a local Docker container
   *  and talks to it via SecretJS */
  static localnet (options: ChainConnectOptions = {}): Scrt {
    if (!options.node) options.node = new ScrtNode(options)
    options.chainId = options.chainId || 'enigma-pub-testnet-3'
    options.apiURL  = options.apiURL  || new URL('http://localhost:1337')
    // no default agent name/address/mnemonic:
    // connect() gets them from genesis accounts
    return new Scrt(options) }

  /** Create an instance that talks to to holodeck-2
   * (Secret Network testnet) via SecretJS */
  static testnet ({
    chainId = 'holodeck-2',
    apiKey  = '5043dd0099ce34f9e6a0d7d6aa1fa6a8',
    apiURL  = new URL(`https://secret-holodeck-2--lcd--full.datahub.figment.io:443/apikey/${apiKey}/`),
    defaultAgent = {
      name:     process.env.SECRET_NETWORK_TESTNET_NAME,
      address:  process.env.SECRET_NETWORK_TESTNET_ADDRESS  || 'secret1vdf2hz5f2ygy0z7mesntmje8em5u7vxknyeygy',
      mnemonic: process.env.SECRET_NETWORK_TESTNET_MNEMONIC || 'genius supply lecture echo follow that silly meadow used gym nerve together' }
  }: ChainConnectOptions = {}): Scrt {
    return new Scrt({ chainId, apiURL, defaultAgent }) }

  /** Create an instance that talks to to the Secret Network
   *  mainnet via SecretJS */
  static mainnet ({
    chainId = 'secret-2',
    apiKey  = '5043dd0099ce34f9e6a0d7d6aa1fa6a8',
    apiURL  = new URL(`https://secret-2--lcd--full.datahub.figment.io:443/apikey/${apiKey}/`),
    defaultAgent = {
      name:     process.env.SECRET_NETWORK_MAINNET_NAME,
      address:  process.env.SECRET_NETWORK_MAINNET_ADDRESS,
      mnemonic: process.env.SECRET_NETWORK_MAINNET_MNEMONIC }
  }: ChainConnectOptions = {}): Scrt {
    return new Scrt({ chainId, apiURL, defaultAgent }) }

  /**The API URL that this instance talks to.
   * @type {string} */
  get url () {
    return this.apiURL.toString() }

  /** create agent operating on the current instance's endpoint*/
  async getAgent (options: Identity = this.defaultAgent): Promise<Agent> {
    if (options.mnemonic || options.keyPair) {
      console.info(`Using a SecretJS-based agent.`)
      return await ScrtJSAgent.create({ ...options, chain: this as Chain }) }
    else {
      const name = options.name || this.defaultAgent?.name
      if (name) {
        console.info(`Using a secretcli-based agent.`)
        return new ScrtCLIAgent({ chain: this, name }) as Agent }
      else {
        throw new Error(
          'need a name to create a secretcli-backed agent, ' +
          'or a mnemonic or keypair to create a SecretJS-backed one.')}}}

  /** create builder operating on the current instance's endpoint */
  async getBuilder (agent?: Agent): Promise<BuildUploader> {
    agent = agent || await this.getAgent()
    return new ScrtUploader({chain: this, agent}) }

  /** create contract instance from interface class and address */
  getContract (ContractAPI: any, contractAddress: string, agent = this.defaultAgent) {
    return new ContractAPI({
      initTx: { contractAddress }, // TODO restore full initTx if present in artifacts
      agent }) } }


export function onChain (E: new (args: EnsembleOptions) => Ensemble) {
  return [
    ["mainnet",  "Run on mainnet",
      on.mainnet,  new E({chain: Scrt.mainnet()  as Chain}).remoteCommands()],
    ["testnet",  "Run on testnet",
      on.testnet,  new E({chain: Scrt.testnet()  as Chain}).remoteCommands()],
    ["localnet", "Run on localnet",
      on.localnet, new E({chain: Scrt.localnet() as Chain}).remoteCommands()] ] }

export const on = {
  localnet (context: any = {}) {
    console.info(`Running on ${bold('localnet')}:`)
    context.chain = Scrt.localnet() },
  testnet (context: any = {}) {
    console.info(`Running on ${bold('testnet')}:`)
    context.chain = Scrt.testnet() },
  mainnet (context: any = {}) {
    console.info(`Running on ${bold('mainnet')}:`)
    context.chain = Scrt.mainnet() } }

export function resetLocalnet () {
  return new ScrtNode().terminate() }

export function openFaucet () {
  const url = `https://faucet.secrettestnet.io/`
  console.debug(`Opening ${url}...`)
  open(url) }
