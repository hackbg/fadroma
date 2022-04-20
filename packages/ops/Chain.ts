import { Console, bold, resolve, relative, Directory, JSONDirectory } from '@hackbg/toolbox'
import { URL } from 'url'
import { Identity } from './Core'
import { Devnet } from './Devnet'
import { Agent, AgentConstructor } from './Agent'
import { Deployments } from './Deploy'
import { Uploads } from './Upload'
import { config } from './Config'
import { Mocknet } from './Mocknet'

const console = Console('@fadroma/ops/Chain')

export enum ChainMode {
  Mainnet = 'Mainnet',
  Testnet = 'Testnet',
  Devnet  = 'Devnet',
  Mocknet = 'Mocknet'
}

export interface ChainConfig {
  statePath?:       string
  mode?:            ChainMode
  node?:            Devnet
  defaultIdentity?: Identity
  apiURL?:          URL
}

export interface ChainConstructor extends Chain {}

/** Represents an interface to a particular Cosmos blockchain;
  * used to construct `Agent`s that are bound to it.
  * Can store identities of agents,
  * and receipts from contract uploads/inits. */
export class Chain implements ChainConfig {

  /** Populated in Fadroma root with connection details for
    * all Chain variants that are known to the library. */
  static namedChains: Record<string, Function> = {}

  static async getNamed (name = config.chain, options?) {
    console.log({name, options})
    if (!name || !this.namedChains[name]) {
      console.error('Chain.getNamed: pass a known chain name or set FADROMA_CHAIN env var.')
      console.info('Known chain names:')
      for (const chain of Object.keys(Chain.namedChains).sort()) {
        console.info(`  ${chain}`)
      }
      throw new Error('Chain.getNamed: pass a known chain name or set FADROMA_CHAIN env var.')
    }
    return await this.namedChains[name](options)
  }

  constructor (
    public readonly id: string,
    options: ChainConfig = {}
  ) {
    if (!id) {
      throw new Error('Chain: need to pass chain id')
    }
    const {
      mode,
      node,
      apiURL,
      statePath = resolve(config.projectRoot, 'receipts', id),
      defaultIdentity
    } = options
    this.mode = mode
    if (node) {
      if (!this.isDevnet) {
        throw new Error('Chain: `node` option only supported when `mode === "Devnet"`')
      }
      if (apiURL && apiURL.toString() !== node.apiURL.toString()) {
        console.warn(
          `Chain: passed apiURL ${apiURL.toString()}, but using node.apiURL ${node.apiURL.toString()}`
        )
      }
      this.node = node
      this.node.chainId = this.id
      this.apiURL = this.node.apiURL
    } else {
      this.apiURL = apiURL
    }
    this.stateRoot    = new Directory(statePath)
    this.identities   = this.stateRoot.subdir('identities',   JSONDirectory)
    this.uploads      = this.stateRoot.subdir('uploads',      Uploads)
    this.uploads.make()
    this.deployments  = this.stateRoot.subdir('deployments',  Deployments)
    this.transactions = this.stateRoot.subdir('transactions', JSONDirectory)
    this.transactions.make()
    this.defaultIdentity = options.defaultIdentity
  }

  /** The API URL that this instance talks to, as URL object. */
  apiURL:           URL

  /** Set the chain type flags. */
  mode:             ChainMode

  /** Optional. Instance of Devnet representing the devnet container. */
  node?:            Devnet

  /** Root state directory for this chain. */
  stateRoot:        Directory

  /** This directory collects all private keys that are available for use. */
  identities:       Directory

  /** This directory collects transaction messages. */
  transactions:     Directory

  /** This directory stores receipts from the upload transactions,
    * containing provenance info for uploaded code blobs. */
  uploads:          Uploads

  /** This directory stores receipts from the instantiation transactions,
    * containing provenance info for initialized contract deployments. */
  deployments:      Deployments

  /** Credentials of the default agent for this network. */
  defaultIdentity?: Identity

  /** Agent class suitable for this chain. */
  Agent:            AgentConstructor

  /** A mainnet is a production network with real stakes. */
  get isMainnet (): boolean {
    return this.mode === ChainMode.Mainnet
  }

  /** A testnet is a persistent remote non-production network. */
  get isTestnet (): boolean {
    return this.mode === ChainMode.Testnet
  }

  /** A devnet is a non-production network that we can reset at will. */
  get isDevnet (): boolean {
    return this.mode === ChainMode.Devnet
  }

  /* c8 ignore start */
  /** A mocknet is a WASM execution environment
    * without the cryptographic consensus mechanism.
    * This is useful for testing. */
  get isMocknet (): boolean {
    // TODO finish implementation in @fadroma/mocknet
    console.warn('chain.isMocknet: mocknet not implemented yet')
    return this.mode === ChainMode.Mocknet
  }
  /* c8 ignore stop */

  /** Create agent operating via this chain's API endpoint. */
  async getAgent (identity = this.defaultIdentity): Promise<Agent> {
    if (!(identity.keyPair || identity.mnemonic)) {
      if (identity.name && this.node) {
        console.info(bold(`Using devnet genesis account:`), identity.name)
        identity = await this.node.getGenesisAccount(identity.name)
      } else {
        throw new Error('Chain#getAgent: pass { keyPair } or { mnemonic } to get an agent')
      }
    }
    return await this.Agent.create(this, identity)
  }

  getNonce (address: string): Promise<any> {
    throw new Error('not implemented')
  }

  /** Address of faucet that can be used to get gas tokens.
    * There used to be an `openFaucet` command.
    * TODO automate refill. */
  faucet: string|null = null

}
