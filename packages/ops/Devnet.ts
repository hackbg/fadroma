import { URL } from 'url'
import * as HTTP from 'http'
import { symlinkSync } from 'fs'
import freeportAsync from 'freeport-async'
import {
  Console, bold,
  Directory, JSONDirectory,
  JSONFile,
  Path, basename, relative, resolve, cwd,
  existsSync, readlinkSync, mkdirp,
  waitPort, freePort,
  Docker, ensureDockerImage, waitUntilLogsSay,
  randomHex
} from '@hackbg/tools'
import { Endpoint } from './Endpoint'
import { config } from './Config'
import type { Identity } from './Core'

const console = Console('@fadroma/ops/Devnet')

/** Domain API. A Devnet is created from a given chain ID
  * with given pre-configured identities, and its state is stored
  * in a given directory. */
export type DevnetOptions = {
  /** Internal name that will be given to chain. */
  chainId?:   string
  /** Names of genesis accounts to be created with the node */
  identities?: Array<string>
  /** Path to directory where state will be stored. */
  stateRoot?: string,
}

export abstract class Devnet {

  /** Procedure. Stops and deletes the devnet node in the migration context. */
  static resetDevnet = ({ chain }) => chain.node.terminate()

  /** Creates an object representing a devnet.
    * Use the `respawn` method to get it running. */
  constructor ({ chainId, identities, stateRoot }: DevnetOptions) {
    this.chainId = chainId || this.chainId
    if (!this.chainId) {
      throw new Error(
        '@fadroma/ops/Devnet: refusing to create directories for devnet with empty chain id'
      )
    }
    if (identities) {
      this.genesisAccounts = identities
    }
    stateRoot = stateRoot || resolve(config.projectRoot, 'receipts', this.chainId)
    this.stateRoot  = new Directory(stateRoot)
    this.nodeState  = new JSONFile(stateRoot, 'node.json')
  }

  /** The chain ID that will be passed to the devnet node. */
  chainId: string = 'fadroma-devnet'

  /** The API URL that can be used to talk to the devnet. */
  apiURL: URL = new URL('http://localhost:1317')

  /** The protocol of the API URL without the trailing colon. */
  get protocol (): string {
    const { protocol } = this.apiURL
    return protocol.slice(0, protocol.length - 1)
  }

  /** The hostname of the API URL. */
  get host (): string {
    return this.apiURL.hostname
  }

  /** The port of the API URL. */
  get port (): string {
    return this.apiURL.port
  }

  /** This directory is created to remember the state of the devnet setup. */
  stateRoot: Directory

  /** List of genesis accounts that will be given an initial balance
    * when creating the devnet container for the first time. */
  genesisAccounts: Array<string> = ['ADMIN', 'ALICE', 'BOB', 'CHARLIE', 'MALLORY']

  /** Retrieve an identity */
  abstract getGenesisAccount (name: string): Promise<object>

  /** Start the node. */
  abstract spawn (): Promise<this>

  /** This file contains the id of the current devnet container.
    * TODO store multiple containers */
  nodeState: JSONFile

  /** Save the info needed to respawn the node */
  save (extraData = {}) {
    const shortPath = relative(config.projectRoot, this.nodeState.path)
    console.info(`Saving devnet node to ${shortPath}`)
    const data = { chainId: this.chainId, port: this.port, ...extraData }
    this.nodeState.save(data)
    return this
  }

  /** Restore this node from the info stored in the nodeState file */
  load () {
    const path = relative(cwd(), this.nodeState.path)
    if (this.stateRoot.exists() && this.nodeState.exists()) {
      console.info(bold(`Loading:  `), path)
      try {
        const data = this.nodeState.load()
        const { chainId, port } = data
        if (this.chainId !== chainId) {
          console.warn(`Loading state of ${chainId} into Devnet with id ${this.chainId}`)
        }
        this.apiURL.port = String(port)
        return data
      } catch (e) {
        console.warn(`Failed to load ${path}. Deleting it`)
        this.stateRoot.delete()
        throw e
      }
    } else {
      console.info(`${path} does not exist.`)
    }
  }

  /** Start the node if stopped. */
  abstract respawn (): Promise<this>

  /** Stop this node and delete its state. */
  async terminate () {
    await this.kill()
    await this.erase()
  }

  /** Stop the node. */
  abstract kill (): Promise<void>

  /** Erase the state of the node. */
  abstract erase (): Promise<void>

}

/** Parameters for the HTTP API-based implementation of Devnet. */
export type ManagedDevnetOptions = DevnetOptions & {
  /** Base URL of the API that controls the managed node. */
  managerURL: string
}

/** When running in docker-compose, Fadroma needs to request
  * from the devnet container to spawn a chain node with the
  * given chain id and identities via a HTTP API. */
export class ManagedDevnet extends Devnet {

  /** Makes sure that the latest devnet is reused,
    * unless explicitly specified otherwise. */
  static getOrCreate (
    managerURL: string,
    chainId?:   string,
    prefix?:    string
  ) {
    // If passed a chain id, use that;
    // this makes a passed prefix irrelevant.
    if (chainId && prefix) {
      console.warn(
        'Passed both chainId and prefix to ManagedDevnet.get: ignoring prefix'
      )
    }
    // Establish default prefix.
    // Chain subclasses should define this.
    if (!prefix) {
      prefix = 'devnet'
    }
    // If no chain id passed, try to reuse the
    // last created devnet; if there isn't one,
    // create a new one and symlink it as active.
    if (!chainId) {
      const active = resolve(config.projectRoot, 'receipts', `${prefix}-active`)
      if (existsSync(active)) {
        chainId = basename(readlinkSync(active))
        console.info('Reusing existing managed devnet with chain id', bold(chainId))
      } else {
        chainId = `${prefix}-${randomHex(4)}`
        const devnet = resolve(config.projectRoot, 'receipts', chainId)
        mkdirp.sync(devnet)
        symlinkSync(devnet, active)
        console.info('Creating new managed devnet with chain id', bold(chainId))
      }
    }
    return new ManagedDevnet({ managerURL, chainId })
  }

  constructor (options) {
    super(options)
    console.info(
      'Constructing', bold('remotely managed'), 'devnet'
    )
    const { managerURL = config.devnetManager } = options
    this.manager = new Endpoint(managerURL)
  }

  manager: Endpoint

  apiURL: URL = new URL('http://devnet:1317')

  async spawn () {
    const port = await freeportAsync()
    this.apiURL.port = port
    console.info(
      bold('Spawning managed devnet'), this.chainId,
      'on port', port
    )
    await this.manager.get('/spawn', {
      id:      this.chainId,
      genesis: this.genesisAccounts.join(','),
      port
    })
    await this.ready()
    return this
  }

  save () {
    const shortPath = relative(config.projectRoot, this.nodeState.path)
    console.info(`Saving devnet node to ${shortPath}`)
    const data = { chainId: this.chainId, port: this.port }
    this.nodeState.save(data)
    return this
  }

  async respawn () {
    const shortPath = relative(config.projectRoot, this.nodeState.path)
    // if no node state, spawn
    if (!this.nodeState.exists()) {
      console.info(`No devnet found at ${bold(shortPath)}`)
      return this.spawn()
    }
    return this
  }

  protected async ready (): Promise<void> {
    while (true) {
      const { ready } = await this.manager.get('/ready')
      if (ready) {
        break
      }
      console.info('Waiting for devnet to become ready...')
      await new Promise(resolve=>setTimeout(resolve, 1000))
    }
  }

  async getGenesisAccount (name: string): Promise<object> {
    return this.manager.get('/identity', { name })
  }

  async erase () { throw new Error('not implemented') }

  async kill () { throw new Error('not implemented') }

}

