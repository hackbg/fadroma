import { ChainNode } from '@fadroma/ops'

import {
  Directory, JSONFile, JSONDirectory,
  relative, cwd, TextFile,
  Docker, waitPort, freePort, ensureDockerImage, waitUntilLogsSay,
  bold, Console
} from '@hackbg/tools'

import type { Identity } from './Core'

import { URL } from 'url'

const console = Console('@fadroma/ops/ChainNode')

export type ChainNodeConstructor =
  new (options?: ChainNodeOptions) => ChainNode

export type ChainNodeOptions = {
  /** Handle to Dockerode or compatible
   *  TODO mock! */
  docker?:    IDocker
  /** Docker image of the chain's runtime. */
  image?:     string
  /** Internal name that will be given to chain. */
  chainId?:   string
  /** Path to directory where state will be stored. */
  stateRoot?: string,
  /** Names of genesis accounts to be created with the node */
  identities?: Array<string>
}

export interface ChainNode {
  chainId: string
  apiURL:  URL
  port:    number
  /** Resolved when the node is ready */
  readonly ready: Promise<void>
  /** Path to the node state directory */
  readonly stateRoot: Directory
  /** Path to the node state file */
  readonly nodeState: JSONFile
  /** Path to the directory containing the keys to the genesis accounts. */
  readonly identities: Directory
  /** Retrieve the node state */
  load      (): ChainNodeState
  /** Start the node */
  spawn     (): Promise<void>
  /** Save the info needed to respawn the node */
  save      (): this
  /** Stop the node */
  kill      (): Promise<void>
  /** Start the node if stopped */
  respawn   (): Promise<void>
  /** Erase the state of the node */
  erase     (): Promise<void>
  /** Stop the node and erase its state from the filesystem. */
  terminate () : Promise<void>
  /** Retrieve one of the genesis accounts stored when creating the node. */
  genesisAccount (name: string): Identity
}

export type ChainNodeState = Record<any, any>

export interface IDocker {
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

/// # Chain backends


export abstract class BaseChainNode implements ChainNode {
  chainId = ''
  apiURL: URL
  port = 0

  #ready: Promise<void>
  get ready() { return this.#ready }

  /** This directory is created to remember the state of the localnet setup. */
  readonly stateRoot:  Directory

  /** This file contains the id of the current localnet container.
    * TODO store multiple containers */
  readonly nodeState:  JSONFile

  /** This directory is mounted out of the localnet container
    * in order to persist the state of the chain. */
  readonly daemonDir:  Directory

  /** This directory is mounted out of the localnet container
    * in order to persist the state of the container's built-in cli. */
  readonly clientDir:  Directory

  /** This directory is mounted out of the localnet container
    * in order to persist the state of the SGX modules. */
  readonly sgxDir:     Directory

  /** This directory is mounted out of the localnet container
    * to persist the keys of the genesis wallets. */
  readonly identities: JSONDirectory

  /** List of genesis accounts that will be given an initial balance
    * when creating the localnet container for the first time. */
  identitiesToCreate: Array<string> = []

  /** Retrieve an identity */
  genesisAccount = (name: string) => this.identities.load(name)

  /** Restore this node from the info stored in nodeState */
  load (): {
    containerId: string
    chainId:     string
    port:        number|string
  } | null {

    const path = bold(relative(cwd(), this.nodeState.path))

    if (this.stateRoot.exists() && this.nodeState.exists()) {

      console.info(
        bold(`Loading localnet node from`), path
      )

      try {
        const { containerId, chainId, port } = this.nodeState.load()

        console.info(
          bold(`Using localnet`), chainId,
          bold(`from container`), containerId.slice(0,8),
          bold(`on port`),        port
        )

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

  /** Stop this node and delete its state. */
  async terminate () {
    await this.kill()
    await this.erase()
  }

  abstract respawn (): Promise<void>
  abstract spawn   (): Promise<void>
  abstract kill    (): Promise<void>
  abstract erase   (): Promise<void>
  abstract save    (): this
}


/// ## Docker backend


/** Run a pausable localnet in a Docker container and manage its lifecycle.
 *  State is stored as a pile of files in a directory. */
export abstract class DockerizedChainNode extends BaseChainNode {

  /** This should point to the standard production docker image for the network. */
  abstract readonly image: string

  /** This file is mounted into the localnet container
    * in place of its default init script in order to
    * add custom genesis accounts with initial balances. */
  abstract readonly initScript: TextFile

  abstract readonly chainId: string

  /** Resolved when ready.
    * TODO check */
  #ready: Promise<void> = Promise.resolve()
  get ready() { return this.#ready }

  /** Used to command the container engine. */
  docker: Docker = new Docker({ sockerPath: '/var/run/docker.sock' })

  /** The created container */
  container: {
    id:       string,
    Warnings: any
  }

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

  identitiesToCreate: Array<string> =
    ['ADMIN', 'ALICE', 'BOB', 'CHARLIE', 'MALLORY']

  protocol = 'http'
  host = 'localhost'
  port:     number

  constructor (options: ChainNodeOptions = {}) {
    super()
    if (options.docker) {
      this.docker = options.docker
    }
    if (options.identities) {
      this.identitiesToCreate = options.identities
    }
  }

  /** Load stored data and assign to self. */
  load () {
    const {containerId, chainId, port} = super.load()
    if (this.chainId !== chainId) {
      console.warn(`Loading state of ${chainId} into ChainNode with id ${this.chainId}`)
    }
    this.container = { id: containerId, Warnings: null }
    this.port = port
    return {containerId, chainId, port}
  }

  /** Write the state of the localnet to a file. */
  save () {
    console.info(`Saving localnet node to ${this.nodeState.path}`)
    const data = { containerId: this.container.id, chainId: this.chainId, port: this.port }
    this.nodeState.save(data)
    return this
  }

  async respawn () {
    console.info(
      bold(`Trying to respawn localnet from`),
      this.nodeState.path
    )

    // if no node state, spawn
    if (!this.nodeState.exists()) {
      console.info(`No localnet found at ${bold(this.nodeState.path)}`)
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
    //process.on('beforeExit', () => { this.killContainer(id) })
    // if running, do nothing
    console.info(
      bold(`Localnet already running`)
    )
  }

  /** Spawn a new localnet instance from scratch */
  async spawn () {
    let done = () => {}
    this.#ready = new Promise(resolve => done = resolve)

    // tell the user that we have begun
    console.info(`Spawning new node...`)

    // get a free port
    this.port = (await freePort()) as number

    // create the state dirs and files
    const items = [this.stateRoot, this.nodeState, this.daemonDir, this.clientDir]
    for (const item of items) {
      try {
        item.make()
      } catch (e) {
        console.warn(`Failed to create ${item.path}: ${e.message}`)
      }
    }

    // create the container
    console.info('Spawning a container with the following options:')
    console.debug(await this.spawnContainerOptions)
    this.container = await this.createContainer(this.spawnContainerOptions)

    // emit any warnings
    if (this.container.Warnings) {
      console.warn(`Creating container ${this.container.id} emitted warnings:`)
      console.info(this.container.Warnings)
    }

    // report progress
    console.info(`Created container ${this.container.id} (${bold(this.nodeState.path)})...`)

    // start the container
    await this.startContainer(this.container.idget)
    console.info(`Started container ${this.container.id}...`)

    // update the record
    this.save()

    // wait for logs to confirm that the genesis is done
    await waitUntilLogsSay(this.container, this.readyPhrase)

    // wait for port to be open
    await waitPort({ host: this.host, port: this.port })

    done()
  }
  
  abstract readyPhrase: string

  /** Dockerode passes these to the Docker API in order to launch a localnet container. */
  get spawnContainerOptions () {
    return ensureDockerImage(this.image, this.docker)
      .then((Image: string)=>({
        AutoRemove: true,
        Image,
        Name:         `${this.chainId}-${this.port}`,
        Env:          this.env,
        Entrypoint:   [ '/bin/bash' ],
        Cmd:          [ '/init.sh' ],
        Tty:          true,
        AttachStdin:  true,
        AttachStdout: true,
        AttachStderr: true,
        Hostname:     this.chainId,
        Domainname:   this.chainId,
        ExposedPorts: { [`${this.port}/tcp`]: {} },
        HostConfig: {
          NetworkMode:  'bridge',
          Binds:        Object.entries(this.binds).map(pair=>pair.join(':')),
          PortBindings: { [`${this.port}/tcp`]: [{HostPort: `${this.port}`}] }
        }
      }))
  }

  /** All the directories that need to be mounted into/out of the container,
    * in a Dockerode-friendly format. */
  get binds () {
    return {
      [this.initScript.path]: `/init.sh:ro`,
      [this.identities.path]: `/shared-keys:rw`
    }
  }

  /** Environment variables that will be set in the container.
    * Use them to pass parameters to the init script. */
  get env () {
    return [
      `Port=${this.port}`,
      `CHAINID=${this.chainId}`,
      `GenesisAccounts=${this.identitiesToCreate.join(' ')}`
    ]
  }

  /** Kill the container, if necessary find it first */
  async kill () {
    if (this.container) {
      const { id } = this.container
      await this.killContainer(id)
      console.info(`Stopped container ${bold(id)}.`)
      return
    }

    console.info(`Checking if there's an old node that needs to be stopped...`)

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
        const container = await this.createContainer(this.cleanupContainerOptions)
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

  /** What Dockerode (https://www.npmjs.com/package/dockerode) passes to the Docker API
    * in order to launch a cleanup container. */
  get cleanupContainerOptions () {
    return ensureDockerImage(this.image, this.docker).then((Image:string)=>({
      Image,
      Name:       `${this.chainId}-${this.port}-cleanup`,
      Entrypoint: [ '/bin/rm' ],
      Cmd:        ['-rvf', '/state',],
      HostConfig: { Binds: [`${this.stateRoot.path}:/state:rw`] }
      //Tty: true, AttachStdin: true, AttachStdout: true, AttachStderr: true,
    }))
  }

}
