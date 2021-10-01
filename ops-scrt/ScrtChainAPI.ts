import type {
  ChainNode, ChainState, ChainConnectOptions,
  Identity, Agent
} from '@fadroma/ops'
import type { Commands } from '@fadroma/tools'

import { URL } from 'url'

import { Chain, ChainInstancesDir, prefund } from '@fadroma/ops'
import { ScrtCLIAgent, ScrtAgentJS, ScrtAgentJS_1_0, ScrtAgentJS_1_2 } from './index'
import { Directory, JSONDirectory, bold, open, defaultStateBase, resolve, table, noBorders } from '@fadroma/tools'
import { resetLocalnet } from './ScrtChainNode'

import { DockerizedScrtNode_1_0, DockerizedScrtNode_1_2 } from './ScrtChainNode'

type AgentConstructor = new (options: Identity) => Agent & {
  create: () => Promise<Agent>
}

export type ScrtChainState = ChainState & {
  Agent?:      AgentConstructor
  identities?: Array<string>
}

export const on = {
  'localnet-1.0' (context: any = {}) {http://bootstrap.supernova.enigma.co/auth/accounts/secret1vdf2hz5f2ygy0z7mesntmje8em5u7vxknyeygy
    console.info(`Running on ${bold('localnet-1.0')}:`)
    context.chain = Scrt.localnet_1_0() },
  'localnet-1.2' (context: any = {}) {
    console.info(`Running on ${bold('localnet-1.2')}:`)
    context.chain = Scrt.localnet_1_2() },
  'holodeck-2' (context: any = {}) {
    console.info(`Running on ${bold('holodeck-2')}:`)
    context.chain = Scrt.holodeck_2() },
  'supernova-1' (context: any = {}) {
    console.info(`Running on ${bold('supernova-1')}:`)
    context.chain = Scrt.supernova_1() },
  'secret-2' (context: any = {}) {
    console.info(`Running on ${bold('secret-2')}:`)
    context.chain = Scrt.secret_2() },
  'secret-3' (context: any = {}) {
    console.info(`Running on ${bold('secret-3')}:`)
    context.chain = Scrt.secret_3() } }

export function openFaucet () {
  const url = `https://faucet.secrettestnet.io/`
  console.debug(`Opening ${url}...`)
  open(url) }

type RemoteCommands = (x: Chain) => Commands

export const Help = {
  RESET:   "✨ Erase the state of this localnet",
  MAINNET: "💰 Interact with the Secret Network mainnet",
  FAUCET:  "🚰 Open a faucet for this network in your default browser",
  FUND:    "👛 Create test wallets by sending native token to them" }

const {
  SCRT_API_URL,
  SCRT_AGENT_NAME,
  SCRT_AGENT_ADDRESS,
  SCRT_AGENT_MNEMONIC
} = process.env

export class Scrt extends Chain {

  static mainnetCommands = (getCommands: RemoteCommands): Commands =>
    [['secret-2', Help.MAINNET, on['secret-2'], getCommands(Scrt.secret_2())]
    ,['secret-3', Help.MAINNET, on['secret-3'], getCommands(Scrt.secret_3())]]

  /** Create an instance that talks to to the Secret Network mainnet via secretcli */
  static secret_2 (options: ChainConnectOptions = {}): Scrt {
    const {
      chainId = 'secret-2',
      apiKey  = '5043dd0099ce34f9e6a0d7d6aa1fa6a8',
      apiURL  = new URL(SCRT_API_URL||`https://secret-2--lcd--full.datahub.figment.io:443/apikey/${apiKey}/`),
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
    }) }

  /** Create an instance that talks to to the Secret Network mainnet via secretcli */
  static secret_3 (options: ChainConnectOptions = {}): Scrt {
    const {
      chainId = 'secret-3',
      apiKey  = '5043dd0099ce34f9e6a0d7d6aa1fa6a8',
      apiURL  = new URL(SCRT_API_URL||`https://secret-3--lcd--full.datahub.figment.io:443/apikey/${apiKey}/`),
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
    }) }

  /** Generate command lists for known testnets. */
  static testnetCommands = (getCommands: RemoteCommands): Commands =>
    ['holodeck-2', 'supernova-1'].map((testnet: string)=>[
      testnet,
      `Run commands on ${testnet} testnet`,
      on[testnet],
      [ ["faucet", Help.FAUCET, openFaucet]
      , ["fund",   Help.FUND,   prefund]
      , ...getCommands(Scrt[testnet.replace(/[-.]/g, '_')]())]])

  /** Create an instance that talks to holodeck-2 testnet via SecretJS */
  static holodeck_2 (options: ChainConnectOptions = {}): Scrt {
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
    }) }

  /** Create an instance that talks to to supernova-1 testnet via SecretJS */
  static supernova_1 (options: ChainConnectOptions = {}): Scrt {
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
    }) }

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

  /** Create an instance that runs a node in a local Docker container
   *  and talks to it via SecretJS */
  static localnet_1_0 (options: ChainConnectOptions = {}): Scrt {
    // no default agent name/address/mnemonic:
    // connect() gets them from genesis accounts
    return new Scrt({
      isLocalnet: true,
      node:    options.node    || new DockerizedScrtNode_1_0({ identities: options.identities }),
      chainId: options.chainId || 'enigma-pub-testnet-3',
      apiURL:  options.apiURL  || new URL('http://localhost:1337'),
      Agent:   ScrtAgentJS_1_0
    }) }

  /** Create an instance that runs a node in a local Docker container
   *  and talks to it via SecretJS */
  static localnet_1_2 (options: ChainConnectOptions = {}): Scrt {
    // no default agent name/address/mnemonic:
    // connect() gets them from genesis accounts
    return new Scrt({
      isLocalnet: true,
      ...options,
      node:    options.node    || new DockerizedScrtNode_1_2(options),
      chainId: options.chainId || 'enigma-pub-testnet-3',
      apiURL:  options.apiURL  || new URL('http://localhost:1337'),
      Agent:   ScrtAgentJS_1_0
    }) }

  chainId?: string
  apiURL?:  URL
  node?:    ChainNode

  Agent: AgentConstructor
  defaultIdentity: null | string | { name?: string, address?: string, mnemonic?: string } | Agent

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

  #ready: Promise<any>
  get ready () {
    if (this.#ready) return this.#ready
    return this.#ready = this.init() }

  /**Instantiate Agent and Builder objects to talk to the API,
   * respawning the node container if this is a localnet. */
  async init (): Promise<Chain> {
    console.warn('@fadroma/ops-scrt: Chain#init is deprecated, use "await new Chain().ready" for one-time initialization')
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
      const { mnemonic, address } = this.defaultIdentity
      this.defaultIdentity = await this.getAgent({ name: "ADMIN", mnemonic, address })
      console.info(`🟢 operating as ${address}`)
    }
    return this as Chain
  }

  /**The API URL that this instance talks to.
   * @type {string} */
  get url () {
    return this.apiURL.toString() }

  /** create agent operating on the current instance's endpoint*/
  async getAgent (identity: string|Identity = this.defaultIdentity): Promise<Agent> {
    if (typeof identity === 'string') identity = this.node.genesisAccount(identity)
    if (identity.mnemonic || identity.keyPair) {
      console.info(`Using a ${bold('SecretJS')}-based agent.`)
      return await this.Agent.create({ ...identity, chain: this as Chain }) }
    else {
      const name = identity.name || this.defaultIdentity?.name
      if (name) {
        console.info(`Using a ${bold('secretcli')}-based agent.`)
        return new ScrtCLIAgent({ chain: this, name }) as Agent }
      else throw new Error(
        'You need to provide a name to get a secretcli-backed agent, ' +
        'or a mnemonic or keypair to get a SecretJS-backed agent.')}}

  /** create contract instance from interface class and address */
  getContract (ContractAPI: any, contractAddress: string, agent = this.defaultIdentity) {
    return new ContractAPI({
      initTx: { contractAddress }, // TODO restore full initTx if present in artifacts
      agent }) }

  printStatusTables () {
    const id = bold(this.chainId)
    if (this.uploadsTable.length > 1) {
      console.log(`\nUploaded binaries on ${id}:`)
      console.log('\n' + table(this.uploadsTable, noBorders)) }
    else {
      console.log(`\n  No known uploaded binaries on ${id}`) }
    if (this.instancesTable.length > 1) {
      console.log(`Instantiated contracts on ${id}:`)
      console.log('\n' + table(this.instancesTable, noBorders)) }
    else {
      console.log(`\n  No known contracts on ${id}`) } }

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
        rows.push(row) } }
    return rows.sort((x,y)=>x[0]-y[0]) }

  /** List of contracts in human-readable from */
  private get instancesTable () {
    const rows = []
    rows.push([bold('  label')+'\n  address', 'code id', 'code hash\ninit tx\n'])
    if (this.instances.exists()) {
      for (const name of this.instances.list()) {
        const row = []
            , { codeId
              , codeHash
              , initTx: {contractAddress, transactionHash} } = this.instances.load(name)
        row.push(`  ${bold(name)}\n  ${contractAddress}`)
        row.push(String(codeId))
        row.push(`${codeHash}\n${transactionHash}\n`)
        rows.push(row) } }
    return rows } }
