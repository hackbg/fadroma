import assert from 'assert'
import Docker from 'dockerode'
import { Bip39 } from '@cosmjs/crypto'

import { loadJSON, loadSchemas } from '../schema.js'
import { freePort, waitPort, pull, waitUntilLogsSay } from '../net.js'
import { defaultDataDir, mkdir, touch, makeStateDir
       , resolve, relative, dirname, basename
       , fileURLToPath, cwd, homedir
       , existsSync, readFile, writeFile, unlink } from '../sys.js'

import SecretNetworkNode from './Node.js'
import SecretNetworkAgent from './Agent.js'
import SecretNetworkContract from './Contract.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const {warn, debug, info} = console

export const defaultStateBase = resolve(process.cwd(), 'artifacts')

/* TODO: Remove rest arguments (`...args`) from constructors.
 * Define exactly what goes where. */

/** Builds contracts and optionally uploads them as an agent on the Secret Network.
 * Stores upload results as receipts.
 */
export class SecretNetworkBuilder {

  constructor (fields = {}) {
    Object.assign(this, fields)
  }

  /** Get the address of the agent attached to this builder, if it exists.
   */
  get address () {
    return this.agent ? this.agent.address : undefined
  }

  /** Build from source in a Docker container.
   */
  async build (options = {}) {
    const { buildAs, origin, ref = 'HEAD', crate, outputDir, workspace } = options
    const docker = new Docker()

    const buildOptions = {
      Env: this.getBuildEnv(),
      Tty: true,
      AttachStdin: true,
      Entrypoint: ['/bin/sh', '-c'],
      HostConfig: {
        Binds: [
          `${resolve(__dirname, 'build.sh')}:/entrypoint.sh:ro`,
          `${outputDir}:/output:rw`,
          `sienna_cache_${ref}:/code/target:rw`,
          `cargo_cache_${ref}:/usr/local/cargo:rw`,
        ]
      }
    }

    if (ref === 'HEAD') { // when building working tree
      debug(`building working tree at ${workspace} into ${outputDir}...`)
      buildOptions.HostConfig.Binds.push(`${workspace}:/contract:rw`)
    }

    const [{Error:err, StatusCode:code}, container] = await docker.run(
      await pull('enigmampc/secret-contract-optimizer:latest', docker),
      this.getBuildCommand({buildAs,origin,ref,crate}),
      process.stdout,
      buildOptions)

    await container.remove()
    if (err) throw new Error(err)
    if (code !== 0) throw new Error(`build exited with status ${code}`)

    return resolve(outputDir, `${crate}@${ref}.wasm`)
  }
  /** Generate the command line for the container.
   */
  getBuildCommand ({
    buildAs = 'root',
    origin  = 'git@github.com:hackbg/sienna-secret-token.git',
    ref     = 'HEAD',
    crate,
  } = {}) {
    const commands = []
    if (ref !== 'HEAD') {
      assert(origin && ref, 'to build a ref from origin, specify both')
      debug('building ref from origin...')
      commands.push('mkdir -p /contract')
      commands.push('cd /contract')
      commands.push(`git clone --recursive -n ${origin} .`) // clone the repo with submodules
      commands.push(`git checkout ${ref}`) // check out the interesting ref
      commands.push(`git submodule update`) // update submodules for the new checkout
      //commands.push(`chown -R ${buildAs} /contract`)
    }
    commands.push(`bash /entrypoint.sh ${crate} ${ref||''}`)
    //commands.push(`pwd && ls -al && mv ${crate}.wasm /output/${crate}@${ref}.wasm`)
    return commands.join(' && ')
  }

  /** Get environment variables for the container.
   */
  getBuildEnv = () =>
    [ 'CARGO_NET_GIT_FETCH_WITH_CLI=true'
    , 'CARGO_TERM_VERBOSE=true'
    , 'CARGO_HTTP_TIMEOUT=240' ]

  /** Try to upload a binary to the network but return a pre-existing receipt if one exists.
   *  TODO also code checksums should be validated
   */
  async uploadCached (artifact) {
    const receiptPath = this.getReceiptPath(artifact)
    if (existsSync(receiptPath)) {
      const receiptData = await readFile(receiptPath, 'utf8')
      info(`ℹ️  ${relative(process.cwd(),receiptPath)} exists, delete to reupload`)
      return JSON.parse(receiptData)
    } else {
      return this.upload(artifact)
    }
  }

  getReceiptPath = path =>
    resolve(this.network.receipts, `${basename(path)}.upload.json`)

  /** Upload a binary to the network.
   */
  async upload (artifact) {
    const uploadResult = await this.agent.upload(artifact)
    const receiptData  = JSON.stringify(uploadResult, null, 2)
    await writeFile(this.getReceiptPath(artifact), receiptData, 'utf8')
    return uploadResult
  }
}

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
    debug(`⏳ preparing localnet "${chainId}" @ ${state}`)
    const node = await this.Node.respawn({chainId, state})
    await node.ready
    debug(`🟢 localnet ready @ ${state}`)
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
    info(`⏳ connecting to ${chainId} via ${protocol} on ${host}:${port}`)
    const network = new this({chainId, state, protocol, host, port, path})
    const agent = await network.getAgent("ADMIN", { mnemonic, address })
    info(`🟢 connected, operating as ${address}`)
    return { network, agent, builder: network.getBuilder(agent) }
  }


}

/**@typedef {Object} Connection
 * @property {SecretNetworkNode} [node] - (if localnet) interface to docker container
 * @property {SecretNetwork} network - interface to the node's REST API endpoint.
 * @property {SecretNetworkAgent} agent - a default agent to query and transact on that network.
 * @property {SecretNetworkBuilder} builder - can upload contracts to that network as that agent.
 */
