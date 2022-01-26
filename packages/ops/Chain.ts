import {
  Directory, JSONDirectory,
  Console, bold, symlinkDir, mkdirp, resolve, basename,
  readdirSync, statSync, existsSync, readlinkSync, readFileSync, unlinkSync,
  colors
} from '@hackbg/tools'

import { URL } from 'url'

import type { ChainNode } from './ChainNode'
import { Agent, AgentConstructor, BaseAgent } from './Agent'
import type { ContractBuild } from './Build'
import type { ContractUpload } from './Upload'
import type { Contract } from './Contract'
import type { ContractConstructor } from './Deployment'
import { DeploymentDir } from './Deployment'

const console = Console('@fadroma/ops/Chain')

export type DefaultIdentity =
  null |
  string |
  { name?: string, address?: string, mnemonic?: string } |
  Agent

export interface ChainOptions {
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

export interface ChainState extends ChainOptions {
  readonly isMainnet?:  boolean
  readonly isTestnet?:  boolean
  readonly isLocalnet?: boolean
  readonly stateRoot?:  string
  readonly identities?: string
  readonly uploads?:    string
  readonly instances?:  string
}

export interface Chain extends ChainOptions {
  readonly isMainnet?:   boolean
  readonly isTestnet?:   boolean
  readonly isLocalnet?:  boolean
  readonly url:          string
  readonly ready:        Promise<this>
  readonly stateRoot?:   Directory
  readonly identities?:  Directory
  readonly uploads?:     Directory
  readonly deployments?: DeploymentDir
  getAgent (options?: Identity): Promise<Agent>
  getContract<T> (api: new()=>T, address: string, agent: Agent): T
  printIdentities (): void
  buildAndUpload (contracts: Contract[]): Promise<Contract[]>
}

export type DefaultIdentity =
  null |
  string |
  { name?: string, address?: string, mnemonic?: string } |
  Agent

/* Represents an interface to a particular Cosmos blockchain.
 * Used to construct `Agent`s and `Contract`s that are
 * bound to a particular chain. */
export abstract class BaseChain implements Chain {

  apiURL:      URL

  /**The API URL that this instance talks to.
   * @type {string} */
  get url () { return this.apiURL.toString() }

  chainId:     string
  node?:       ChainNode
  isMainnet?:  boolean
  isTestnet?:  boolean
  isLocalnet?: boolean

  /** Interface to a Secret Network REST API endpoint.
   *  Can store identities and results of contract uploads/inits.
   * @constructor
   * @param {Object} options           - the configuration options
   * @param {string} options.chainId   - the internal ID of the chain running at that endpoint
   * TODO document the remaining options */
  constructor ({
    apiURL    = new URL('http://localhost:1337'),
    node      = null,
    chainId   = node?.chainId,
    stateRoot = resolve(process.cwd(), 'receipts', chainId),
    isMainnet,
    isTestnet,
    isLocalnet,
    Agent,
    defaultIdentity,
  }: ChainState = {}) {
    this.apiURL     = apiURL
    this.chainId    = chainId
    this.isMainnet  = isMainnet
    this.isTestnet  = isTestnet
    this.isLocalnet = isLocalnet

    this.node = node || null
    if (node) {
      this.chainId = node.chainId || this.chainId
      this.apiURL  = node.apiURL  || this.apiURL
    }

    // directories to store state
    this.stateRoot   = new Directory(stateRoot)
    this.identities  = new JSONDirectory(stateRoot, 'identities')
    this.uploads     = new UploadDir(stateRoot, 'uploads')
    this.deployments = new DeploymentDir(stateRoot, 'deployments')

    if (Agent) {
      this.Agent = Agent
    }

    if (defaultIdentity) {
      this.defaultIdentity = defaultIdentity
    }
  }

  /** Stuff that should be in the constructor but is asynchronous.
    * FIXME: How come nobody has proposed sugar for async constructors yet?
    * Feeling like writing a `@babel/plugin-async-constructor`, as always
    * bonus internet points for whoever beats me to it. */
  get ready () {
    if (this.#ready) return this.#ready
    return this.#ready = this.#init()
  }

  #ready: Promise<any>|null = null

  /**Instantiate Agent and Builder objects to talk to the API,
   * respawning the node container if this is a localnet. */
  async #init (): Promise<Chain> {
    // if this is a localnet handle, wait for the localnet to start
    const node = await Promise.resolve(this.node)
    if (node) {
      await this.localnetSetup(node)
    }
    const { protocol, hostname, port } = this.apiURL

    console.info(
      bold(`Connecting to`), this.chainId,
      bold(`via`), protocol,
      bold(`on`), `${hostname}:${port}`
    )

    if (this.defaultIdentity) {
      // default credentials will be used as-is unless using localnet
      const { mnemonic, address } = this.defaultIdentity
      this.defaultIdentity = await this.getAgent({ name: "ADMIN", mnemonic, address })
      console.info(
        `${bold('Default identity:')} ${address}`
      )
    }

    return this as Chain
  }

  private async localnetSetup (node: ChainNode) {

    // keep a handle to the node in the chain
    this.node = node

    console.info(
      bold(`Running on localnet`), this.chainId,
      bold(`@`), this.stateRoot.path
    )

    // respawn that container
    await node.respawn()
    await node.ready

    // set the correct port to connect to
    this.apiURL.port = String(node.port)

    console.info(
      bold(`Localnet ready @ port`), this.apiURL.port
    )

    // get the default account for the node
    if (typeof this.defaultIdentity === 'string') {
      try {
        this.defaultIdentity = this.node.genesisAccount(this.defaultIdentity)
      } catch (e) {
        console.warn(`Could not load default identity ${this.defaultIdentity}: ${e.message}`)
      }
    }

  }

  /** This directory contains all the others. */
  stateRoot:  Directory

  /** This directory stores all private keys that are available for use. */
  identities: Directory

  /** Credentials of the default agent for this network. */
  defaultIdentity?: DefaultIdentity

  printIdentities () {
    console.log('\nAvailable identities:')
    for (const identity of this.identities.list()) {
      console.log(`  ${this.identities.load(identity).address} (${bold(identity)})`)
    }
  }

  Agent: AgentConstructor

  /** Get an Agent that works with this Chain. */
  abstract getAgent (options?: Identity): Promise<Agent>

  /** This directory stores receipts from the upload transactions,
    * containing provenance info for uploaded code blobs. */
  uploads:     UploadDir

  /** This directory stores receipts from the instantiation (init) transactions,
    * containing provenance info for initialized contract deployments.
    *
    * NOTE: the current domain vocabulary considers initialization and instantiation,
    * as pertaining to contracts on the blockchain, to be the same thing. */
  deployments: DeploymentDir

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
    contracts: Contract[]
  ): Promise<Contract[]> {
    for (const contract of Object.values(contracts)) {
      contract.chain = this
    }
    await Promise.all(contracts.map(contract=>contract.buildInDocker()))
    for (const contract of contracts) {
      await contract.upload()
    }
    return contracts
  }

}

export class UploadDir extends JSONDirectory {

  /** List of code blobs in human-readable form */
  table () {

    const rows = []

    // uploads table - lists code blobs
    rows.push([bold('  code id'), bold('name\n'), bold('size'), bold('hash')])

    if (this.exists()) {
      for (const name of this.list()) {

        const {
          codeId,
          originalSize,
          compressedSize,
          originalChecksum,
          compressedChecksum,
        } = this.load(name)

        rows.push([
          `  ${codeId}`,
          `${bold(name)}\ncompressed:\n`,
          `${originalSize}\n${String(compressedSize).padStart(String(originalSize).length)}`,
          `${originalChecksum}\n${compressedChecksum}`
        ])

      }
    }

    return rows.sort((x,y)=>x[0]-y[0])

  }

}

export class Mocknet extends BaseChain {}

export async function init (
  CHAINS:    Record<string, Function>,
  chainName: string,
): Promise<{ chain: Chain, admin: Agent }> {
  let chain: Chain
  let admin: Agent
  if (!chainName || !Object.keys(CHAINS).includes(chainName)) {
    console.log(`\nSelect target chain:`)
    for (const chain of Object.keys(CHAINS)) console.log(`  ${bold(chain)}`)
    process.exit(0)
  }
  chain = CHAINS[chainName]()
  chain = await chain.ready
  try {
    if (chain.defaultIdentity instanceof BaseAgent) {
      admin = chain.defaultIdentity
    } else {
      admin = await chain.getAgent()
    }
    console.info(
      bold(`Commence activity on`), chainName, `(${chain.chainId})`,
      bold('as'), admin.address
    )
    const initialBalance = await admin.balance
    console.info(bold(`Balance:`), initialBalance, `uscrt`)
    //process.on('beforeExit', async () => {
      //const finalBalance = await admin.balance
      //console.info(`Initial balance: ${bold(initialBalance)}uscrt`)
      //console.info(`Final balance: ${bold(finalBalance)}uscrt`)
      //console.info(`Consumed gas: ${bold(String(initialBalance - finalBalance))}uscrt`)
      //process.exit(0)
    //})
    //
  } catch (e) {
    console.warn(`Could not get an agent for ${chainName}: ${e.message}`)
  }
  return { chain, admin }
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

export function needsActiveDeployment ({ chain }) {
  if (!chain.deployments.active) {
    console.log('This command requires a deployment to be selected.')
    process.exit(1)
  } else {
    chain.deployments.printActive()
  }
}
