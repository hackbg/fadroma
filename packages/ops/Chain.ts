import {
  Directory, JSONDirectory,
  Console, bold, symlinkDir, mkdirp, resolve, relative, basename,
  readdirSync, statSync, existsSync, readlinkSync, readFileSync, unlinkSync,
  colors
} from '@hackbg/tools'

import { URL } from 'url'

import { Identity } from './Core'
import { ChainNode } from './ChainNode'
import { Agent, AgentConstructor, BaseAgent, MockAgent } from './Agent'
import { Contract } from './Contract'
import { Deployments } from './Deploy'
import { Uploads } from './Upload'

const console = Console('@fadroma/ops/Chain')

export interface ChainOptions {
  chainId?: string
  apiURL?:  URL
  node?:    ChainNode

  /** Credentials of the default agent for this network. */
  defaultIdentity?: DefaultIdentity
}

export type DefaultIdentity =
  null |
  string |
  { name?: string, address?: string, mnemonic?: string } |
  Agent

export interface ChainConnectOptions extends ChainOptions {
  apiKey?:     string
  identities?: Array<string>
}

export interface Chain extends ChainOptions {
  readonly isMainnet?:   boolean
  readonly isTestnet?:   boolean
  readonly isLocalnet?:  boolean
  readonly url:          string
  readonly ready:        Promise<this>
  readonly stateRoot?:   string|Directory
  readonly identities?:  Directory
  readonly uploads?:     Directory
  readonly deployments?: Deployments
  Agent:          AgentConstructor
  getAgent        (options?: Identity): Promise<Agent>
  getContract <T> (api: new()=>T, address: string, agent: Agent): T
  printIdentities (): void
  buildAndUpload  (uploader: Agent, contracts: Contract[]): Promise<Contract[]>
}

export async function initChainAndAgent (
  CHAINS:    Record<string, Function>,
  chainName: string,
): Promise<{ chain: Chain, agent: Agent }> {
  let chain: Chain
  if (!CHAINS[chainName]) {
    throw new Error(`${bold(`"${chainName}":`)} not a valid chain name`)
  }
  chain = await CHAINS[chainName]().ready
  let agent: Agent
  try {
    if (chain.defaultIdentity instanceof BaseAgent) {
      agent = chain.defaultIdentity
    } else {
      agent = await chain.getAgent()
    }
    console.info(bold(`Agent:   `), agent.address)
    try {
      const initialBalance = await agent.balance
      console.info(bold(`Balance: `), initialBalance, `uscrt`)
    } catch (e) {
      console.warn(bold(`Could not fetch balance:`), e.message)
    }
  } catch (e) {
    console.error(bold(`Could not get an agent for ${chainName}:`), e.message)
    throw e
  }
  return { chain, agent }
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
    console.log(k, obj[k], options[k], defaults[k].apply(obj))
    obj[k] = obj[k] || ((k in options) ? options[k] : defaults[k].apply(obj))
  }
}

/** Represents an interface to a particular Cosmos blockchain.
  * Used to construct `Agent`s and `Contract`s that are
  * bound to a particular chain. Can store identities and
  * results of contract uploads/inits. */
export abstract class BaseChain implements Chain {

  // JS constructors are called in an order that is opposite to
  // the one that would be actually useful for narrowing down stuff
  // by defining properties (as opposed to extending stuff with new stuff).
  constructor (options?: Chain) {
    if (this.node)      this.setNode()
    if (this.stateRoot) this.setDirs()
  }

  protected setNode () {
    if (this.node) {
      this.apiURL  = this.node.apiURL
      this.chainId = this.node.chainId
    }
  }

  protected setDirs (stateRoot = resolve(process.cwd(), 'receipts', this.chainId)) {
    console.info(bold(`Receipts:`), relative(process.cwd(), stateRoot))
    if (!stateRoot) {
      throw new Error('@fadroma/ops/chain: Missing stateRoot')
    }
    if (typeof stateRoot === 'string') {
      this.stateRoot = new Directory(stateRoot)
    } else {
      this.stateRoot = stateRoot
    }
    this.identities  = new JSONDirectory(this.stateRoot.path, 'identities')
    this.uploads     = new Uploads(this.stateRoot.path, 'uploads')
    this.deployments = new Deployments(this.stateRoot.path, 'deployments')
  }

  #ready: Promise<any>|null = null
  get ready () {
    if (this.#ready) return this.#ready
    return this.#ready = this.#init()
  }

  /**Instantiate Agent and Builder objects to talk to the API,
   * respawning the node container if this is a localnet. */
  async #init (): Promise<Chain> {
    // if this is a localnet handle, wait for the localnet to start
    const node = await Promise.resolve(this.node)
    console.info(bold('Chain ID:'), this.chainId)
    if (node) {
      await this.initLocalnet(node)
    }
    const { protocol, hostname, port } = this.apiURL
    console.info(bold(`Protocol:`), protocol)
    console.info(bold(`Host:    `), `${hostname}:${port}`)
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

  apiURL:      URL

  /**The API URL that this instance talks to.
   * @type {string} */
  get url () { return this.apiURL.toString() }

  chainId:     string
  node?:       ChainNode

  isMainnet?:  boolean
  isTestnet?:  boolean
  isLocalnet?: boolean

  Agent: AgentConstructor

  /** Credentials of the default agent for this network. */
  defaultIdentity?: DefaultIdentity

  /** create agent operating on the current instance's endpoint*/
  async getAgent (identity: string|Identity = this.defaultIdentity): Promise<Agent> {
    if (identity instanceof BaseAgent) {
      return await this.Agent.create(identity)
    }
    if (typeof identity === 'string' && this.node) {
      identity = this.node.genesisAccount(identity)
    }
    return await this.Agent.create({ ...identity, chain: this as Chain })
  }

  /** This directory contains all the others. */
  stateRoot:  Directory

  /** This directory stores all private keys that are available for use. */
  identities: Directory

  printIdentities () {
    console.log('\nAvailable identities:')
    for (const identity of this.identities.list()) {
      console.log(`  ${this.identities.load(identity).address} (${bold(identity)})`)
    }
  }

  /** This directory stores receipts from the upload transactions,
    * containing provenance info for uploaded code blobs. */
  uploads:     Uploads

  /** This directory stores receipts from the instantiation (init) transactions,
    * containing provenance info for initialized contract deployments.
    *
    * NOTE: the current domain vocabulary considers initialization and instantiation,
    * as pertaining to contracts on the blockchain, to be the same thing. */
  deployments: Deployments

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

  async buildAndUpload (
    uploader:  Agent,
    contracts: Contract[]
  ) {
    await Promise.all(contracts.map(contract=>contract.build()))
    for (const contract of contracts) {
      await contract.upload(this, uploader)
    }
    return contracts
  }

}

export class Mocknet extends BaseChain {
  chainId    = 'mocknet'
  isLocalnet = true
  apiURL     = new URL('mock://mock:0')
  stateRoot  = new Directory(`/tmp/fadroma_mocknet_${Math.floor(Math.random()*1000000)}`)
  Agent      = MockAgent
  constructor () {
    super()
    this.setDirs()
  }
}
