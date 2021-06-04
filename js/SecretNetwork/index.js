import { defaultDataDir, makeStateDir, resolve, dirname, fileURLToPath, cwd, mkdir } from '../sys.js'

import SecretNetworkNode from './Node.js'
import SecretNetworkAgent from './Agent.js'
import SecretNetworkBuilder from './Builder.js'
import SecretNetworkContract from './Contract.js'
import SecretNetworkContractEnsemble from './Ensemble.js'

import colors from 'colors/safe.js'
const {bold} = colors

const __dirname = dirname(fileURLToPath(import.meta.url))

const {warn, debug, info} = console

export const defaultStateBase = resolve(process.cwd(), 'artifacts')

const gas = function formatGas (x) {
  return {amount:[{amount:String(x),denom:'uscrt'}], gas: String(x)}
}

/** @class
 */
export default class SecretNetwork {
  static Node     = SecretNetworkNode
  static Agent    = SecretNetworkAgent
  static Builder  = SecretNetworkBuilder
  static Contract = SecretNetworkContract
  static Ensemble = SecretNetworkContractEnsemble

  static Gas = Object.assign(gas, { defaultFees: {
    upload: gas(2000000),
    init:   gas(1000000),
    exec:   gas(1000000),
    send:   gas( 500000),
  } })

  /**Interface to a REST API endpoint. Can store wallets and results of contract uploads/inits.
   * @constructor
   * @param {Object} options - the configuration options
   * @param {string} options.chainId - the internal ID of the chain running at that endpoint
   * @param {string} options.protocol - the protocol to use for the connection (`http` or `https`)
   * @param {string} options.host - the hostname to connect to
   * @param {string} options.port - the port to connect to (default `1337`)
   * @param {string} options.path - API URL path prefix. Used to provide Figment API key.
   * @param {string} options.stateBase - default location for state directories.
   * @param {string} options.state - path to directory to store state; created at `stateBase/chainId` by default
   * @param {string} options.wallets - path to directory holding wallet keys; created under `state` by default
   * @param {string} options.receipts - path to directory holding upload results; created under `state` by deault
   * @param {string} options.instances - path to directory holding init results (pointing to contract instances)
   */
  constructor ({
    chainId   = 'enigma-pub-testnet-3',
    protocol  = 'http', host = 'localhost', port = 1337, path = '',
    stateBase = defaultStateBase,
    state     = makeStateDir(stateBase, chainId),
    wallets   = mkdir(state, 'wallets'),
    receipts  = mkdir(state, 'uploads'),
    instances = mkdir(state, 'instances'),
  }) {
    Object.assign(this, {
      chainId,
      state, receipts, wallets, instances,
      protocol, host, port, path
    })
  }

  /**The API URL that this instance talks to.
   * @type {string} */
  get url () { return `${this.protocol}://${this.host}:${this.port}${this.path||''}` }

  /** create agent operating on the current instance's endpoint*/
  getAgent = (name, options={}) =>
    this.constructor.Agent.create({ ...options, network: this, name })

  /** create builder operating on the current instance's endpoint */
  getBuilder = agent =>
    new this.constructor.Builder({network: this, agent})

  /** create contract instance from interface class and address */
  getContract (Contract, contractAddress, agent = this.agent) {
    return new Contract({ contractAddress, agent })
  }

  /**Run a node in a docker container and return a connection to it. 
   * @return {Connection} - connection with interface to container
   */
  static async localnet ({
    chainId   = 'enigma-pub-testnet-3',
    stateBase = defaultStateBase,
    state     = makeStateDir(stateBase, chainId)
  }={}) {
    debug(`⏳ preparing localnet ${bold(chainId)} @ ${bold(state)}`)
    const node = new this.Node({chainId, state})
    await node.respawn()
    await node.ready
    debug(`🟢 localnet ready @ ${bold(state)}`)
    const { protocol, host, port } = node
    const agent = await node.genesisAccount('ADMIN')
    const options = { chainId, state, protocol, host, port, agent }
    return { node, ...await this.connect(options) }
  }

  /**Return a connection to the Holodeck-2 Secret Network Testnet
   * @return {Connection} - connection with interface to container
   */
  static async testnet ({
    // chain info:
    chainId   = 'holodeck-2',
    stateBase = defaultStateBase,
    state     = makeStateDir(stateBase, chainId),
    // connection info:
    protocol = 'https',
    host     = 'secret-holodeck-2--lcd--full.datahub.figment.io',
    path     = '/apikey/5043dd0099ce34f9e6a0d7d6aa1fa6a8/',
    port     = 443,
    // admin account info:
    // can't get balance from genesis accounts - needs a real testnet wallet
    // load it from https://faucet.secrettestnet.io/ (TODO automate this)
    agent = {
      address:  'secret1vdf2hz5f2ygy0z7mesntmje8em5u7vxknyeygy',
      mnemonic: 'genius supply lecture echo follow that silly meadow used gym nerve together'
    }
  }={}) {
    const options = { chainId, state, protocol, host, port, path, agent }
    return await this.connect(options)
  }

  /**Return a connection to the Secret Network Mainnet
   * @return {Connection} - connection with interface to container
   */
  static async mainnet ({
    // chain info:
    chainId   = 'secret-2',
    stateBase = defaultStateBase,
    state     = makeStateDir(stateBase, chainId),
    // connection info:
    protocol = 'https',
    host     = 'secret-2--lcd--full.datahub.figment.io',
    path     = '/apikey/5043dd0099ce34f9e6a0d7d6aa1fa6a8/',
    port     = 443,
    // admin account info:
    agent = {
      address:  process.env.SECRET_NETWORK_MAINNET_ADDRESS,
      mnemonic: process.env.SECRET_NETWORK_MAINNET_MNEMONIC
    }
  }={}) {
    const options = { chainId, state, protocol, host, port, path, agent }
    return await this.connect(options)
  }

  /**Connect to any Secret Network instance by providing connection info.
   * @return {Connection} - connection with interface to container
   */
  static async connect ({
    state,
    chainId, protocol, host, port, path='',
    agent: { mnemonic, address }
  }) {
    info(`⏳ connecting to ${bold(chainId)} via ${bold(protocol)} on ${bold(host)}:${bold(port)}`)
    const network = new this({chainId, state, protocol, host, port, path})
    const agent = await network.getAgent("ADMIN", { mnemonic, address })
    info(`🟢 connected, operating as ${bold(address)}`)
    return { network, agent, builder: network.getBuilder(agent) }
  }

}

/**@typedef {Object} Connection
 * @property {SecretNetworkNode} [node] - (if localnet) interface to docker container
 * @property {SecretNetwork} network - interface to the node's REST API endpoint.
 * @property {SecretNetworkAgent} agent - a default agent to query and transact on that network.
 * @property {SecretNetworkBuilder} builder - can upload contracts to that network as that agent.
 */
