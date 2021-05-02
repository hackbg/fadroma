import assert from 'assert'
import Docker from 'dockerode'
import { Bip39 } from '@cosmjs/crypto'
import { EnigmaUtils, Secp256k1Pen, SigningCosmWasmClient, encodeSecp256k1Pubkey, pubkeyToAddress
       , makeSignBytes } from 'secretjs'
import say, { sayer, muted } from './say.js'
import { loadJSON, loadSchemas } from './schema.js'
import { freePort, waitPort, pull, waitUntilLogsSay } from './net.js'
import { defaultDataDir, mkdir, touch, makeStateDir
       , resolve, dirname, basename
       , fileURLToPath, cwd, homedir
       , existsSync, readFile, writeFile, unlink } from './sys.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const {warn, debug, info} = console

export const defaultStateBase = resolve(process.cwd(), 'artifacts')

/* TODO: Remove rest arguments (`...args`) from constructors.
 * Define exactly what goes where. */

/** @class
 * Manages lifecycle of docker container for localnet.
 */
export class SecretNetworkNode {
  /**Interface to a REST API endpoint. Can store wallets and results of contract uploads/inits.
   * @constructor
   * @param {Object} options - the node options
   * @param {string} options.chainId - chain id
   * @param {string} options.protocol - http or https
   * @param {string} options.host - normally localhost
   * @param {number} options.port - normally 1337
   * @param {number} options.keysState - directory to store genesis accounts
   */
  constructor (options = {}) {
    const { chainId  = 'enigma-pub-testnet-3'
          , protocol = 'http'
          , host     = 'localhost'
          , port     = 1337
          , keysState } = options
    Object.assign(this, { chainId, protocol, host, port, keysState })
    const ready = waitPort({ host: this.host, port: this.port }).then(()=>this)
    Object.defineProperty(this, 'ready', { get () { return ready } })
  }
  /**Return one of the genesis accounts stored when creating the node.
   * @param {string} name - the name of the account. */
  genesisAccount = name =>
    loadJSON(resolve(this.keysState, `${name}.json`))

  /**Wake up a stopped localnet container, or create one
   */
  static async respawn (options={}) {
    // chain id and storage paths for this node
    const { chainId   = 'enigma-pub-testnet-3'
          , state     = makeStateDir(defaultDataDir(), 'fadroma', chainId)
          , nodeState = resolve(state, 'node.json')
          , keysState = mkdir(state, 'wallets')
          } = options
    if (!existsSync(state)) {
      options.state     = makeStateDir(state)
      options.nodeState = resolve(state, 'node.json')
      options.keysState = mkdir(state, 'wallets')
      return await this.spawn(options)
    }
    if (!existsSync(nodeState)) {
      touch(nodeState)
      return await this.spawn(options)
    }
    let restored
    try {
      restored = JSON.parse(await readFile(nodeState, 'utf8'))
    } catch (e) {
      warn(`reading ${nodeState} failed, trying to spawn a new node...`)
      return this.spawn(options)
    }
    const { containerId
          , port } = restored
    const { dockerOptions = { socketPath: '/var/run/docker.sock' }
          , docker        = new Docker(dockerOptions) } = options
    let container, Running
    try {
      container = docker.getContainer(containerId)
      ;({State:{Running}} = await container.inspect())
    } catch (e) {
      warn(`getting container ${containerId} failed, trying to spawn a new node...`)
      return this.spawn(options)
    }
    if (!Running) await container.start({})
    process.on('beforeExit', async ()=>{
      const {State:{Running}} = await container.inspect()
      if (Running) {
        debug(`killing ${container.id}`)
        await container.kill()
        debug(`killed ${container.id}`)
        process.exit()
      }
    })
    // return interface to this node/node
    return new this({ state, nodeState, keysState
                    , chainId, container, port })
  }

  /**Configure a new localnet container
   */
  static async spawn (options={}) {
    debug('spawning a new localnet container...')
    const { chainId = "enigma-pub-testnet-3"
          // what port to listen on
          , port    = await freePort()
          // where to keep state
          , state       = makeStateDir(defaultDataDir(), 'fadroma', chainId)
          , nodeState   = touch(state, 'node.json')
          , keysState   = mkdir(state, 'wallets')
          , daemonState = mkdir(state, '.secretd')
          , cliState    = mkdir(state, '.secretcli')
          , sgxState    = mkdir(state, '.sgx-secrets')
          // get interface to docker daemon and fetch node image
          , dockerOptions = { socketPath: '/var/run/docker.sock' }
          , docker        = new Docker(dockerOptions)
          , image         = await pull("enigmampc/secret-network-sw-dev", docker)
          // modified genesis that keeps the keys
          , init = resolve(__dirname, 'SecretNetwork.init.sh')
          , genesisAccounts = ['ADMIN', 'ALICE', 'BOB', 'MALLORY']
          , containerOptions = // stuff dockerode passes to docker
            { Image: image
            , Entrypoint: [ '/bin/bash' ]
            , Cmd:        [ '/init.sh' ]
            , AttachStdin:  true
            , AttachStdout: true
            , AttachStderr: true
            , Tty:          true
            , Env: [ `Port=${port}`
                   , `ChainID=${chainId}`
                   , `GenesisAccounts=${genesisAccounts.join(' ')}` ]
            , HostConfig:
              { NetworkMode: 'host'
              , Binds: [ `${init}:/init.sh:ro`
                       , `${keysState}:/shared-keys:rw`
                       , `${daemonState}:/root/.secretd:rw`
                       , `${cliState}:/root/.secretcli:rw`
                       , `${sgxState}:/root/.sgx-secrets:rw` ] } }
          } = options
    // create container with the above options
    const container = await docker.createContainer(containerOptions)
    const {id} = container
    await container.start()
    // record its existence for subsequent runs
    const stored = { chainId, containerId: id, port }
    await writeFile(nodeState, JSON.stringify(stored, null, 2), 'utf8')
    // wait for logs to confirm that the genesis is done
    await waitUntilLogsSay(container, 'GENESIS COMPLETE')
    return new this({ state, keysState
                    , chainId, container, port })
  }
}

/** Queries and transacts on an instance of the Secret Network
 */
export class SecretNetworkAgent {
  /** Create a new agent with its signing pen, from a mnemonic or a keyPair.*/
  static async create ({ name = 'Anonymous', mnemonic, keyPair, ...args }={}) {
    if (mnemonic) {
      // if keypair doesnt correspond to the mnemonic, delete the keypair
      if (keyPair && mnemonic !== Bip39.encode(keyPair.privkey).data) {
        warn(`keypair doesn't match mnemonic, ignoring keypair`)
        keyPair = null
      }
    } else if (keyPair) {
      // if there's a keypair but no mnemonic, generate mnemonic from keyapir
      mnemonic = Bip39.encode(keyPair.privkey).data
    } else {
      // if there is neither, generate a new keypair and corresponding mnemonic
      keyPair = EnigmaUtils.GenerateNewKeyPair()
      mnemonic = Bip39.encode(keyPair.privkey).data
    }
    const pen = await Secp256k1Pen.fromMnemonic(mnemonic)
    return new this({name, mnemonic, keyPair, say, pen, ...args})
  }
  /**Create a new agent from a signing pen.*/
  constructor (options = {}) {
    const { network
          , name = ""
          , pen
          , mnemonic
          , keyPair
          , fees = SecretNetwork.Gas.defaultFees } = options
    const pubkey = encodeSecp256k1Pubkey(pen.pubkey)
    return Object.assign(this, {
      network, name, keyPair, mnemonic, pen, pubkey,
      API: new SigningCosmWasmClient(
        network.url,
        this.address = pubkeyToAddress(pubkey, 'secret'),
        this.sign = pen.sign.bind(pen),
        this.seed = EnigmaUtils.GenerateNewSeed(),
        this.fees = fees
      )
    })
  }
  /**Create a builder that uses this agent to deploy contracts.*/
  getBuilder = () => new SecretNetworkBuilder({network: this.network, agent: this})
  /**Get the current balance in a specified denomination.*/
  async getBalance (denomination = 'uscrt') {
    const account = await this.API.getAccount(this.address) || {}
    const balance = account.balance || []
    const inDenom = ({denom, amount}) => denom === denomination
    const balanceInDenom = balance.filter(inDenom)[0] || {}
    return balanceInDenom.amount || 0
  }
  /**Send some `uscrt` to an address.*/
  async send (recipient, amount, denom = 'uscrt', memo = "") {
    if (typeof amount === 'number') amount = String(amount)
    return await this.API.sendTokens(recipient, [{denom, amount}], memo)
  }
  /**Send `uscrt` to multiple addresses.*/
  async sendMany (txs = [], memo = "", denom = 'uscrt', fee = SecretNetwork.Gas(500000 * txs.length)) {
    if (txs.length < 0) {
      throw new Error('tried to send to 0 recipients')
    }
    const from_address = this.address
    //const {accountNumber, sequence} = await this.API.getNonce(from_address)
    let accountNumber, sequence
    const msg = await Promise.all(txs.map(async ([to_address, amount])=>{
      ({accountNumber, sequence} = await this.API.getNonce(from_address)) // increment nonce?
      if (typeof amount === 'number') amount = String(amount)
      const value = {from_address, to_address, amount: [{denom, amount}]}
      return { type: 'cosmos-sdk/MsgSend', value }
    }))
    const signBytes = makeSignBytes(msg, fee, this.network.chainId, memo, accountNumber, sequence)
    return this.API.postTx({ msg, memo, fee, signatures: [await this.sign(signBytes)] })
  }
  /**`await` this to get info about the current block of the network. */
  get block () { return this.API.getBlock() }
  /**`await` this to get the account info for this agent's address.*/
  get account () { return this.API.getAccount(this.address) }
  /**`await` this to get the current balance in the native
   * coin of the network, in its most granular denomination */
  get balance () { return this.getBalance() }
  /**`await` this to pause until the block height has increased.
   * (currently this queries the block height in 1000msec intervals) */
  get nextBlock () {
    return this.API.getBlock().then(({header:{height}})=>new Promise(async resolve=>{
      while (true) {
        await new Promise(ok=>setTimeout(ok, 1000))
        const now = await this.API.getBlock()
        if (now.header.height > height) {
          resolve()
          break
        }
      }
    }))
  }
  /**Upload a compiled binary to the chain, returning the code ID (among other things). */
  async upload (pathToBinary) { return this.API.upload(await readFile(pathToBinary), {}) }
  /**Instantiate a contract from a code ID and an init message. */
  async instantiate ({ codeId, initMsg = {}, label = '' }) {
    const initTx   = await this.API.instantiate(codeId, initMsg, label)
    const codeHash = await this.API.getCodeHashByContractAddr(initTx.contractAddress)
    return { ...initTx, codeId, label, codeHash }
  }
  /**Query a contract. */
  query = (contract, method='', args={}) =>
    this.API.queryContractSmart(contract.address, {[method]: args})
  /**Execute a contract transaction. */
  execute = (contract, method='', args={}) =>
    this.API.execute(contract.address, {[method]: args})
}

/** Builds contracts and optionally uploads them as an agent on the Secret Network.
 * Stores upload results as receipts.
 */
export class SecretNetworkBuilder {
  constructor (fields) { this.configure(fields) }
  configure = (fields={}) => { Object.assign(this, fields) }
  get address () { return this.agent ? this.agent.address : undefined }
  /** Build from source in a Docker container.
   */
  async build (options) {
    const docker       = new Docker()
    const buildImage   = await pull('enigmampc/secret-contract-optimizer:latest', docker)
    const buildCommand = this.getBuildCommand(options)
    const entrypoint   = resolve(__dirname, 'SecretNetwork.build.sh')
    const buildOptions = {
      Env: this.getBuildEnv(),
      Tty: true,
      AttachStdin: true,
      Entrypoint: ['/bin/sh', '-c'],
      HostConfig: {
        Binds: [
          `${entrypoint}:/entrypoint.sh:ro`,
          `${options.outputDir}:/output:rw`,
          `sienna_cache_${options.ref||'HEAD'}:/code/target:rw`,
          `cargo_cache_${options.ref||'HEAD'}:/usr/local/cargo:rw`,
        ]
      }
    }
    options.ref = options.ref || 'HEAD'
    if (options.ref === 'HEAD') { // when building working tree
      debug(`building working tree at ${options.workspace} into ${options.outputDir}...`)
      buildOptions.HostConfig.Binds.push(`${options.workspace}:/contract:rw`)
    }
    const args = [buildImage, buildCommand, process.stdout, buildOptions]
    const [{Error:err, StatusCode:code}, container] = await docker.run(...args)
    await container.remove()
    if (err) throw new Error(err)
    if (code !== 0) throw new Error(`build exited with status ${code}`)
    return resolve(options.outputDir, `${options.crate}@${options.ref}.wasm`)
  }
  /** Generate the command line for the container.
   */
  getBuildCommand ({
    buildAs = 'root',
    origin  = 'git@github.com:hackbg/sienna-secret-token.git',
    ref     = 'HEAD',
    crate,
  }) {
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
      info(`${receiptPath} exists. Delete it to reupload that contract.`)
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

/** Interface to a contract instance.
 * Can be subclassed with schema to auto-generate methods
 * TODO connect to existing contract */
export class SecretNetworkContract {
  constructor (fields={}) {
    Object.assign(this, fields)
  }
  /**Get the path to the upload receipt for the contract's code.
   */
  get receiptPath () { return resolve(this.network.instances, `${this.label}.json`) }
  /**Get an interface to the network where the contract is deployed.
   */
  get network () { return this.agent.network }
  /**Get the address of the contract.
   */
  get address () { return this.contractAddress }
  /**Tell an agent to instantiate this contract from codeId, label, and initMsg.
   */
  static async init ({ agent, codeId, label, initMsg } = {}) {
    const receipt = await agent.instantiate({codeId, label, initMsg})
    const instance = new this({ agent, ...receipt })
    await writeFile(instance.receiptPath, JSON.stringify(receipt, null, 2), 'utf8')
    return instance
  }
  /**Query the contract.
   */
  query = (method = '', args = {}, agent = this.agent) =>
    agent.query(this, method, args)
  /**Execute a contract transaction.
   */
  execute = (method = '', args = {}, agent = this.agent) =>
    agent.execute(this, method, args)
  /** Create subclass with methods based on the schema
   * TODO: validate schema and req/res arguments (with `ajv`?)
   */
  static withSchema = (schema={}) =>
    extendWithSchema(this, schema)
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
   * @type {string}
   */
  get url () { return `${this.protocol}://${this.host}:${this.port}${this.path||''}` }
  /** create agent operating on the current instance's endpoint
   */
  getAgent = (name, options={}) =>
    this.constructor.Agent.create({ ...options, network: this, name })
  /** create builder operating on the current instance's endpoint
   */
  getBuilder = agent =>
    new this.constructor.Builder({network: this, agent})

  /**Run a node in a docker container and return a connection to it. 
   * @return {Connection} - connection with interface to container
   */
  static async localnet ({
    chainId   = 'enigma-pub-testnet-3',
    stateBase = defaultStateBase,
    state     = makeStateDir(stateBase, chainId)
  }={}) {
    debug(`⏳ preparing localnet "${chainId}" @ ${state}`)
    const node = await this.Node.respawn({state, chainId})
    await node.ready
    debug(`🟢 localnet ready @ ${node.state}`)
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

// extend SecretNetworkContract
function extendWithSchema (SecretNetworkContract, schema) {

  return class SecretNetworkContractWithSchema extends SecretNetworkContract {
    // read-only: the parsed schema
    static get schema () { return schema }
    // read-only: the queries generated from the schema
    get q () {
      return methodsFromSchema(this, this.constructor.schema.queryMsg, (self, method) => ({
        async [method] (args, agent = self.agent) { return await self.query(method, args, agent) }
      }))
    }
    // read-only: the transactions generated from the schema
    get tx () {
      return methodsFromSchema(this, this.constructor.schema.handleMsg, (self, method) => ({
        async [method] (args, agent = self.agent) { return await self.execute(method, args, agent) }
      }))
    }
  }

  // TODO: memoize this, so that methods aren't regenerated until the schema updates
  // TODO: generate TypeScript types from autogenerated method lists and/or from schema
  function methodsFromSchema (self, schema, getWrappedMethod) {
    if (!schema) return null
    return schema.anyOf.reduce((methods, methodSchema)=>{
      const {description, required:[methodName]} = methodSchema
      const methodWrapper = getWrappedMethod(self, methodName)
      methodWrapper[methodName].description = description
      methodWrapper[methodName] = methodWrapper[methodName].bind(self)
      return Object.assign(methods, methodWrapper)
    }, {})
  }

}

/**@typedef {Object} Connection
 * @property {SecretNetworkNode} [node] - (if localnet) interface to docker container
 * @property {SecretNetwork} network - interface to the node's REST API endpoint.
 * @property {SecretNetworkAgent} agent - a default agent to query and transact on that network.
 * @property {SecretNetworkBuilder} builder - can upload contracts to that network as that agent.
 */
