import {
  Console, bold,
  resolve, relative,
  Directory, JSONDirectory,
} from '@hackbg/tools'
import { URL } from 'url'
import { Identity } from './Core'
import { ChainNode } from './ChainNode'
import { Agent, AgentConstructor } from './Agent'
import { Deployments } from './Deploy'
import { Uploads } from './Upload'
import { print } from './Print'

const console = Console('@fadroma/ops/Chain')

/** Kludge. TODO resolve. */
export type DefaultIdentity =
  null   |
  string |
  { name?: string, address?: string, mnemonic?: string } |
  Agent

export type ChainStateConfig = {
  statePath?: string
}

export type ChainTypeFlags = {
  isMainnet?:  boolean
  isTestnet?:  boolean
  isLocalnet?: boolean
}

export type ChainNodeConfig = {
  node?: ChainNode
}

export type ChainIdentityConfig = {
  defaultIdentity?: DefaultIdentity
}

export type ChainAPIConfig = {
  apiURL?: URL
}

export type ChainConfig =
  ChainTypeFlags      &
  ChainStateConfig    &
  ChainNodeConfig     &
  ChainIdentityConfig &
  ChainAPIConfig

/** Represents an interface to a particular Cosmos blockchain;
  * used to construct `Agent`s that are bound to it.
  * Can store identities of agents,
  * and receipts from contract uploads/inits. */
export class Chain implements ChainConfig {

  /** Populated in Fadroma root with connection details for
    * all Chain variants that are known to the library. */
  static namedChains: Record<string, (options?: Chain)=>Chain> = {}

  constructor (
    public readonly id: string,
    options?: ChainConfig
  ) {
    console.info(bold('Chain ID: '), id)
    this.initAPIURL(options)
    this.initChainType(options)
    this.initChainNode(options)
    this.initStateDirs(options)
    this.initDefaultIdentity(options)
  }

  protected initAPIURL ({ apiURL }: ChainAPIConfig) {
    this.apiURL = apiURL
  }

  /** The API URL that this instance talks to, as URL object. */
  apiURL: URL = new URL('http://localhost')

  /** The API URL that this instance talks to, as string. */
  get url (): string { return this.apiURL.toString() }

  /** Set the chain type flags. */
  protected initChainType ({ isMainnet, isTestnet, isLocalnet }: ChainTypeFlags) {
    this.isMainnet  = isMainnet
    this.isTestnet  = isTestnet
    this.isLocalnet = isLocalnet
  }

  /** A mainnet is a production network with real stakes. */
  isMainnet?:  boolean

  /** A testnet is a persistent remote non-production network. */
  isTestnet?:  boolean

  /** A localnet is a non-production network that we can reset at will. */
  isLocalnet?: boolean

  protected initChainNode ({ node }: ChainNodeConfig) {
    if (!node) {
      console.info('This Chain does not have a ChainNode attached')
      return
    }
    this.node = node
    this.node.chainId = this.id
    if (this.apiURL && this.apiURL !== node.apiURL) {
      console.warn(
        bold('API URL mismatch:'), this.apiURL, 'vs', node.apiURL
      )
    }
    this.apiURL  = node.apiURL
  }

  /** Optional. Instance of ChainNode representing the localnet container. */
  node?: ChainNode

  protected initStateDirs ({
    statePath = resolve(process.cwd(), 'receipts', this.id)
  }: ChainStateConfig) {
    console.info(
      bold(`State:    `),
      relative(process.cwd(), statePath)
    )
    this.stateRoot    = new Directory(statePath)
    this.identities   = new JSONDirectory(statePath, 'identities')
    this.transactions = new JSONDirectory(statePath, 'transactions')
    this.uploads      = new Uploads(statePath,       'uploads')
    this.deployments  = new Deployments(statePath,   'deployments')
    this.transactions.make()
  }

  /** Root state directory for this chain. */
  stateRoot:    Directory

  /** This directory collects all private keys that are available for use. */
  identities:   Directory

  /** This directory collects transaction messages. */
  transactions: Directory

  /** This directory stores receipts from the upload transactions,
    * containing provenance info for uploaded code blobs. */
  uploads:      Uploads

  /** This directory stores receipts from the instantiation transactions,
    * containing provenance info for initialized contract deployments. */
  deployments:  Deployments

  #ready: Promise<any>|null = null
  // async constructor shim
  get ready () {
    if (this.#ready) return this.#ready
    return this.#ready = this.#respawn()
  }

  /** If this is a localnet, wait for the container to respawn,
    * unless we're running in dockerized live mode. */
  async #respawn (): Promise<Chain> {
    const node = await Promise.resolve(this.node)
    if (process.env.FADROMA_DOCKERIZED) {
      this.apiURL = new URL('http://localnet:1317')
    } else if (node) {
      await this.initLocalnet(node)
    }
    return this as Chain
  }

  private initDefaultIdentity ({ defaultIdentity }: ChainIdentityConfig) {
    if (typeof defaultIdentity === 'string') {
      if (this.isLocalnet) {
        try {
          defaultIdentity = this.node.genesisAccount(defaultIdentity)
        } catch (e) {
          console.warn(`Could not load default identity ${defaultIdentity}: ${e.message}`)
        }
      }
      this.defaultIdentity = defaultIdentity
    } else {
      console.info('This Chain does not have a defaultIdentity')
    }
  }

  /** Credentials of the default agent for this network. */
  defaultIdentity?: DefaultIdentity

  private async initLocalnet (node: ChainNode) {
    // keep a handle to the node in the chain
    this.node = node
    // respawn that container
    await node.respawn()
    await node.ready
    // set the correct port to connect to
    this.apiURL.port = String(node.port)
    // get the default account for the node
    this.initDefaultIdentity({})
  }

  /** Agent class suitable for this chain. */
  Agent: AgentConstructor

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

  getNonce (address: string): Promise<any> {
    throw new Error('not implemented')
  }

  /** Address of faucet that can be used to get gas tokens.
    * There used to be an `openFaucet` command.
    * TODO automate refill. */
  faucet: string|null = null

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
