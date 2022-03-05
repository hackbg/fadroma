import {
  Console, bold,
  resolve, relative,
  Directory, JSONDirectory,
} from '@hackbg/tools'
import { URL } from 'url'
import { Identity } from './Core'
import { Devnet } from './Devnet'
import { Agent, AgentConstructor } from './Agent'
import { Deployments } from './Deploy'
import { Uploads } from './Upload'
import { print } from './Print'

const console = Console('@fadroma/ops/Chain')

export enum ChainMode {
  Mainnet = 'Mainnet',
  Testnet = 'Testnet',
  Devnet  = 'Devnet',
  Mocknet = 'Mocknet'
}

/** Kludge. TODO resolve. */
export type DefaultIdentity =
  null   |
  string |
  { name?: string, address?: string, mnemonic?: string } |
  Agent

export type ChainStateConfig = {
  statePath?: string
}

export type ChainModeConfig = {
  mode?: ChainMode
}

export type DevnetConfig = {
  node?: Devnet
}

export type ChainIdentityConfig = {
  defaultIdentity?: DefaultIdentity
}

export type ChainAPIConfig = {
  apiURL?: URL
}

export type ChainConfig =
  ChainModeConfig     &
  ChainStateConfig    &
  DevnetConfig        &
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
    options: ChainConfig = {}
  ) {
    console.info(bold('Chain ID: '), id)
    this.setAPIURL(options)
    this.setChainMode(options)
    this.setDevnet(options)
    this.setStateDirs(options)
    this.setDefaultIdentity(options)
  }

  protected setAPIURL ({ apiURL }: ChainAPIConfig) {
    this.apiURL = apiURL
  }

  /** The API URL that this instance talks to, as URL object. */
  apiURL: URL = new URL('http://localhost')

  /** The API URL that this instance talks to, as string. */
  get url (): string { return this.apiURL.toString() }

  /** Set the chain type flags. */
  protected setChainMode ({ mode }: ChainModeConfig) {
    this.mode = mode
  }

  mode: ChainMode

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

  /** A mocknet is a WASM execution environment
    * without the cryptographic consensus mechanism.
    * This is useful for testing. */
  get isMocknet (): boolean {
    // TODO finish implementation in @fadroma/mocknet
    console.warn('chain.isMocknet: mocknet not implemented yet')
    return this.mode === ChainMode.Mocknet
  }

  protected setDevnet ({ node }: DevnetConfig) {
    if (!node) {
      console.info('This Chain does not have a Devnet attached')
      return
    }
    this.node = node
    this.node.chainId = this.id
    if (this.apiURL && this.apiURL !== node.apiURL) {
      throw new Error(
        `${bold('API URL mismatch:')} ${this.apiURL.toString()}`+
        ` vs ${node.apiURL.toString()}`
      )
    }
    this.apiURL = node.apiURL
  }

  /** Optional. Instance of Devnet representing the devnet container. */
  node?: Devnet

  protected setStateDirs ({
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

  protected setDefaultIdentity ({ defaultIdentity }: ChainIdentityConfig) {
    this.defaultIdentity = defaultIdentity
  }

  /** Credentials of the default agent for this network. */
  defaultIdentity?: DefaultIdentity

  /** Agent class suitable for this chain. */
  Agent: AgentConstructor

  /** Create agent operating via this chain's API endpoint. */
  async getAgent (identity: string|Identity = this.defaultIdentity): Promise<Agent> {
    let agent
    // need to pass something
    if (typeof identity === 'string') {
      if (!this.node) {
        throw new Error(`@fadroma/ops/Chain: can't get defaultIdentity by name`)
      } else {
        agent = await this.Agent.create({
          ...await this.node.getGenesisAccount(identity),
          chain: this as Chain
        })
      }
    } else if (identity instanceof Agent) {
      // clone agent
      agent = await this.Agent.create(identity)
    } else {
      throw new Error(
        `@fadroma/ops/Chain: pass a name or Identity to get an agent on ${this.id}`
      )
    }
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
