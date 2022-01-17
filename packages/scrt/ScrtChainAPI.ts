import type { IChain } from '@fadroma/ops'
import {
  IChainNode, IChainState, IChainConnectOptions,
  BaseChain, DeploymentsDir, prefund,
  Identity, IAgent
} from '@fadroma/ops'

import { Commands, Console } from '@hackbg/tools'

import { URL } from 'url'
import { ScrtCLIAgent, ScrtAgentJS, ScrtAgentJS_1_0, ScrtAgentJS_1_2 } from './index'
import { Directory, JSONDirectory, bold, open, resolve, table, noBorders } from '@hackbg/tools'
import { resetLocalnet } from './ScrtChainNode'
import * as Scrt_1_0 from '@fadroma/scrt-1.0'
import * as Scrt_1_2 from '@fadroma/scrt-1.2'

const console = Console(import.meta.url)

type AgentConstructor = new (options: Identity) => IAgent & {
  create: () => Promise<IAgent>
}

export type ScrtChainState = IChainState & {
  Agent?:      AgentConstructor
  identities?: Array<string>
}

export function openFaucet () {
  const url = `https://faucet.secrettestnet.io/`
  console.debug(`Opening ${url}...`)
  open(url) }

type RemoteCommands = (x: IChain) => Commands

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

export class Scrt extends BaseChain {

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
    }) }

  /** Create an instance that talks to to the Secret Network mainnet via secretcli */
  static secret_3 (options: IChainConnectOptions = {}): Scrt {
    const {
      chainId = 'secret-3',
      apiKey  = '5043dd0099ce34f9e6a0d7d6aa1fa6a8',
      apiURL  = new URL(SCRT_API_URL||`https://secret-3--lcd--full.datahub.figment.io/apikey/${apiKey}/`),
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
    const isTestnet = true
    const Agent = ScrtAgentJS_1_0
    return new Scrt({ isTestnet, chainId, apiURL, defaultIdentity, Agent })
  }

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
    const isTestnet = true
    const Agent = ScrtAgentJS_1_2
    return new Scrt({ isTestnet, chainId, apiURL, defaultIdentity, Agent })
  }

  /** Create an instance that talks to to pulsar-1 testnet via SecretJS */
  static pulsar_1 (options: ChainConnectOptions = {}): Scrt {
    const {
      chainId = 'pulsar-1',
      apiURL  = new URL(SCRT_API_URL||'http://testnet.securesecrets.org:1317'),
      defaultIdentity = {
        name:     SCRT_AGENT_NAME,
        address:  SCRT_AGENT_ADDRESS  || 'secret1vdf2hz5f2ygy0z7mesntmje8em5u7vxknyeygy',
        mnemonic: SCRT_AGENT_MNEMONIC || 'genius supply lecture echo follow that silly meadow used gym nerve together'
      }
    } = options
    const isTestnet = true
    const Agent = ScrtAgentJS_1_2
    return new Scrt({ isTestnet, chainId, apiURL, defaultIdentity, Agent })
  }

  /** Create an instance that talks to to pulsar-1 testnet via SecretJS */
  static pulsar_2 (options: ChainConnectOptions = {}): Scrt {
    const {
      chainId = 'pulsar-2',
      apiURL  = new URL(SCRT_API_URL||'http://testnet.securesecrets.org:1317'),
      defaultIdentity = {
        name:     SCRT_AGENT_NAME,
        address:  SCRT_AGENT_ADDRESS  || 'secret1vdf2hz5f2ygy0z7mesntmje8em5u7vxknyeygy',
        mnemonic: SCRT_AGENT_MNEMONIC || 'genius supply lecture echo follow that silly meadow used gym nerve together'
      }
    } = options
    const isTestnet = true
    const Agent = ScrtAgentJS_1_2
    return new Scrt({ isTestnet, chainId, apiURL, defaultIdentity, Agent })
  }

  /** Create an instance that runs a node in a local Docker container
   *  and talks to it via SecretJS */
  static localnet_1_0 (options: ChainConnectOptions = {}): Scrt {
    // no default agent name/address/mnemonic:
    // connect() gets them from genesis accounts
    return new Scrt({
      isLocalnet: true,
      node:    options.node    || new Scrt_1_0.DockerizedScrtNode_1_0({ identities: options.identities }),
      chainId: options.chainId || 'enigma-pub-testnet-3',
      apiURL:  options.apiURL  || new URL('http://localhost:1337'),
      Agent:   ScrtAgentJS_1_0,
      defaultIdentity: 'ADMIN'
    })
  }

  /** Create an instance that runs a node in a local Docker container
   *  and talks to it via SecretJS */
  static localnet_1_2 (options: ChainConnectOptions = {}): Scrt {
    // no default agent name/address/mnemonic:
    // connect() gets them from genesis accounts
    return new Scrt({
      isLocalnet: true,
      ...options,
      node:    options.node    || new Scrt_1_2.DockerizedScrtNode_1_2(options),
      chainId: options.chainId || 'supernova-1',
      apiURL:  options.apiURL  || new URL('http://localhost:1337'),
      Agent:   ScrtAgentJS_1_2,
      defaultIdentity: 'ADMIN'
    })
  }

  chainId?: string
  apiURL?:  URL
  node?:    ChainNode

  Agent: AgentConstructor
  defaultIdentity: null | string | { name?: string, address?: string, mnemonic?: string } | Agent

  stateRoot:  Directory
  identities: JSONDirectory
  uploads:    JSONDirectory
  deployments:  DeploymentsDir

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
    this.chainId = options.chainId || node?.chainId || 'supernova-1'
    this.apiURL  = options.apiURL  || node?.apiURL  || new URL('http://localhost:1337/')

    // directories to store state
    const stateRoot = options.stateRoot || resolve(process.cwd(), 'receipts', this.chainId)
    this.stateRoot  = new Directory(stateRoot)
    this.identities = new JSONDirectory(stateRoot, 'identities')
    this.uploads    = new JSONDirectory(stateRoot, 'uploads')
    this.deployments  = new DeploymentsDir(stateRoot, 'deployments')

    // handle to localnet node if this is localnet
    // default agent credentials
    if (options.Agent) this.Agent = options.Agent
    this.defaultIdentity = options.defaultIdentity
  }

  #ready: Promise<any>|null = null
  get ready () {
    if (this.#ready) return this.#ready
    return this.#ready = this.#init()
  }

  /**Instantiate Agent and Builder objects to talk to the API,
   * respawning the node container if this is a localnet. */
  async #init (): Promise<IChain> {

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
      console.info(`Localnet ready @ port ${bold(this.apiURL.port)}`)

      // get the default account for the node
      if (typeof this.defaultIdentity === 'string') {
        try {
          this.defaultIdentity = this.node.genesisAccount(this.defaultIdentity)
        } catch (e) {
          console.warn(`Could not load default identity ${this.defaultIdentity}: ${e.message}`)
        }
      }

    }

    const { protocol, hostname, port } = this.apiURL
    console.info(`Connecting to ${this.chainId} via ${protocol} on ${hostname}:${port}`)

    if (this.defaultIdentity) {
      // default credentials will be used as-is unless using localnet
      const { mnemonic, address } = this.defaultIdentity
      this.defaultIdentity = await this.getAgent({ name: "ADMIN", mnemonic, address })
      console.info(`Operating as ${address}`)
    }

    return this as IChain
  }

  /**The API URL that this instance talks to.
   * @type {string} */
  get url () { return this.apiURL.toString() }

  /** create agent operating on the current instance's endpoint*/
  async getAgent (
    identity: string|Identity = this.defaultIdentity
  ): Promise<Agent> {

    if (typeof identity === 'string') {
      identity = this.node.genesisAccount(identity)
    }

    const { mnemonic, keyPair } = identity as Identity
    if (mnemonic || keyPair) {
      return await this.Agent.create({ ...identity, chain: this as Chain })
    } else {
      const name = identity.name || this.defaultIdentity?.name
      if (name) {
        console.info(`Using a ${bold('secretcli')}-based agent.`)
        return new ScrtCLIAgent({ chain: this, name }) as Agent
      } else throw new Error(
        'You need to provide a name to get a secretcli-backed agent, ' +
        'or a mnemonic or keypair to get a SecretJS-backed agent.'
      )
    }

  }

  /** create contract instance from interface class and address */
  getContract (
    ContractAPI:     any,
    contractAddress: string,
    agent = this.defaultIdentity
  ) {
    return new ContractAPI({
      initTx: { contractAddress }, // TODO restore full initTx if present in artifacts
      agent
    })
  }

  printStatusTables () {

    const id = bold(this.chainId)

    if (this.uploadsTable.length > 1) {
      console.info(`Uploaded binaries on ${id}:`)
      console.log('\n' + table(this.uploadsTable, noBorders))
    } else {
      console.info(`No known uploaded binaries on ${id}`)
    }

    if (this.deploymentsTable.length > 1) {
      console.info(`Instantiated contracts on ${id}:`)
      console.log('\n' + table(this.deploymentsTable, noBorders))
    } else {
      console.info(`\n  No known contracts on ${id}`)
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
  private get deploymentsTable () {
    const rows = []
    rows.push([bold('  label')+'\n  address', 'code id', 'code hash\ninit tx\n'])
    if (this.deployments.exists()) {
      for (const name of this.deployments.list()) {
        const row = []
            , { codeId
              , codeHash
              , initTx: {contractAddress, transactionHash} } = this.deployments.load(name)
        row.push(`  ${bold(name)}\n  ${contractAddress}`)
        row.push(String(codeId))
        row.push(`${codeHash}\n${transactionHash}\n`)
        rows.push(row)
      }
    }
    return rows
  }
}

export const CHAINS: Record<string, (options: IChainConnectOptions)=>IChain> = {
  'localnet-1.0': Scrt.localnet_1_0,
  'localnet-1.2': Scrt.localnet_1_2,
  'holodeck-2':   Scrt.holodeck_2,
  'supernova-1':  Scrt.supernova_1,
  'pulsar-1':     Scrt.pulsar_1,
  'pulsar-2':     Scrt.pulsar_2,
  'secret-2':     Scrt.secret_2,
  'secret-3':     Scrt.secret_3
}

function deprecationWarning () {
  console.warn('This interface is deprecated. Please use the new CLI; if any functionality is missing, port it.')
}
