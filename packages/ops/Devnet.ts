import { Console, bold } from '@hackbg/tools'

const console = Console('@fadroma/ops/Devnet')

import {
  Directory, JSONDirectory,
  TextFile, JSONFile, 
  Path, relative, resolve, cwd,
  Docker, waitPort, freePort, ensureDockerImage, waitUntilLogsSay,
} from '@hackbg/tools'

import type { Identity } from './Core'

import { URL } from 'url'
import * as HTTP from 'http'

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
    if (!this.chainId) {
      throw new Error(
        '@fadroma/ops/Devnet: refusing to create directories for devnet with empty chain id'
      )
    }
    this.chainId = chainId
    if (identities) {
      this.genesisAccounts = identities
    }
    stateRoot = stateRoot || resolve(process.cwd(), 'receipts', this.chainId)
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

  /** This file contains the id of the current devnet container.
    * TODO store multiple containers */
  nodeState: JSONFile

  /** List of genesis accounts that will be given an initial balance
    * when creating the devnet container for the first time. */
  genesisAccounts: Array<string> = ['ADMIN', 'ALICE', 'BOB', 'CHARLIE', 'MALLORY']

  /** Retrieve an identity */
  abstract getGenesisAccount (name: string): Promise<object>

  /** Restore this node from the info stored in nodeState */
  load (): {
    containerId: string
    chainId:     string
    port:        number|string
  } | null {
    const path = relative(cwd(), this.nodeState.path)
    if (this.stateRoot.exists() && this.nodeState.exists()) {
      console.info(bold(`Loading:  `), path)
      try {
        const { containerId, chainId, port } = this.nodeState.load()
        console.info(bold('Container:'), containerId)
        return { containerId, chainId, port }
      } catch (e) {
        console.warn(`Failed to load ${path}`)
        this.stateRoot.delete()
        throw e
      }
    } else {
      console.info(`${path} does not exist.`)
    }
  }

  /** Start the node if stopped. */
  abstract respawn (): Promise<void>

  /** Start the node. */
  abstract spawn (): Promise<void>

  /** Stop this node and delete its state. */
  async terminate () {
    await this.kill()
    await this.erase()
  }

  /** Stop the node. */
  abstract kill (): Promise<void>

  /** Erase the state of the node. */
  abstract erase (): Promise<void>

  /** Save the info needed to respawn the node */
  abstract save (): this

  static async reset ({ chain }) {
    if (chain.node) {
      await chain.node.terminate()
    } else {
      console.warn(bold(process.env.FADROMA_CHAIN), 'not a devnet')
    }
  }

}

/** Parameters for the Dockerode-based implementation of Devnet. 
  * (https://www.npmjs.com/package/dockerode) */
export type DockerodeDevnetOptions = DevnetOptions & {
  /** Docker image of the chain's runtime. */
  image?: string
  /** Handle to Dockerode or compatible (TODO mock!) */
  docker?: {
    getImage (): {
      inspect (): Promise<any>
    }
    pull (image: any, callback: Function): void
    modem: {
      followProgress (
        stream:   any,
        callback: Function,
        progress: Function
      ): any
    }
    getContainer (id: any): {
      id: string,
      start (): Promise<any>
    }
    createContainer (options: any): {
      id: string
      logs (_: any, callback: Function): void
    }
  }
}

/** Fadroma can spawn a devnet in a container using Dockerode.
  * This requires an image name and a handle to Dockerode. */
export abstract class DockerodeDevnet extends Devnet {

  constructor (options: DockerodeDevnetOptions = {}) {
    super(options)
    console.info('Constructing', bold('Dockerode')+'-based devnet')
    if (options.docker) {
      this.docker = options.docker
    }
    this.identities = this.stateRoot.subdir('identities', JSONDirectory)
  }

  /** This should point to the standard production docker image for the network. */
  abstract readonly image: string

  /** Mounted into devnet container in place of default init script
    * in order to add custom genesis accounts with initial balances
    * and store their keys. */
  abstract readonly initScript: TextFile
 
  /** Once this phrase is encountered in the log output
    * from the container, the devnet is ready to accept requests. */
  abstract readyPhrase: string

  /** Mounted out of devnet container to persist keys of genesis wallets. */
  identities: JSONDirectory

  /** Gets the info for a genesis account, including the mnemonic */
  async getGenesisAccount (name: string) {
    return this.identities.load(name)
  }

  /** Mounted out of devnet container to persist secretd state. */
  daemonDir: Directory

  /** Mounted out of devnet container to persist secretcli state. */
  clientDir: Directory

  /** Mounted out of devnet container to persist SGX state. */
  sgxDir: Directory

  /** Load stored data and assign to self. */
  load () {
    const {containerId, chainId, port} = super.load()
    if (this.chainId !== chainId) {
      console.warn(`Loading state of ${chainId} into Devnet with id ${this.chainId}`)
    }
    this.container = {
      id: containerId,
      Warnings: null,
      logs () {
        throw new Error('@fadroma/ops/Devnet: tried to tail logs before creating container')
      }
    }
    this.apiURL.port = String(port)
    return {containerId, chainId, port}
  }

  /** Write the state of the devnet to a file. */
  save () {
    console.info(`Saving devnet node to ${this.nodeState.path}`)
    const data = { containerId: this.container.id, chainId: this.chainId, port: this.port }
    this.nodeState.save(data)
    return this
  }

  async respawn () {
    // if no node state, spawn
    if (!this.nodeState.exists()) {
      console.info(`No devnet found at ${bold(this.nodeState.path)}`)
      return this.spawn()
    }
    // get stored info about the container was supposed to be
    let id: string
    try {
      id = this.load().containerId
    } catch (e) {
      // if node state is corrupted, spawn
      console.warn(e)
      console.info(`Reading ${bold(this.nodeState.path)} failed`)
      return this.spawn()
    }
    // check if contract is running
    let running: boolean
    try {
      running = await this.isRunning(id)
    } catch (_e) {
      // if error when checking, RESPAWN
      //console.info(`✋ Failed to get container ${bold(id)}`)
      //console.info('Error was:', e)
      console.info(`Cleaning up outdated state...`)
      await this.erase()
      console.info(`Trying to launch a new node...`)
      return this.spawn()
    }
    // if not running, RESPAWN
    if (!running) this.startContainer(id)
    // ...and try to make sure it dies when the Node process dies
    process.on('beforeExit', () => {
      if (process.env.FADROMA_EPHEMERAL) {
        this.killContainer(id)
      } else {
        console.log()
        console.info(
          'Devnet is running on port', bold(String(this.port)),
          'from container', bold(this.container.id.slice(0,8))
        )
      }
    })
  }

  /** Spawn a new devnet instance from scratch */
  async spawn () {
    // tell the user that we have begun
    console.info(`Spawning new node...`)
    // get a free port
    this.apiURL.port = String(await freePort())
    // create the state dirs and files
    const items = [this.stateRoot, this.nodeState]
    for (const item of items) {
      try {
        item.make()
      } catch (e) {
        console.warn(`Failed to create ${item.path}: ${e.message}`)
      }
    }
    // create the container
    console.info('Launching a devnet container...')
    await ensureDockerImage(this.image, this.docker)
    this.container = await this.createContainer(devnetContainerOptions(this))
    // emit any warnings
    if (this.container.Warnings) {
      console.warn(`Creating container ${this.container.id} emitted warnings:`)
      console.info(this.container.Warnings)
    }
    // report progress
    console.info(`Created container ${this.container.id} (${bold(this.nodeState.path)})...`)
    // start the container
    await this.startContainer(this.container.id)
    console.info(`Started container ${this.container.id}...`)
    // update the record
    this.save()
    // wait for logs to confirm that the genesis is done
    await waitUntilLogsSay(this.container, this.readyPhrase)
    // wait for port to be open
    await waitPort({ host: this.host, port: Number(this.port) })
  }

  /** Kill the container, if necessary find it first */
  async kill () {
    if (this.container) {
      const { id } = this.container
      await this.killContainer(id)
      console.info(`Stopped container ${bold(id)}.`)
      return
    }
    console.info(
      `Checking if there's an old node that needs to be stopped...`
    )
    try {
      const { containerId } = this.load()
      await this.killContainer(containerId)
      console.info(`Stopped container ${bold(containerId)}.`)
    } catch (_e) {
      console.info("Didn't stop any container.")
    }
  }

  /** External environment needs to be returned to a pristine state via Docker.
    * (Otherwise, root-owned dotdirs leak and have to be manually removed with sudo.) */
  async erase () {
    const path = bold(relative(cwd(), this.stateRoot.path))
    try {
      if (this.stateRoot.exists()) {
        console.info(`Deleting ${path}...`)
        this.stateRoot.delete()
      }
    } catch (e) {
      if (e.code === 'EACCES' || e.code === 'ENOTEMPTY') {
        console.warn(`Failed to delete ${path}: ${e.message}; trying cleanup container...`)
        await ensureDockerImage(this.image, this.docker)
        const container = await this.createContainer(cleanupContainerOptions(this))
        console.info(`Starting cleanup container...`)
        await container.start()
        console.info('Waiting for cleanup to finish...')
        await container.wait()
        console.info(`Deleted ${path} via cleanup container.`)
      } else {
        console.warn(`Failed to delete ${path}: ${e.message}`)
        throw e
      }
    }
  }

  /** Used to command the container engine. */
  protected docker: Docker = new Docker({ sockerPath: '/var/run/docker.sock' })

  /** The created container */
  container: { id: string, Warnings: any, logs: Function }

  private isRunning = async (id: string = this.container.id) =>
    (await this.docker.getContainer(id).inspect()).State.Running

  private createContainer = async (options: any|Promise<any>) =>
    await this.docker.createContainer(await Promise.resolve(options))

  private startContainer = async (id: string = this.container.id) =>
    await this.docker.getContainer(id).start()

  private killContainer = async (id: string = this.container.id) => {
    const prettyId = bold(id.slice(0,8))
    if (await this.isRunning(id)) {
      console.info(`Stopping ${prettyId}...`)
      await this.docker.getContainer(id).kill()
      console.info(`Stopped ${prettyId}`)
    }
  }
}

/** What Dockerode passes to the Docker API
  * in order to launch a devnet container. */
export async function devnetContainerOptions (node: DockerodeDevnet) {
  return {
    AutoRemove:   true,
    Image:        node.image,
    Name:         `${node.chainId}-${node.port}`,
    Env:          [
      `Port=${node.port}`,
      `CHAINID=${node.chainId}`,
      `GenesisAccounts=${node.genesisAccounts.join(' ')}`
    ],
    Entrypoint:   [ '/bin/bash' ],
    Cmd:          [ '/init.sh' ],
    Tty:          true,
    AttachStdin:  true,
    AttachStdout: true,
    AttachStderr: true,
    Hostname:     node.chainId,
    Domainname:   node.chainId,
    ExposedPorts: { [`${node.port}/tcp`]: {} },
    HostConfig: {
      NetworkMode:  'bridge',
      Binds:        [
        `${node.initScript.path}:/init.sh:ro`,
        `${node.identities.path}:/shared-keys:rw`
      ],
      PortBindings: {
        [`${node.port}/tcp`]: [{HostPort: `${node.port}`}]
      }
    }
  }
}

/** What Dockerode passes to the Docker API
  * in order to launch a cleanup container
  * (for removing root-owned devnet files
  * without escalating on the host) */
export async function cleanupContainerOptions (node: DockerodeDevnet) {
  return {
    AutoRemove: true,
    Image:      node.image,
    Name:       `${node.chainId}-${node.port}-cleanup`,
    Entrypoint: [ '/bin/rm' ],
    Cmd:        ['-rvf', '/state',],
    HostConfig: { Binds: [`${node.stateRoot.path}:/state:rw`] }
    //Tty: true, AttachStdin: true, AttachStdout: true, AttachStderr: true,
  }
}

/** Parameters for the HTTP API-based implementation of Devnet. */
export type ManagedDevnetOptions = DevnetOptions & {
  /** Base URL of the API that spawns the managed node. */
  remoteControlURL: string
}

/** When running in docker-compose, Fadroma needs to request
  * from the devnet container to spawn a chain node with the
  * given chain id and identities via a HTTP API. */
export abstract class ManagedDevnet extends Devnet {

  constructor (options) {
    super(options)
    console.info(
      'Constructing', bold('remotely managed'), 'devnet'
    )
  }

  managerURL: URL = new URL('http://devnet:8080')

  async spawn () {
    console.info(bold('Spawning managed devnet'), this.chainId)
    await new Promise<void>((resolve, reject)=>{
      const url = new URL(this.managerURL.toString())
      url.pathname = '/spawn'
      url.searchParams.set('id', this.chainId)
      url.searchParams.set('genesis', this.genesisAccounts.join(','))
      HTTP.get(url.toString(), ()=>resolve()).on('error', reject)
    })
  }

  async getGenesisAccount (name: string): Promise<object> {
    return new Promise((resolve, reject)=>{
      const url = new URL(this.managerURL.toString())
      url.pathname = '/identity'
      url.searchParams.set('name', name)
      HTTP.get(url.toString(), (res)=>{
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => resolve(JSON.parse(data)))
      }).on('error', reject)
    })
  }

  async erase () { throw new Error('not implemented') }

  async kill () { throw new Error('not implemented') }

  async respawn () {
    return this.spawn()
  }

  save (): this { throw new Error('not implemented') }

}

const readJSONResponse = res => new Promise((resolve, reject)=>{
  let data = ''
  res.on('data', chunk => data += chunk)
  res.on('end', () => resolve(JSON.parse(data)))
})
