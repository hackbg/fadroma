import type {
  Chain, ChainOptions, ChainConnectOptions,
  Agent, JSAgentCreateArgs,
  BuildUploader } from './types'
import { defaultStateBase } from './constants'
import { mkdir, makeStateDir } from './system'
import { ScrtNode } from './localnet'
import { JSAgent } from './agent-secretjs'
import { CLIAgent } from './agent-secretcli'
import { Console, bold } from './command'
const {debug, info} = Console(import.meta.url)

export class Scrt implements Chain {

  /** Used to allow the network to be specified as a string by
   *  turning a well-known network name into a Scrt instance. */
  static hydrate (network: any): Scrt {
    if (typeof network === 'string') {
      const networks = ['localnet','testnet','mainnet']
      if (networks.indexOf(network) < 0) {
        throw new Error(`Unknown network type: "${network}", valid ones are: ${networks.join(' ')}`) }
      network = Scrt[network]() }
    return network }

  /** Create an instance that runs a node in a local Docker container
   *  and talks to it via SecretJS */
  static localnet (options: ChainConnectOptions = {}): Scrt {
    options.chainId = options.chainId || 'enigma-pub-testnet-3';
    options.apiURL  = options.apiURL  || 'http://localhost:1337';
    const node = options.node || new ScrtNode(options);
    options.node = node;
    // no default agent name/address/mnemonic:
    // connect() gets them from genesis accounts
    return new Scrt(options) }

  /** Create an instance that talks to to holodeck-2
   * (Secret Chain testnet) via SecretJS */
  static testnet ({
    chainId = 'holodeck-2',
    apiKey  = '5043dd0099ce34f9e6a0d7d6aa1fa6a8',
    apiURL  = `https://secret-holodeck-2--lcd--full.datahub.figment.io:443/apikey/${apiKey}/`,
    defaultAgentName     = process.env.SECRET_NETWORK_TESTNET_NAME,
    defaultAgentAddress  = process.env.SECRET_NETWORK_TESTNET_ADDRESS  || 'secret1vdf2hz5f2ygy0z7mesntmje8em5u7vxknyeygy',
    defaultAgentMnemonic = process.env.SECRET_NETWORK_TESTNET_MNEMONIC || 'genius supply lecture echo follow that silly meadow used gym nerve together'
  }: ChainConnectOptions = {}): Scrt {
    return new Scrt({ chainId, apiURL, defaultAgentName, defaultAgentAddress, defaultAgentMnemonic }) }

  /** Create an instance that talks to to the Secret Chain
   *  mainnet via SecretJS */
  static mainnet ({
    chainId = 'secret-2',
    apiKey  = '5043dd0099ce34f9e6a0d7d6aa1fa6a8',
    apiURL  = `https://secret-2--lcd--full.datahub.figment.io:443/apikey/${apiKey}/`,
    defaultAgentName     = process.env.SECRET_NETWORK_MAINNET_NAME,
    defaultAgentAddress  = process.env.SECRET_NETWORK_MAINNET_ADDRESS,
    defaultAgentMnemonic = process.env.SECRET_NETWORK_MAINNET_MNEMONIC
  }: ChainConnectOptions = {}): Scrt {
    return new Scrt({ chainId, apiURL, defaultAgentName, defaultAgentAddress, defaultAgentMnemonic }) }

  chainId: string
  apiURL:  URL
  node:    Node

  defaultAgentName:     string
  defaultAgentAddress:  string
  defaultAgentMnemonic: string
  defaultAgent:         Agent

  stateBase: string
  state:     string
  wallets:   string
  receipts:  string
  instances: string

  /** Interface to a Secret Chain REST API endpoint.
   *  Can store wallets and results of contract uploads/inits.
   * @constructor
   * @param {Object} options           - the configuration options
   * @param {string} options.chainId   - the internal ID of the chain running at that endpoint
   * TODO document the remaining options */
  constructor (options: ChainOptions = {}) {
    const node = this.node = options.node || null

    // info needed to connect to the chain's REST API
    this.chainId = options.chainId || node?.chainId || 'enigma-pub-testnet-3'
    this.apiURL  = new URL(options.apiURL || node?.apiURL || 'http://localhost:1337/')
    // directories to store state.
    this.stateBase = options.stateBase || defaultStateBase,
    this.state     = options.state     || makeStateDir(this.stateBase, this.chainId)
    this.wallets   = options.wallets   || mkdir(this.state, 'wallets')
    this.receipts  = options.receipts  || mkdir(this.state, 'uploads')
    this.instances = options.instances || mkdir(this.state, 'instances')
    // handle to localnet node if this is localnet
    // default agent credentials
    this.defaultAgentName     = options.defaultAgentName
    this.defaultAgentAddress  = options.defaultAgentAddress
    this.defaultAgentMnemonic = options.defaultAgentMnemonic }

  /**Instantiate Agent and Builder objects to talk to the API,
   * respawning the node container if this is a localnet. */
  async connect () {
    // default credentials will be used as-is unless using localnet
    let { defaultAgentMnemonic: mnemonic
        , defaultAgentAddress:  address } = this

    // if this is a localnet handle, wait for the localnet to start
    const node = await Promise.resolve(this.node);
    if (node) {
      this.node = node;

      // respawn that container
      debug(`⏳ preparing localnet ${bold(this.chainId)} @ ${bold(this.state)}`)
      await node.respawn()
      await node.ready

      // set the correct port to connect to
      this.apiURL.port = node.port
      info(`🟢 localnet ready @ port ${bold(this.apiURL.port)}`)

      // get the default account for the node
      const adminAccount = await this.node.genesisAccount('ADMIN')
      mnemonic = adminAccount.mnemonic
      address  = adminAccount.address }

    const { protocol, hostname, port } = this.apiURL
    info(`⏳ connecting to ${this.chainId} via ${protocol} on ${hostname}:${port}`)
    const agent: Agent = this.defaultAgent = await this.getAgent({ name: "ADMIN", mnemonic, address })
    info(`🟢 connected, operating as ${address}`)
    return { node, network: this, agent, builder: this.getBuilder(agent) } }

  /**The API URL that this instance talks to.
   * @type {string} */
  get url () {
    return this.apiURL.toString() }

  /** create agent operating on the current instance's endpoint*/
  async getAgent (options: JSAgentCreateArgs<Scrt> = {}) {
    if (options.mnemonic || options.keyPair) {
      info(`Using a SecretJS-based agent.`)
      const network = this
      return await JSAgent.create(Scrt, { ...options, network }) }
    else if (options.name) {
      info(`Using a secretcli-based agent.`)
      return new CLIAgent({ name: options.name }) }
    else {
      throw new Error(
        'need a name to create a secretcli-backed agent, ' +
        'or a mnemonic or keypair to create a SecretJS-backed one.')}}

  /** create builder operating on the current instance's endpoint */
  getBuilder (agent: Agent): BuildUploader {
    return new BuildUploader({network: this, agent}) }

  /** create contract instance from interface class and address */
  getContract (ContractAPI: any, contractAddress: string, agent = this.defaultAgent) {
    return new ContractAPI({
      initTx: { contractAddress }, // TODO restore full initTx if present in artifacts
      agent }) } }
