import {
  Directory, JSONDirectory,
  Console, bold, symlinkDir, mkdirp, resolve, relative, basename,
  readdirSync, statSync, existsSync, readlinkSync, readFileSync, unlinkSync,
  colors
} from '@hackbg/tools'

import { URL } from 'url'

import { Identity, Source, Artifact, Template } from './Core'
import { ChainNode } from './ChainNode'
import { Agent, AgentConstructor } from './Agent'
import { Deployments } from './Deploy'
import { Uploads, CachingFSUploader } from './Upload'
import { printIdentities } from './Print'

const console = Console('@fadroma/ops/Chain')

/** Kludge. TODO resolve. */
export type DefaultIdentity =
  null |
  string |
  { name?: string, address?: string, mnemonic?: string } |
  Agent

export interface ChainOptions {
  id?: string
  chainId?: string
  apiURL?:  URL
  node?:    ChainNode

  /** Credentials of the default agent for this network. */
  defaultIdentity?: DefaultIdentity
}

export interface ChainConnectOptions extends ChainOptions {
  apiKey?:     string
  identities?: Array<string>
}

/** Represents an interface to a particular Cosmos blockchain.
  * Used to construct `Agent`s and `Contract`s that are
  * bound to a particular chain. Can store identities and
  * results of contract uploads/inits. */
export class Chain implements ChainOptions {

  // JS constructors are called in an order that is opposite to
  // the one that would be actually useful for narrowing down stuff
  // by defining properties (as opposed to extending stuff with new stuff).
  constructor (options?: Chain) {
    if (this.node)      this.setNode()
    if (this.stateRoot) this.setDirs()
  }

  protected setNode () {
    if (this.node) {
      this.apiURL = this.node.apiURL
      this.node.chainId = this.id
    }
  }

  protected setDirs (stateRoot = resolve(process.cwd(), 'receipts', this.id)) {
    console.info(bold(`State:    `), relative(process.cwd(), stateRoot))
    if (!stateRoot) {
      throw new Error('@fadroma/ops/chain: Missing stateRoot')
    }
    if (typeof stateRoot === 'string') {
      this.stateRoot = new Directory(stateRoot)
    } else {
      this.stateRoot = stateRoot
    }
    const { path } = this.stateRoot
    this.identities   = new JSONDirectory(path, 'identities')
    this.transactions = new JSONDirectory(path, 'transactions')
    this.uploads      = new Uploads(path,       'uploads')
    this.deployments  = new Deployments(path,   'deployments')
    this.transactions.make()
  }

  /** Root state directory for this chain. */
  stateRoot:  Directory

  /** This directory collects all private keys that are available for use. */
  identities: Directory

  /** This directory collects transaction messages. */
  transactions: Directory

  /** This directory stores receipts from the upload transactions,
    * containing provenance info for uploaded code blobs. */
  uploads:     Uploads

  /** This directory stores receipts from the instantiation (init) transactions,
    * containing provenance info for initialized contract deployments.
    *
    * NOTE: the current domain vocabulary considers initialization and instantiation,
    * as pertaining to contracts on the blockchain, to be the same thing. */
  deployments: Deployments

  #ready: Promise<any>|null = null
  get ready () {
    if (this.#ready) return this.#ready
    return this.#ready = this.#populate()
  }

  /**Instantiate Agent and Builder objects to talk to the API,
   * respawning the node container if this is a localnet. */
  async #populate (): Promise<Chain> {
    // if this is a localnet handle, wait for the localnet to start
    const node = await Promise.resolve(this.node)
    console.info(bold('Chain ID: '), this.id)
    if (node) {
      await this.initLocalnet(node)
    }
    const { protocol, hostname, port } = this.apiURL
    console.info(bold(`Protocol: `), protocol)
    console.info(bold(`Host:     `), `${hostname}:${port}`)
    if (this.defaultIdentity) {
      this.defaultIdentity = await this.getAgent({
        name: "ADMIN", ...this.defaultIdentity as object
      })
    }
    return this as Chain
  }

  private async initLocalnet (node: ChainNode) {
    // keep a handle to the node in the chain
    this.node = node
    // respawn that container
    await node.respawn()
    await node.ready
    // set the correct port to connect to
    this.apiURL.port = String(node.port)
    // get the default account for the node
    if (typeof this.defaultIdentity === 'string') {
      try {
        this.defaultIdentity = this.node.genesisAccount(this.defaultIdentity)
      } catch (e) {
        console.warn(`Could not load default identity ${this.defaultIdentity}: ${e.message}`)
      }
    }
  }

  apiURL: URL = new URL('http://localhost')

  /**The API URL that this instance talks to.
   * @type {string} */
  get url () { return this.apiURL.toString() }

  id:     string
  get chainId () {
    throw new Error('Deprecated: Chain#chainId is now Chain#id, update accordingly')
    return this.id
  }
  set chainId (v) {
    throw new Error('Deprecated: Chain#chainId is now Chain#id, update accordingly')
    this.id = v
  }

  isMainnet?:  boolean
  isTestnet?:  boolean
  isLocalnet?: boolean

  /** Optional. Instance of ChainNode representing the localnet container. */
  node?:            ChainNode

  /** Agent class suitable for this chain. */
  Agent: AgentConstructor

  /** Credentials of the default agent for this network. */
  defaultIdentity?: DefaultIdentity

  /** Create agent operating via this chain's API endpoint. */
  async getAgent (identity: string|Identity = this.defaultIdentity): Promise<Agent> {
    // need to pass something
    if (!identity) {
      throw new Error(`@fadroma/ops/Chain: pass a name or Identity to get an agent on ${this.id}`)
    }
    // clone agent
    if (identity instanceof Agent) {
      return await this.Agent.create(identity)
    }
    // default identities from localnet
    // TODO address from string and something else for default identities
    if (typeof identity === 'string' && this.node) {
      identity = this.node.genesisAccount(identity)
    }
    const agent = await this.Agent.create({ ...identity, chain: this as Chain })
    agent.chain = this
    return agent
  }

  printIdentities () {
    return printIdentities(this)
  }

  /** Create contract instance from interface class and address */
  getContract (
    Contract:        any,
    contractAddress: string,
    agent = this.defaultIdentity
  ) {
    return new Contract({
      initTx: { contractAddress }, // TODO restore full initTx if present in artifacts
      agent
    })
  }

  async buildAll (contracts: Contract<any>[]): Promise<Artifact[]> {
    return Promise.all(contracts.map(contract=>contract.build()))
  }

  async buildAndUpload (agent: Agent, sources: Source[]): Promise<Template[]> {
    const artifacts = await this.buildAll(sources)
    const uploader = new CachingFSUploader(agent, this.uploads)
    return uploader.uploadMany(artifacts)
  }

  /** Populated in Fadroma root with all variants known to the library. */
  static namedChains: Record<string, (options?: Chain)=>Chain> = {}

  /** Get a new Chain and default Agent from a name. */
  static async init (chainName: string): Promise<{ chain: Chain, agent: Agent }> {
    let chain: Chain
    if (!Chain.namedChains[chainName]) {
      throw new Error(`${bold(`"${chainName}":`)} not a valid chain name`)
    }
    chain = await Chain.namedChains[chainName]().ready
    let agent: Agent
    try {
      if (chain.defaultIdentity instanceof Agent) {
        agent = chain.defaultIdentity
      } else {
        agent = await chain.getAgent()
      }
      console.info(bold(`Agent:    `), agent.address)
      try {
        const initialBalance = await agent.balance
        console.info(bold(`Balance:  `), initialBalance, `uscrt`)
      } catch (e) {
        console.warn(bold(`Could not fetch balance:`), e.message)
      }
    } catch (e) {
      console.error(bold(`Could not get an agent for ${chainName}:`), e.message)
      throw e
    }
    return { chain, agent }
  }

  /** Address of faucet that can be used to get gas tokens.
    * There used to be an `openFaucet` command.
    * TODO automate refill. */
  faucet: string|null = null

  getNonce (address: string): Promise<any> { throw new Error('not implemented') }

}

export function notOnMainnet ({ chain }) {
  if (chain.isMainnet) {
    console.log('This command is not intended for mainnet.')
    process.exit(1)
  }
}

export function onlyOnMainnet ({ chain }) {
  if (!chain.isMainnet) {
    console.log('This command is intended only for mainnet.')
    process.exit(1)
  }
}

const overrideDefaults = (obj, defaults, options = {}) => {
  for (const k of Object.keys(defaults)) {
    obj[k] = obj[k] || ((k in options) ? options[k] : defaults[k].apply(obj))
  }
}
