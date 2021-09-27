import type { ChainNode } from './ChainNode'
import type { Identity, Agent } from './Agent'

import { URL } from 'url'
import { Directory, symlinkDir, mkdirp } from '@fadroma/tools'

import { readdirSync, statSync, existsSync, readlinkSync, readFileSync, unlinkSync } from 'fs'
import { resolve, basename } from 'path'

export interface ChainOptions {
  chainId?: string
  apiURL?:  URL
  node?:    ChainNode
  defaultIdentity?: Identity
}

export interface ChainConnectOptions extends ChainOptions {
  apiKey?: string
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

/* Represents an interface to a particular Cosmos blockchain.
 * Used to construct `Agent`s and `Contract`s that are
 * bound to a particular chain. */
export abstract class Chain implements ChainOptions {
  chainId?: string
  apiURL?:  URL
  node?:    ChainNode

  /** Credentials of the default agent for this network. */
  defaultIdentity?: Identity

  /** Stuff that should be in the constructor but is asynchronous.
    * FIXME: How come nobody has proposed sugar for async constructors yet?
    * Feeling like writing a `@babel/plugin-async-constructor`, as always
    * bonus internet points for whoever beats me to it. */
  abstract init (): Promise<Chain>

  /** The connection address is stored internally as a URL object,
    * but returned as a string.
    * FIXME why so? */
  abstract get url (): string

  /** Get an Agent that works with this Chain. */
  abstract getAgent (options?: Identity): Promise<Agent>

  /** Get a Contract that exists on this Chain, or a non-existent one
    * which you can then create via Agent#instantiate
    *
    * FIXME: awkward inversion of control */
  abstract getContract<T> (api: new()=>T, address: string, agent: any): T

  /** This directory contains all the others. */
  readonly stateRoot: Directory

  /** This directory stores all private keys that are available for use. */
  readonly identities: Directory

  /** This directory stores receipts from the upload transactions,
    * containing provenance info for uploaded code blobs. */
  readonly uploads: Directory

  /** This directory stores receipts from the instantiation (init) transactions,
    * containing provenance info for initialized contract instances.
    *
    * NOTE: the current domain vocabulary considers initialization and instantiation,
    * as pertaining to contracts on the blockchain, to be the same thing. */
  abstract readonly instances: ChainInstancesDir

  abstract printStatusTables (): void

  readonly isMainnet?:  boolean
  readonly isTestnet?:  boolean
  readonly isLocalnet?: boolean
  constructor ({ chainId, isMainnet, isTestnet, isLocalnet }: ChainState) {
    this.isMainnet  = isMainnet
    this.isTestnet  = isTestnet
    this.isLocalnet = isLocalnet
  }
}

export class ChainInstancesDir extends Directory {

  KEY = '.active'

  get active () {
    const path = resolve(this.path, this.KEY)
    if (existsSync(path)) {
      const name = basename(readlinkSync(path))
      const contracts = {}
      for (const contract of readdirSync(path)) {
        contracts[basename(contract, '.json')] = JSON.parse(
          readFileSync(resolve(path, contract), 'utf8')
        )
      }
      return { name, contracts }
    } else {
      return null
    }
  }

  async select (id: string) {
    const selection = resolve(this.path, id)
    if (!existsSync(selection)) throw new Error(
      `@fadroma/ops: ${id} does not exist`)
    const active = resolve(this.path, this.KEY)
    unlinkSync(active)
    await symlinkDir(selection, active)
  }

  async list () {
    if (!existsSync(this.path)) {
      console.info(`\n${this.path} does not exist, creating`)
      await mkdirp(this.path)
      return [] }

    return readdirSync(this.path)
      .filter(x=>x!=this.KEY)
      .filter(x=>statSync(resolve(this.path, x)).isDirectory())
  }

  save (name: string, data: any) {
    if (data instanceof Object) data = JSON.stringify(data, null, 2)
    return super.save(`${name}.json`, data)
  }
}
