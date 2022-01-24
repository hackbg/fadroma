import {
  Directory, JSONDirectory,
  Console, bold, symlinkDir, mkdirp, resolve, basename,
  readdirSync, statSync, existsSync, readlinkSync, readFileSync, unlinkSync,
  colors
} from '@hackbg/tools'

import type {
  IChain,
  IChainNode,
  IChainState,
  Identity,
  IAgent,
  IContract,
  ContractConstructor,
  ContractBuild,
  ContractUpload
} from './Model'

import { DeploymentDir } from './Deployment'

import { URL } from 'url'

const console = Console('@fadroma/ops/Chain')

export type DefaultIdentity =
  null |
  string |
  { name?: string, address?: string, mnemonic?: string } |
  IAgent

export type AgentConstructor = new (options: Identity) => IAgent & {
  create: () => Promise<IAgent>
}

/* Represents an interface to a particular Cosmos blockchain.
 * Used to construct `Agent`s and `Contract`s that are
 * bound to a particular chain. */
export abstract class BaseChain implements IChain {

  chainId?:    string
  apiURL?:     URL
  node?:       IChainNode
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
    node      = null,
    chainId   = node?.chainId,
    stateRoot = resolve(process.cwd(), 'receipts', chainId),
    isMainnet,
    isTestnet,
    isLocalnet,
    Agent,
    defaultIdentity,
  }: IChainState = {}) {
    this.chainId    = chainId
    this.isMainnet  = isMainnet
    this.isTestnet  = isTestnet
    this.isLocalnet = isLocalnet
    this.node = node || null
    if (node) {
      this.chainId = node.chainId
      this.apiURL  = node.apiURL
    }

    // directories to store state
    this.stateRoot   = new Directory(stateRoot)
    this.identities  = new JSONDirectory(stateRoot, 'identities')
    this.uploads     = new UploadDir(stateRoot, 'uploads')
    this.deployments = new DeploymentDir(stateRoot, 'deployments')

    if (Agent) this.Agent = Agent
    if (defaultIdentity) this.defaultIdentity = defaultIdentity
  }

  /** Stuff that should be in the constructor but is asynchronous.
    * FIXME: How come nobody has proposed sugar for async constructors yet?
    * Feeling like writing a `@babel/plugin-async-constructor`, as always
    * bonus internet points for whoever beats me to it. */
  abstract readonly ready: Promise<this>

  /**The API URL that this instance talks to.
   * @type {string} */
  get url () { return this.apiURL.toString() }

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
  abstract getAgent (options?: Identity): Promise<IAgent>

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

  async buildAndUpload (contracts: Array<ContractBuild & ContractUpload>) {
    for (const contract of Object.values(contracts)) {
      contract.chain = this
    }
    await Promise.all(contracts.map(contract=>contract.build()))
    for (const contract of contracts) {
      await contract.upload()
    }
  }

  printStatusTables () {

    const id = bold(this.chainId)

    const uploadsTable = this.uploads.table()
    if (uploadsTable.length > 1) {
      console.info(`Uploaded binaries on ${id}:`)
      console.log('\n' + table(uploadsTable, noBorders))
    } else {
      console.info(`No known uploaded binaries on ${id}`)
    }

    const deploymentsTable = this.deployments.table()
    if (deploymentsTable.length > 1) {
      console.info(`Instantiated contracts on ${id}:`)
      console.log('\n' + table(deploymentsTable, noBorders))
    } else {
      console.info(`\n  No known contracts on ${id}`)
    }

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
