export * from '@fadroma/ops'

import {
  Identity, IAgent, BaseAgent, Fees,
  IChain, IChainNode, IChainState, IChainConnectOptions,
  BaseChain, ChainInstancesDir, prefund,
  Ensemble, EnsembleOptions,
  BaseEnsemble,
  ContractAPI,
  DockerizedChainNode, ChainNodeOptions,
  BaseGas
} from '@fadroma/ops'

import { PatchedSigningCosmWasmClient_1_0 } from '@fadroma/scrt-1.0'

import { PatchedSigningCosmWasmClient_1_2 } from '@fadroma/scrt-1.2'

import {
  open, defaultStateBase, resolve, table, noBorders,
  Commands, readFile, Console, bold, execFile, spawn, Path, Directory, TextFile,
  JSONFile, JSONDirectory, dirname, fileURLToPath
} from '@fadroma/tools'

import { Bip39 } from '@cosmjs/crypto'

import {
  EnigmaUtils, Secp256k1Pen, SigningCosmWasmClient,
  encodeSecp256k1Pubkey, pubkeyToAddress,
  makeSignBytes, BroadcastMode
} from 'secretjs/src/index.ts'

import { URL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const console = Console('@fadroma/ops-scrt/ScrtAgentJS')

export class ScrtContract extends ContractAPI {
  buildImage  = 'enigmampc/secret-contract-optimizer:latest'
  buildScript = resolve(__dirname, 'ScrtBuild.sh')
}

type EnsembleConstructor = new (args: EnsembleOptions) => Ensemble

export class ScrtEnsemble extends BaseEnsemble {
  /* Plugs into the CLI command parser to select the chain
   * onto which an ensemble is deployed */
  static chainSelector (E: EnsembleConstructor) {
    // TODO make this independent of Ensemble - or better yet, move it into Ensemble
    return [
      [ "secret_2",    "Run on secret_2",      on['secret_2']
      , new E({chain: Scrt.secret_2()}).remoteCommands() ],

      [ "secret_3",    "Run on secret_3",      on['secret_3']
      , new E({chain: Scrt.secret_3()}).remoteCommands()],

      ["holodeck-2",   "Run on holodeck2",     on['holodeck-2']
      , new E({chain: Scrt.holodeck_2()}).remoteCommands()],

      ["supernova-1",  "Run on supernova1",    on['supernova-1']
      , new E({chain: Scrt.supernova_1()}).remoteCommands()],

      ["localnet-1.0", "Run on localnet v1.0", on['localnet-1.0']
      , new E({chain: Scrt.localnet_1_0()}).remoteCommands()],

      ["localnet-1.2", "Run on localnet v1.2", on['localnet-1.2']
      , new E({chain: Scrt.localnet_1_2()}).remoteCommands()]
    ]
  }
}

export const denom = 'uscrt'

export class ScrtGas extends BaseGas {
  denom = denom
  constructor (x: number) {
    super(x)
    this.amount.push({amount: String(x), denom})
  }
}

export const defaultFees: Fees = {
  upload: new ScrtGas(3000000),
  init:   new ScrtGas(1000000),
  exec:   new ScrtGas(1000000),
  send:   new ScrtGas( 500000),
}


/// ## Agents
///
/// ### SecretJS-based


/** Queries and transacts on an instance of the Secret Chain */
export abstract class ScrtAgentJS extends BaseAgent {

  /** Create a new agent with its signing pen, from a mnemonic or a keyPair.*/
  static async createSub (AgentClass: AgentClass, options: Identity) {
    const { name = 'Anonymous', ...args } = options
    let { mnemonic, keyPair } = options
    if (mnemonic) {
      console.info('creating agent from mnemonic')
      // if keypair doesnt correspond to the mnemonic, delete the keypair
      if (keyPair && mnemonic !== (Bip39.encode(keyPair.privkey) as any).data) {
        console.warn(`keypair doesn't match mnemonic, ignoring keypair`)
        keyPair = null } }
    else if (keyPair) {
      console.info('creating agent from keypair')
      // if there's a keypair but no mnemonic, generate mnemonic from keyapir
      mnemonic = (Bip39.encode(keyPair.privkey) as any).data }
    else {
      console.info('creating new agent')
      // if there is neither, generate a new keypair and corresponding mnemonic
      keyPair  = EnigmaUtils.GenerateNewKeyPair()
      mnemonic = (Bip39.encode(keyPair.privkey) as any).data }
    const pen = await Secp256k1Pen.fromMnemonic(mnemonic)
    return new AgentClass({name, mnemonic, keyPair, pen, ...args}) }

  readonly API: SigningCosmWasmClient

  readonly chain:    Scrt
  readonly name:     string
  readonly keyPair:  any
  readonly mnemonic: any
  readonly pen:      any
  readonly sign:     any
  readonly pubkey:   any
  readonly seed:     any
  readonly address:  string
  fees = defaultFees

  /** Create a new agent from a signing pen. */
  constructor (APIConstructor: APIConstructor, options: Identity) {
    super(options)
    this.chain    = options.chain as Scrt
    this.name     = options.name || ''
    this.keyPair  = options.keyPair
    this.mnemonic = options.mnemonic
    this.pen      = options.pen
    this.fees     = options.fees || defaultFees

    this.pubkey  = encodeSecp256k1Pubkey(options.pen.pubkey)
    this.address = pubkeyToAddress(this.pubkey, 'secret')
    this.sign    = this.pen.sign.bind(this.pen)
    this.seed    = EnigmaUtils.GenerateNewSeed()

    this.API = new APIConstructor(
      this.chain.url, this.address,
      this.sign, this.seed, this.fees,
      BroadcastMode.Sync
    )
  }

  // block time //

  /**`await` this to pause until the block height has increased.
   * (currently this queries the block height in 1000msec intervals) */
  get nextBlock () {
    return this.API.getBlock().then(({header:{height}})=>new Promise<void>(async resolve=>{
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

  /**`await` this to get info about the current block of the chain. */
  get block () {
    return this.API.getBlock()
  }

  // native token //

  /**`await` this to get the account info for this agent's address.*/
  get account () {
    return this.API.getAccount(this.address)
  }

  /**`await` this to get the current balance in the native
   * coin of the chain, in its most granular denomination */
  get balance () {
    return this.getBalance('uscrt')
  }

  /**Get the current balance in a specified denomination.
   * TODO support SNIP20 tokens */
  async getBalance (denomination: string) {
    const account = await this.account
    const balance = account.balance || []
    const inDenom = ({denom}) => denom === denomination
    const balanceInDenom = balance.filter(inDenom)[0]
    if (!balanceInDenom) return 0
    return balanceInDenom.amount
  }

  /**Send some `uscrt` to an address.
   * TODO support sending SNIP20 tokens */
  async send (recipient: any, amount: string|number, denom = 'uscrt', memo = "") {
    if (typeof amount === 'number') amount = String(amount)
    return await this.API.sendTokens(recipient, [{denom, amount}], memo)
  }

  /**Send `uscrt` to multiple addresses.
   * TODO support sending SNIP20 tokens */
  async sendMany (txs = [], memo = "", denom = 'uscrt', fee = new ScrtGas(500000 * txs.length)) {
    if (txs.length < 0) {
      throw new Error('tried to send to 0 recipients') }
    const from_address = this.address
    //const {accountNumber, sequence} = await this.API.getNonce(from_address)
    let accountNumber: any
      , sequence:      any
    const msg = await Promise.all(txs.map(async ([to_address, amount])=>{
      ({accountNumber, sequence} = await this.API.getNonce(from_address)) // increment nonce?
      if (typeof amount === 'number') amount = String(amount)
      const value = {from_address, to_address, amount: [{denom, amount}]}
      return { type: 'cosmos-sdk/MsgSend', value }
    }))
    const signBytes = makeSignBytes(msg, fee, this.chain.chainId, memo, accountNumber, sequence)
    return this.API.postTx({ msg, memo, fee, signatures: [await this.sign(signBytes)] })
  }

  // compute //

  /** Upload a compiled binary to the chain, returning the code ID (among other things). */
  async upload (pathToBinary: string) {
    const data = await readFile(pathToBinary)
    return this.API.upload(data, {})
  }

  async getHashById (codeId: number) {
    return await this.API.getCodeHashByCodeId(codeId)
  }

  async getHashByAddress (address: string) {
    return await this.API.getCodeHashByContractAddr(address)
  }

  /** Instantiate a contract from a code ID and an init message. */
  async instantiate (codeId: number, label: string, initMsg: any) {
    const from = this.address
    console.debug(`${bold('  INIT >')} ${label}`, { from, codeId, label, initMsg })
    const initTx = await this.API.instantiate(codeId, initMsg, label)
    console.trace(initTx)
    Object.assign(initTx, { contractAddress: initTx.logs[0].events[0].attributes[4].value })
    console.debug(`${bold('< INIT  ')} ${label}`, { from, codeId, label, initTx })
    return initTx
  }

  /** Query a contract. */
  query = (
    { label, address }, method = '', args = null
  ) => {
    const from = this.address
    const msg = (args === null) ? method : { [method]: args }
    console.debug(`${bold('> QUERY >')} ${method}`, { from, label, address, method, args })
    const response = this.API.queryContractSmart(address, msg as any)
    console.debug(`${bold('< QUERY <')} ${method}`, { from, address, method, response })
    return response
  }

  /**Execute a contract transaction. */
  execute = (
    { label, address }, method='', args = null, memo: any, amount: any, fee: any
  ) => {
    const from = this.address
    const msg = (args === null) ? method : { [method]: args }
    console.debug(`${bold('  TX >')} ${method}`, { from, label, address, method, args, memo, amount, fee })
    const result = this.API.execute(address, msg as any, memo, amount, fee)
    console.debug(`${bold('< TX  ')} ${method}`, { from, label, address, method, result })
    return result
  }
}

export class ScrtAgentJS_1_0 extends ScrtAgentJS {
  static create = (options: Identity): Promise<IAgent> =>
    ScrtAgentJS.createSub(ScrtAgentJS_1_0 as unknown as AgentClass, options)
  constructor (options: Identity) { super(PatchedSigningCosmWasmClient_1_0, options) }
}

export class ScrtAgentJS_1_2 extends ScrtAgentJS {
  static create = (options: Identity): Promise<IAgent> =>
    ScrtAgentJS.createSub(ScrtAgentJS_1_2 as unknown as AgentClass, options)
  constructor (options: Identity) { super(PatchedSigningCosmWasmClient_1_2, options) }
}

type AgentClass = new (options: Identity) => IAgent &
  { create: (options: Identity) => Promise<IAgent> }


/// ## secretcli-based


export class ScrtCLIAgent extends BaseAgent {

  /** Create a new agent with its signing pen, from a mnemonic or a keyPair.*/
  static async create (options: Identity) {
    const { name = 'Anonymous', ...args } = options
    let { mnemonic, keyPair } = options

    if (mnemonic) {
      // if keypair doesnt correspond to the mnemonic, delete the keypair
      if (keyPair && mnemonic !== (Bip39.encode(keyPair.privkey) as any).data) {
        console.warn(`keypair doesn't match mnemonic, ignoring keypair`)
        keyPair = null
      }
    } else if (keyPair) {
      // if there's a keypair but no mnemonic, generate mnemonic from keyapir
      mnemonic = (Bip39.encode(keyPair.privkey) as any).data
    } else {
      // if there is neither, generate a new keypair and corresponding mnemonic
      keyPair  = EnigmaUtils.GenerateNewKeyPair()
      mnemonic = (Bip39.encode(keyPair.privkey) as any).data
    }

    return new ScrtCLIAgent({name, mnemonic, keyPair, ...args})
  }

  chain:         Scrt
  name:          string
  address:       string
  nameOrAddress: string
  fees:          any

  static Help = {
    NOT_A_TTY: "Input is not a TTY - can't interactively pick an identity",
    NO_KEYS_1: "Empty key list returned from secretcli. Retrying once...",
    NO_KEYS_2: "Still empty. To proceed, add your key to secretcli " +
               "(or set the mnemonic in the environment to use the SecretJS-based agent)"
  }

  static async pick () {
    if (!process.stdin.isTTY) {
      throw new Error(ScrtCLIAgent.Help.NOT_A_TTY) }
    let keys = (await secretcli('keys', 'list'))
    if (keys.length < 1) {
      console.warn(ScrtCLIAgent.Help.NO_KEYS_1)
      await tryToUnlockKeyring()
      keys = (await secretcli('keys', 'list'))
      if (keys.length < 1) console.warn(ScrtCLIAgent.Help.NO_KEYS_2)
    }
  }

  constructor (options: any = {}) {
    super()
    console.debug({options})
    const { name, address } = options
    this.name = name
    this.address = address
    this.nameOrAddress = this.name || this.address
  }

  get nextBlock () {
    return this.block.then(async T1=>{
      while (true) {
        await new Promise(ok=>setTimeout(ok, 1000))
        const T2 = (await this.block).sync_info.latest_block_height
        if (T2 > T1) return
      }
    })
  }

  get block () {
    return secretcli('status').then(({sync_info:{latest_block_height:T2}})=>T2)
  }

  get account () {
    return secretcli('q', 'account', this.nameOrAddress)
  }

  get balance () {
    return this.getBalance('uscrt')
  }

  async getBalance (denomination: string) {
    return ((await this.account).value.coins
      .filter((x:any)=>x.denom===denomination)[0]||{})
      .amount
  }

  async send (recipient: any, amount: any, denom = 'uscrt', memo = '') {
    throw new Error('not implemented')
  }

  async sendMany (txs = [], memo = '', denom = 'uscrt', fee) {
    throw new Error('not implemented')
  }

  async upload (pathToBinary: string) {
    return secretcli(
      'tx', 'compute', 'store',
      pathToBinary,
      '--from', this.nameOrAddress )
  }

  async instantiate (instance: any) {
    const { codeId, initMsg = {}, label = '' } = instance
    instance.agent = this
    console.debug(`⭕`+bold('init'), { codeId, label, initMsg })
    const initTx = instance.initTx = await secretcli(
      'tx', 'compute', 'instantiate',
      codeId, JSON.stringify(initMsg),
      '--label', label,
      '--from', this.nameOrAddress)
    console.debug(`⭕`+bold('instantiated'), { codeId, label, initTx })
    instance.codeHash = await secretcli('q', 'compute', 'contract-hash', initTx.contractAddress)
    await instance.save()
    return instance
  }

  async query ({ label, address }, method='', args = undefined) {
    const msg = (args === undefined) ? method : { [method]: args }
    console.debug(`❔ `+bold('query'), { label, address, method, args })
    const response = await secretcli(
      'q', 'compute', 'query',
      address, JSON.stringify(msg))
    console.debug(`❔ `+bold('response'), { address, method, response })
    return response
  }

  async execute ({ label, address }, method='', args = undefined) {
    const msg = (args === undefined) ? method : { [method]: args }
    console.debug(`❗ `+bold('execute'), { label, address, method, args })
    const result = await secretcli(
      'tx', 'compute',
      address, JSON.stringify(msg),
      '--from', this.nameOrAddress)
    console.debug(`❗ `+bold('result'), { label, address, method, result })
    return result
  }
}

const secretcli = (...args: Array<any>): Promise<any> =>
  new Promise((resolve, reject)=>{
    execFile('secretcli', args, (err: any, stdout: any) => {
      if (err) return reject(err)
      resolve(JSON.parse(String(stdout)))
    })
  })

const tryToUnlockKeyring = async () =>
  new Promise((resolve, reject)=>{
    console.warn("Pretending to add a key in order to refresh the keyring...")
    const unlock = spawn('secretcli', ['keys', 'add'])
    unlock.on('spawn', () => {
      unlock.on('close', resolve)
      setTimeout(()=>{ unlock.kill() }, 1000) })
    unlock.on('error', reject)
  })

export type ScrtChainState = IChainState & {
  Agent?:      AgentClass
  identities?: Array<string>
}

export const on = {
  'localnet-1.0' (context: any = {}) {
    console.info(`Running on ${bold('localnet-1.0')}:`)
    context.chain = Scrt.localnet_1_0()
  },

  'localnet-1.2' (context: any = {}) {
    console.info(`Running on ${bold('localnet-1.2')}:`)
    context.chain = Scrt.localnet_1_2()
  },

  'holodeck-2' (context: any = {}) {
    console.info(`Running on ${bold('holodeck-2')}:`)
    context.chain = Scrt.holodeck_2()
  },

  'supernova-1' (context: any = {}) {
    console.info(`Running on ${bold('supernova-1')}:`)
    context.chain = Scrt.supernova_1()
  },

  'secret-2' (context: any = {}) {
    console.info(`Running on ${bold('secret-2')}:`)
    context.chain = Scrt.secret_2()
  },

  'secret-3' (context: any = {}) {
    console.info(`Running on ${bold('secret-3')}:`)
    context.chain = Scrt.secret_3()
  }
}

export function openFaucet () {
  const url = `https://faucet.secrettestnet.io/`
  console.debug(`Opening ${url}...`)
  open(url)
}

export const Help = {
  RESET:   "✨ Erase the state of this localnet",
  MAINNET: "💰 Interact with the Secret Network mainnet",
  FAUCET:  "🚰 Open a faucet for this network in your default browser",
  FUND:    "👛 Create test wallets by sending native token to them"
}

const {
  SCRT_API_URL,
  SCRT_AGENT_NAME,
  SCRT_AGENT_ADDRESS,
  SCRT_AGENT_MNEMONIC
} = process.env

type RemoteCommands = (x: IChain) => Commands

export class Scrt extends BaseChain {

  chainId?: string

  apiURL?:  URL

  /**The API URL that this instance talks to.
   * @type {string} */
  get url () {
    return this.apiURL.toString()
  }

  node?:    IChainNode

  Agent: AgentClass
  defaultIdentity: null
    | string
    | { name?: string, address?: string, mnemonic?: string }
    | IAgent

  stateRoot:  Directory
  identities: JSONDirectory
  uploads:    JSONDirectory
  instances:  ChainInstancesDir

  /** Interface to a Secret Network REST API endpoint.
   *  Can store identities and results of contract uploads/inits.
   * @constructor
   * @param {Object} options           - the configuration options
   * @param {string} options.chainId   - the internal ID of the chain running at that endpoint
   * TODO document the remaining options */
  constructor (options: ScrtChainState = {}) {
    super(options)
    const node = this.node = options.node || null
    // info needed to connect to the chain's REST API
    this.chainId = options.chainId || node?.chainId || 'enigma-pub-testnet-3'
    this.apiURL  = options.apiURL  || node?.apiURL  || new URL('http://localhost:1337/')
    // directories to store state.
    const stateRoot = options.stateRoot || resolve(defaultStateBase, this.chainId)
    this.stateRoot  = new Directory(stateRoot)
    this.identities = new JSONDirectory(stateRoot, 'identities')
    this.uploads    = new JSONDirectory(stateRoot, 'uploads')
    this.instances  = new ChainInstancesDir(stateRoot, 'instances')
    // handle to localnet node if this is localnet
    // default agent credentials
    if (options.Agent) this.Agent = options.Agent
    this.defaultIdentity = options.defaultIdentity
  }


  /// ### Instantiator
  ///
  /// If this chain is backed by a localnet, respawns it.


  #ready: Promise<any>
  get ready () {
    if (this.#ready) return this.#ready
    return this.#ready = this.init()
  }
  private async init (): Promise<this> {
    // if this is a localnet handle, wait for the localnet to start
    const node = await Promise.resolve(this.node)
    if (node) {
      this.node = node
      // respawn that container
      console.info(`Running on localnet ${bold(this.chainId)} @ ${bold(this.stateRoot.path)}`)
      await node.respawn()
      await node.ready
      // set the correct port to connect to
      this.apiURL.port = String(node.port)
      console.info(`🟢 localnet ready @ port ${bold(this.apiURL.port)}`)
      // get the default account for the node
      if (typeof this.defaultIdentity === 'string') {
        this.defaultIdentity = this.node.genesisAccount(this.defaultIdentity)
      }
    }
    const { protocol, hostname, port } = this.apiURL
    console.log(`⏳ connecting to ${this.chainId} via ${protocol} on ${hostname}:${port}`)
    if (this.defaultIdentity) {
      // default credentials will be used as-is unless using localnet
      const { mnemonic, address } = this.defaultIdentity as { mnemonic: string, address: string }
      this.defaultIdentity = await this.getAgent({ name: "ADMIN", mnemonic, address })
      console.info(`🟢 operating as ${address}`)
    }
    return this
  }


  /// # Agent and Contract factory methods


  /** create agent operating on the current instance's endpoint*/
  async getAgent (
    identity: string|Identity = this.defaultIdentity,
    Agent                     = this.Agent
  ): Promise<IAgent> {
    if (typeof identity === 'string')
      identity = this.node.genesisAccount(identity)

    if (identity.mnemonic || identity.keyPair) {
      console.info(
        `Using a ${bold('SecretJS')}-based agent ` +
        `because a mnemonic or keypair was passed.`
      )
      return await Agent.create({
        ...identity,
        chain: this as IChain
      })
    }

    const name = identity.name || this.defaultIdentity?.name
    if (name) {
      console.info(
        `Using a ${bold('secretcli')}-based agent `+
        `because a name was passed.`
      )
      return new ScrtCLIAgent({
        chain: this,
        name
      }) as IAgent
    }

    throw new Error(
      'You need to provide a name to get a secretcli-backed agent, ' +
      `or a mnemonic or keypair to get a SecretJS-backed agent ` +
      `on chain ${this.chainId}`
    )
  }

  /** create contract instance from interface class and address */
  getContract (ContractAPI: any, contractAddress: string, agent = this.defaultIdentity) {
    return new ContractAPI({
      initTx: { contractAddress }, // TODO restore full initTx if present in artifacts
      agent
    })
  }


  /// ### Connectors


  /** Create an instance that talks to to the Secret Network mainnet via secretcli */
  static secret_2 (options: IChainConnectOptions = {}): Scrt {
    const {
      chainId = 'secret-2',
      apiKey  = '5043dd0099ce34f9e6a0d7d6aa1fa6a8',
      apiURL  = new URL(SCRT_API_URL||`https://secret-2--lcd--full.datahub.figment.io/apikey/${apiKey}/`),
      defaultIdentity = {
        name:     SCRT_AGENT_NAME,
        address:  SCRT_AGENT_ADDRESS,
        mnemonic: SCRT_AGENT_MNEMONIC
      }
    } = options
    return new Scrt({
      isMainnet: true,
      chainId,
      apiURL,
      defaultIdentity,
      Agent: ScrtAgentJS_1_0
    })
  }

  /** Create an instance that talks to to the Secret Network mainnet via secretcli */
  static secret_3 (options: IChainConnectOptions = {}): Scrt {
    const {
      chainId = 'secret-3',
      apiKey  = '5043dd0099ce34f9e6a0d7d6aa1fa6a8',
      apiURL  = new URL(SCRT_API_URL||`https://secret-3--lcd--full.datahub.figment.io/apikey/${apiKey}/`),
      defaultIdentity = {
        name:     SCRT_AGENT_NAME,
        address:  SCRT_AGENT_ADDRESS,
        mnemonic: SCRT_AGENT_MNEMONIC||'glance hope warm silk amazing feel mind spy wink riot exhibit solid'
      }
    } = options
    return new Scrt({
      isMainnet: true,
      chainId,
      apiURL,
      defaultIdentity,
      Agent: ScrtAgentJS_1_0
    })
  }

  /** Create an instance that talks to holodeck-2 testnet via SecretJS */
  static holodeck_2 (options: IChainConnectOptions = {}): Scrt {
    const {
      //chainId = 'holodeck-2',
      apiURL  = new URL(SCRT_API_URL||'http://96.44.145.210/'),
      chainId = 'holodeck-2',
      //apiKey  = '5043dd0099ce34f9e6a0d7d6aa1fa6a8',
      //apiURL  = new URL(`https://secret-holodeck-2--lcd--full.datahub.figment.io:443/apikey/${apiKey}/`),
      defaultIdentity = {
        name:     SCRT_AGENT_NAME,
        address:  SCRT_AGENT_ADDRESS  || 'secret1vdf2hz5f2ygy0z7mesntmje8em5u7vxknyeygy',
        mnemonic: SCRT_AGENT_MNEMONIC || 'genius supply lecture echo follow that silly meadow used gym nerve together'
      }
    } = options
    return new Scrt({
      isTestnet: true,
      chainId,
      apiURL,
      defaultIdentity,
      Agent: ScrtAgentJS_1_0
    })
  }

  /** Create an instance that talks to to supernova-1 testnet via SecretJS */
  static supernova_1 (options: IChainConnectOptions = {}): Scrt {
    const {
      chainId = 'supernova-1',
      apiURL  = new URL(SCRT_API_URL||'http://bootstrap.supernova.enigma.co'),
      defaultIdentity = {
        name:     SCRT_AGENT_NAME,
        address:  SCRT_AGENT_ADDRESS  || 'secret1vdf2hz5f2ygy0z7mesntmje8em5u7vxknyeygy',
        mnemonic: SCRT_AGENT_MNEMONIC || 'genius supply lecture echo follow that silly meadow used gym nerve together'
      }
    } = options
    return new Scrt({
      isTestnet: true,
      chainId,
      apiURL,
      defaultIdentity,
      Agent: ScrtAgentJS_1_2
    })
  }

  /** Create an instance that runs a node in a local Docker container
   *  and talks to it via SecretJS */
  static localnet_1_0 (options: IChainConnectOptions = {}): Scrt {
    // no default agent name/address/mnemonic:
    // connect() gets them from genesis accounts
    return new Scrt({
      isLocalnet: true,
      node:    options.node    || new DockerizedScrtNode_1_0({ identities: options.identities }),
      chainId: options.chainId || 'enigma-pub-testnet-3',
      apiURL:  options.apiURL  || new URL('http://localhost:1337'),
      Agent:   ScrtAgentJS_1_0,
      defaultIdentity: 'ADMIN'
    })
  }

  /** Create an instance that runs a node in a local Docker container
   *  and talks to it via SecretJS */
  static localnet_1_2 (options: IChainConnectOptions = {}): Scrt {
    // no default agent name/address/mnemonic:
    // connect() gets them from genesis accounts
    return new Scrt({
      isLocalnet: true,
      ...options,
      node:    options.node    || new DockerizedScrtNode_1_2(options),
      chainId: options.chainId || 'enigma-pub-testnet-3',
      apiURL:  options.apiURL  || new URL('http://localhost:1337'),
      Agent:   ScrtAgentJS_1_0,
      defaultIdentity: 'ADMIN'
    })
  }


  /// ### Status tables


  printStatusTables () {
    const id = bold(this.chainId)

    if (this.uploadsTable.length > 1) {
      console.log(`\nUploaded binaries on ${id}:`)
      console.log('\n' + table(this.uploadsTable, noBorders))
    } else {
      console.log(`\n  No known uploaded binaries on ${id}`)
    }

    if (this.instancesTable.length > 1) {
      console.log(`Instantiated contracts on ${id}:`)
      console.log('\n' + table(this.instancesTable, noBorders))
    } else {
      console.log(`\n  No known contracts on ${id}`)
    }
  }

  /** List of code blobs in human-readable form */
  private get uploadsTable () {
    const rows = []
    // uploads table - lists code blobs
    rows.push([bold('  code id'), bold('name\n'), bold('size'), bold('hash')])
    if (this.uploads.exists()) {
      for (const name of this.uploads.list()) {
        const row = []
            , { codeId
              , originalSize
              , compressedSize
              , originalChecksum
              , compressedChecksum } = this.uploads.load(name)
        row.push(`  ${codeId}`)
        row.push(`${bold(name)}\ncompressed:\n`)
        row.push(`${originalSize}\n${String(compressedSize).padStart(String(originalSize).length)}`,)
        row.push(`${originalChecksum}\n${compressedChecksum}`)
        rows.push(row)
      }
    }
    return rows.sort((x,y)=>x[0]-y[0])
  }

  /** List of contracts in human-readable from */
  private get instancesTable () {
    const rows = []
    rows.push([bold('  label')+'\n  address', 'code id', 'code hash\ninit tx\n'])
    if (this.instances.exists()) {
      for (const name of this.instances.list()) {
        const row = []
        const {codeId, codeHash, initTx} = this.instances.load(name)
        const {contractAddress, transactionHash} = initTx
        row.push(`  ${bold(name)}\n  ${contractAddress}`)
        row.push(String(codeId))
        row.push(`${codeHash}\n${transactionHash}\n`)
        rows.push(row)
      }
    }
    return rows
  }

  /// ### Command builders
  /// FIXME: Deprecated.

  /** Generate command lists for known mainnets. */
  static mainnetCommands = (getCommands: RemoteCommands): Commands =>
    [['secret-2', Help.MAINNET, on['secret-2'], getCommands(Scrt.secret_2() as IChain)]
    ,['secret-3', Help.MAINNET, on['secret-3'], getCommands(Scrt.secret_3() as IChain)]]

  /** Generate command lists for known testnets. */
  static testnetCommands = (getCommands: RemoteCommands): Commands =>
    ['holodeck-2', 'supernova-1'].map((testnet: string)=>[
      testnet,
      `Run commands on ${testnet} testnet`,
      on[testnet],
      [ ["faucet", Help.FAUCET, openFaucet]
      , ["fund",   Help.FUND,   prefund]
      , ...getCommands(Scrt[testnet.replace(/[-.]/g, '_')]())]])

  /* Generate command lists for known localnet variants. */
  static localnetCommands = (getCommands: RemoteCommands): Commands =>
    ['localnet-1.0', 'localnet-1.2'].map((localnet: string)=>[
      localnet,
      `Run commands on ${localnet}`,
      on[localnet],
      [
        ['reset', Help.RESET, resetLocalnet],
        ...getCommands(Scrt[localnet.replace(/[-.]/g, '_')]())
      ]
    ])
}

export abstract class DockerizedScrtNode extends DockerizedChainNode {

  abstract readonly chainId: string
  abstract readonly image:   string

  readonly initScript = new TextFile(__dirname, 'ScrtChainNodeInit.sh')

  /** This directory is mounted out of the localnet container
    * in order to persist the state of the SGX component. */
  readonly sgxDir: Directory

  protected setDirectories (stateRoot?: Path) {
    stateRoot = stateRoot || resolve(defaultStateBase, this.chainId)
    Object.assign(this, { stateRoot: new Directory(stateRoot) })
    Object.assign(this, {
      identities: this.stateRoot.subdir('identities', JSONDirectory),
      nodeState:  new JSONFile(stateRoot, 'node.json'),
      daemonDir:  this.stateRoot.subdir('_secretd'),
      clientDir:  this.stateRoot.subdir('_secretcli'),
      sgxDir:     this.stateRoot.subdir('_sgx-secrest')
    })
  }

  async spawn () {
    this.sgxDir.make()
    return await super.spawn()
  }

  get binds () {
    return {
      ...super.binds,
      [this.sgxDir.path]:    '/root/.sgx-secrets:rw',
      [this.daemonDir.path]: `/root/.secretd:rw`,
      [this.clientDir.path]: `/root/.secretcli:rw`,
    }
  }
}

export class DockerizedScrtNode_1_0 extends DockerizedScrtNode {
  readonly chainId: string = 'enigma-pub-testnet-3'
  readonly image:   string = "enigmampc/secret-network-sw-dev"
  constructor (options: ChainNodeOptions = {}) {
    super()
    if (options.image) this.image = options.image
    if (options.chainId) this.chainId = options.chainId
    if (options.identities) this.identitiesToCreate = options.identities
    this.setDirectories(options.stateRoot)
  }
}

export class DockerizedScrtNode_1_2 extends DockerizedScrtNode {
  readonly chainId: string = 'supernova-1-localnet'
  readonly image:   string = "enigmampc/secret-network-node:v1.2.0-beta1-2-gbe1ca55e-testnet"
  constructor (options: ChainNodeOptions = {}) {
    super()
    if (options.image) this.image = options.image
    if (options.chainId) this.chainId = options.chainId
    if (options.identities) this.identitiesToCreate = options.identities
    this.setDirectories(options.stateRoot)
  }
}

export function resetLocalnet ({ chain }: any) {
  return chain.node.terminate()
}
