import { URL } from 'url'
import * as HTTP from 'http'
import { basename, relative, resolve } from 'path'
import { cwd } from 'process'
import { existsSync, readlinkSync, symlinkSync } from 'fs'
import { Console, bold } from '@hackbg/konzola'
import { Path, Directory, JSONDirectory, JSONFile, mkdirp } from '@hackbg/kabinet'
import { freePort, waitPort } from '@hackbg/portali'
import { Docker, DockerImage, waitUntilLogsSay } from '@hackbg/dokeres'
import { randomHex } from '@hackbg/toolbox'

import { config } from './Config'

const console = Console('Fadroma Devnet')

/** Domain API. A Devnet is created from a given chain ID
  * with given pre-configured identities, and its state is stored
  * in a given directory. */
export interface DevnetOptions {
  /** Internal name that will be given to chain. */
  chainId?:   string
  /** Names of genesis accounts to be created with the node */
  identities?: Array<string>
  /** Path to directory where state will be stored. */
  stateRoot?: string,
}

export abstract class Devnet {

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
    const shortPath = relative(cwd(), this.nodeState.path)
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

/** Parameters for the Dockerode-based implementation of Devnet.
  * (https://www.npmjs.com/package/dockerode) */
export interface DockerodeDevnetOptions extends DevnetOptions {
  /** Docker image of the chain's runtime. */
  image?: DockerImage
  /** Init script to launch the devnet. */
  initScript?: string
  /** Once this string is encountered in the log output
    * from the container, the devnet is ready to accept requests. */
  readyPhrase?: string
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

/** Used to reconnect between runs. */
export interface DockerodeDevnetReceipt {
  containerId: string
  chainId:     string
  port:        number|string
}

/** Fadroma can spawn a devnet in a container using Dockerode.
  * This requires an image name and a handle to Dockerode. */
export class DockerodeDevnet extends Devnet {

  constructor (options: DockerodeDevnetOptions = {}) {
    super(options)
    console.info('Constructing', bold('Dockerode')+'-based devnet')
    if (options.docker) {
      this.docker = options.docker
    }
    this.identities  = this.stateRoot.subdir('identities',  JSONDirectory)
    this.image       = options.image
    this.initScript  = options.initScript
    this.readyPhrase = options.readyPhrase
  }

  /** This should point to the standard production docker image for the network. */
  image: DockerImage

  /** Mounted into devnet container in place of default init script
    * in order to add custom genesis accounts with initial balances
    * and store their keys. */
  initScript: string

  /** Mounted out of devnet container to persist keys of genesis wallets. */
  identities: JSONDirectory

  /** Gets the info for a genesis account, including the mnemonic */
  async getGenesisAccount (name: string) {
    return this.identities.load(name)
  }

  /** Once this phrase is encountered in the log output
    * from the container, the devnet is ready to accept requests. */
  readyPhrase: string

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
    await this.image.ensure()
    this.container = await this.createContainer(this.getContainerOptions())
    const shortId = this.container.id.slice(0, 8)
    // emit any warnings
    if (this.container.Warnings) {
      console.warn(`Creating container ${shortId} emitted warnings:`)
      console.info(this.container.Warnings)
    }
    // report progress
    const shortPath = relative(config.projectRoot, this.nodeState.path)
    console.info(`Created container ${bold(shortId)} (${bold(shortPath)})...`)
    // start the container
    await this.startContainer(this.container.id)
    console.info(`Started container ${shortId}...`)
    // update the record
    this.save()
    // wait for logs to confirm that the genesis is done
    await waitUntilLogsSay(this.container, this.readyPhrase, undefined, this.waitSeconds)
    // wait for port to be open
    await this.waitPort({ host: this.host, port: Number(this.port) })
    return this
  }

  protected waitSeconds = 7

  protected waitPort = waitPort

  load (): DockerodeDevnetReceipt | null {
    const data = super.load()
    if (data.containerId) {
      const id = data.containerId
      const Warnings = null
      const logs = () => { throw new Error(
        '@fadroma/ops/Devnet: tried to tail logs before creating container'
      ) }
      this.container = { id, Warnings, logs }
    } else {
      throw new Error('@fadroma/ops/Devnet: missing container id in devnet state')
    }
    return data
  }

  /** Write the state of the devnet to a file. */
  save () {
    return super.save({ containerId: this.container.id })
  }

  /** Spawn the existing localnet, or a new one if that is impossible */
  async respawn () {
    const shortPath = relative(config.projectRoot, this.nodeState.path)
    // if no node state, spawn
    if (!this.nodeState.exists()) {
      console.info(`No devnet found at ${bold(shortPath)}`)
      return this.spawn()
    }
    // get stored info about the container was supposed to be
    let id: string
    try {
      id = this.load().containerId
    } catch (e) {
      // if node state is corrupted, spawn
      console.warn(e)
      console.info(`Reading ${bold(shortPath)} failed`)
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
      if (config.devnetEphemeral) {
        this.killContainer(id)
      } else {
        console.log()
        console.info(
          'Devnet is running on port', bold(String(this.port)),
          'from container', bold(this.container.id.slice(0,8))
        )
      }
    })
    return this
  }

  /** Kill the container, if necessary find it first */
  async kill () {
    if (this.container) {
      const { id } = this.container
      await this.killContainer(id)
      console.info(
        `Stopped container`, bold(id)
      )
    } else {
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
        await this.image.ensure()
        const container = await this.createContainer(getCleanupContainerOptions(this))
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
  protected docker: Docker = new Docker({ socketPath: config.dockerHost||'/var/run/docker.sock' })

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

  /** What Dockerode passes to the Docker API
    * in order to launch a devnet container. */
  private getContainerOptions () {
    const {
      chainId,
      genesisAccounts,
      image,
      initScript,
      port,
      stateRoot
    } = this
    const initScriptName = resolve('/', basename(initScript))
    return {
      Image:        image.name,
      Name:         `${chainId}-${port}`,
      Env:          [ `Port=${port}`
                    , `ChainID=${chainId}`
                    , `GenesisAccounts=${genesisAccounts.join(' ')}` ],
      Entrypoint:   [ '/bin/bash' ],
      Cmd:          [ initScriptName ],
      Tty:          true,
      AttachStdin:  true,
      AttachStdout: true,
      AttachStderr: true,
      Hostname:     chainId,
      Domainname:   chainId,
      ExposedPorts: { [`${port}/tcp`]: {} },
      HostConfig:   { NetworkMode: 'bridge'
                    , AutoRemove:   true
                    , Binds:
                      [ `${initScript}:${initScriptName}:ro`
                      , `${stateRoot.path}:/receipts/${chainId}:rw` ]
                    , PortBindings:
                      { [`${port}/tcp`]: [{HostPort: `${port}`}] } }
    }
  }

  /** What Dockerode passes to the Docker API
    * in order to launch a cleanup container
    * (for removing root-owned devnet files
    * without escalating on the host) */
  private getCleanupContainerOptions () {
    const {
      image,
      chainId,
      port,
      stateRoot
    } = this
    return {
      AutoRemove: true,
      Image:      image.name,
      Name:       `${chainId}-${port}-cleanup`,
      Entrypoint: [ '/bin/rm' ],
      Cmd:        ['-rvf', '/state',],
      HostConfig: { Binds: [`${stateRoot.path}:/state:rw`] }
      //Tty: true, AttachStdin: true, AttachStdout: true, AttachStderr: true,
    }
  }

}
