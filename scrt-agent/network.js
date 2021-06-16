import {
  mkdir, makeStateDir, resolve, dirname, fileURLToPath, cwd, bold, Console
} from '@fadroma/utilities'
import { SecretNetworkNode, SecretNetworkBuilder } from '@fadroma/scrt-ops'
import SecretNetworkAgent from './agent.js'
import SecretNetworkContract from './contract.js'
import { gas, defaultFees } from './gas.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const {warn, debug, info} = Console(import.meta.url)

export const defaultStateBase = resolve(cwd(), 'artifacts')

/** @class
 */
export default class SecretNetwork {
  // TODO get rid of these shortcuts and/or use dynamic imports of ops classes
  static Agent    = SecretNetworkAgent
  static Builder  = SecretNetworkBuilder
  static Contract = SecretNetworkContract
  static Node     = SecretNetworkNode

  /**Run a node in a docker container and return a connection to it. 
   * @return {Connection} - connection with interface to container
   */
  static localnet ({
    chainId   = 'enigma-pub-testnet-3',
    stateBase = defaultStateBase,
    state     = makeStateDir(stateBase, chainId)
  }={}) {
    const node = new SecretNetworkNode({chainId, state})
    const { protocol, host, port } = node
    return new this({ chainId, state, protocol, host, port, node })
  }

  /**Return a connection to the Holodeck-2 Secret Network Testnet
   * @return {Connection} - connection with interface to container
   */
  static testnet ({
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
      address:  process.env.SECRET_NETWORK_TESTNET_ADDRESS  || 'secret1vdf2hz5f2ygy0z7mesntmje8em5u7vxknyeygy',
      mnemonic: process.env.SECRET_NETWORK_TESTNET_MNEMONIC || 'genius supply lecture echo follow that silly meadow used gym nerve together'
    }
  }={}) {
    return new this({ chainId, state, protocol, host, port, path, agent })
  }

  /**Return a connection to the Secret Network Mainnet
   * @return {Connection} - connection with interface to container
   */
  static mainnet ({
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
    return new this({ chainId, state, protocol, host, port, path, agent })
  }

  /**Interface to a Secret Network REST API endpoint.
   * Can store wallets and results of contract uploads/inits.
   *
   * @constructor
   * @param {Object} options           - the configuration options
   * @param {string} options.chainId   - the internal ID of the chain running at that endpoint
   * @param {string} options.protocol  - the protocol to use for the connection (`http` or `https`)
   * @param {string} options.host      - the hostname to connect to
   * @param {string} options.port      - the port to connect to (default `1337`)
   * @param {string} options.path      - API URL path prefix. Used to provide Figment API key.
   * @param {string} options.stateBase - default location for state directories.
   * @param {string} options.state     - path to directory to store state; created at `stateBase/chainId` by default
   * @param {string} options.wallets   - path to directory holding wallet keys; created under `state` by default
   * @param {string} options.receipts  - path to directory holding upload results; created under `state` by deault
   * @param {string} options.instances - path to directory holding init results (pointing to contract instances)
   * @param {string} options.node      - promise to localnet node (if applicable) */
  constructor ({
    chainId   = 'enigma-pub-testnet-3',
    protocol  = 'http',
    host      = 'localhost',
    port      = 1337,
    path      = '',
    stateBase = defaultStateBase,
    state     = makeStateDir(stateBase, chainId),
    wallets   = mkdir(state, 'wallets'),
    receipts  = mkdir(state, 'uploads'),
    instances = mkdir(state, 'instances'),
    node      = Promise.resolve(false)
  }) {
    Object.assign(this, {
      chainId, state, receipts, wallets, instances, protocol, host, port, path, node
    })
  }

  /**Establish a connection to the Secret Network HTTP API.*/
  async connect () {
    const { chainId, protocol, host, port, state } = this
    let { mnemonic, address } = this
    info(`⏳ connecting to ${chainId} via ${protocol} on ${host}:${port}`)
    // if this is a localnet handle, wait for the localnet to start
    if (this.node) {
      debug(`⏳ preparing localnet ${bold(chainId)} @ ${bold(state)}`)
      await this.node.respawn()
      await this.node.ready
      info(`🟢 localnet ready`)
      debug(`🟢 localnet ready @ ${bold(state)}`)
      ;({mnemonic, address} = await this.node.genesisAccount('ADMIN'))
    }
    const agent = this.agent = await this.getAgent("ADMIN", { mnemonic, address })
    info(`🟢 connected, operating as ${address}`)
    const builder = this.getBuilder(agent)
    return { network: this, agent, builder }
  }

  /**The API URL that this instance talks to.
   * @type {string} */
  get url () {
    return `${this.protocol}://${this.host}:${this.port}${this.path||''}`
  }

  /** create agent operating on the current instance's endpoint*/
  getAgent (name, options={}) {
    return SecretNetworkAgent.create({ ...options, network: this, name })
  }

  /** create builder operating on the current instance's endpoint */
  getBuilder (agent) {
    return new SecretNetworkBuilder({network: this, agent})
  }

  /** create contract instance from interface class and address */
  getContract (ContractAPI, contractAddress, agent = this.agent) {
    return new ContractAPI({ contractAddress, agent })
  }

}
