import type {
  IChain, IChainNode, ChainNodeOptions, IChainState,
  Identity, IAgent,
  IContract,
} from './Model'

import {
  __dirname,
  relative, cwd, TextFile, JSONFile, Directory, JSONDirectory,
  Docker, waitPort, freePort, pulled, waitUntilLogsSay,
  Console, bold, symlinkDir, mkdirp, resolve, basename,
  readdirSync, statSync, existsSync, readlinkSync, readFileSync, unlinkSync
} from '@fadroma/tools'

import { URL } from 'url'

const console = Console(import.meta.url)

/* Represents an interface to a particular Cosmos blockchain.
 * Used to construct `Agent`s and `Contract`s that are
 * bound to a particular chain. */
export abstract class BaseChain implements IChain {
  chainId?: string
  apiURL?:  URL
  node?:    IChainNode

  /** Credentials of the default agent for this network. */
  defaultIdentity?: Identity

  /** Stuff that should be in the constructor but is asynchronous.
    * FIXME: How come nobody has proposed sugar for async constructors yet?
    * Feeling like writing a `@babel/plugin-async-constructor`, as always
    * bonus internet points for whoever beats me to it. */
  abstract readonly ready: Promise<this>

  /** The connection address is stored internally as a URL object,
    * but returned as a string.
    * FIXME why so? */
  abstract get url (): string

  /** Get an Agent that works with this Chain. */
  abstract getAgent (options?: Identity): Promise<IAgent>

  /** Get a Contract that exists on this Chain, or a non-existent one
    * which you can then create via Agent#instantiate
    *
    * FIXME: awkward inversion of control */
  abstract getContract<T> (api: new()=>T, address: string, agent: any): T

  /** This directory contains all the others. */
  readonly stateRoot:  Directory

  /** This directory stores all private keys that are available for use. */
  readonly identities: Directory

  /** This directory stores receipts from the upload transactions,
    * containing provenance info for uploaded code blobs. */
  readonly uploads:    Directory

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
  constructor ({ isMainnet, isTestnet, isLocalnet }: IChainState = {}) {
    this.isMainnet  = isMainnet
    this.isTestnet  = isTestnet
    this.isLocalnet = isLocalnet
  }
}


/// ### Instances
/// The instance directory is where results of deployments are stored.


export class ChainInstancesDir extends Directory {

  KEY = '.active'

  get active () {
    const path = resolve(this.path, this.KEY)
    if (!existsSync(path)) {
      return null
    }

    const instanceName = basename(readlinkSync(path))
    const contracts = {}
    for (const contract of readdirSync(path).sort()) {
      const [contractName, _version] = basename(contract, '.json').split('@')
      const location = resolve(path, contract)
      contracts[contractName] = JSON.parse(readFileSync(location, 'utf8'))
    }

    return {
      name: instanceName,
      path,
      resolve: (...fragments: Array<string>) => resolve(path, ...fragments),
      contracts,
      getContract (
        Class: (new () => IContract) & {attach: Function},
        contractName: string,
        admin:        IAgent
      ) {
        const receipt = contracts[contractName]
        if (!receipt) {
          throw new Error(
            `@fadroma/ops: no contract ${bold(contractName)}` +
            ` in deployment ${bold(instanceName)}`
          )
        }
        const {initTx:{contractAddress}, codeId: _codeId, codeHash} = receipt
        return Class.attach(contractAddress, codeHash, admin)
      }
    }
  }

  async select (id: string) {
    const selection = resolve(this.path, id)
    if (!existsSync(selection)) throw new Error(
      `@fadroma/ops: ${id} does not exist`)
    const active = resolve(this.path, this.KEY)
    if (existsSync(active)) unlinkSync(active)
    await symlinkDir(selection, active)
  }

  list () {
    if (!existsSync(this.path)) {
      console.info(`\n${this.path} does not exist, creating`)
      mkdirp.sync(this.path)
      return []
    }

    return readdirSync(this.path)
      .filter(x=>x!=this.KEY)
      .filter(x=>statSync(resolve(this.path, x)).isDirectory())
  }

  save (name: string, data: any) {
    if (data instanceof Object) data = JSON.stringify(data, null, 2)
    return super.save(`${name}.json`, data)
  }
}


/// ## Chain backends


export abstract class BaseChainNode implements IChainNode {
  chainId: string
  apiURL:  URL
  port:    number

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
  load () {
    const path = bold(relative(cwd(), this.nodeState.path))
    if (this.stateRoot.exists() && this.nodeState.exists()) {
      console.info(`Loading localnet node from ${path}`)
      try {
        const data = this.nodeState.load()
        console.debug(`Contents of ${path}:`, data)
        return data }
      catch (e) {
        console.warn(`Failed to load ${path}`)
        this.stateRoot.delete()
        throw e } }
    else {
      console.info(`${path} does not exist.`) }}

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


/// ### Docker backend


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
  container: { id: string, Warnings: any }

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
      console.info(`Stopped ${prettyId}`) } }

  identitiesToCreate: Array<string> = ['ADMIN', 'ALICE', 'BOB', 'CHARLIE', 'MALLORY']

  protocol:  string = 'http'
  host:      string = 'localhost'
  port:      number

  constructor (options: ChainNodeOptions = {}) {
    super()
    if (options.docker) this.docker = options.docker
    if (options.identities) this.identitiesToCreate = options.identities }

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
    console.debug('saving localnet node', { to: this.nodeState.path })
    const data = { containerId: this.container.id, chainId: this.chainId, port: this.port }
    this.nodeState.save(data)
    return this
  }

  async respawn () {
    console.log(`⏳ Trying to respawn localnet from ${bold(this.nodeState.path)}...`)
    // if no node state, spawn
    if (!this.nodeState.exists()) {
      console.info(`✋ No localnet found at ${bold(this.nodeState.path)}`)
      return this.spawn() }
    // get stored info about the container was supposed to be
    let id: any; try { id = this.load().containerId } catch (e) {
      // if node state is corrupted, spawn
      console.warn(e)
      console.info(`✋ Reading ${bold(this.nodeState.path)} failed`)
      return this.spawn()
    }
    // check if contract is running
    let running: any
    try {
      running = await this.isRunning(id)
    } catch (e) {
      // if error when checking, RESPAWN
      //console.info(`✋ Failed to get container ${bold(id)}`)
      //console.info('Error was:', e)
      console.log(`⏳ Cleaning up outdated state...`)
      await this.erase()
      console.log(`⏳ Trying to launch a new node...`)
      return this.spawn()
    }
    // if not running, RESPAWN
    if (!running) this.startContainer(id)
    // ...and try to make sure it dies when the Node process dies
    //process.on('beforeExit', () => { this.killContainer(id) })
    // if running, do nothing
    console.info(`Localnet already running`)
  }

  /** Spawn a new localnet instance from scratch */
  async spawn () {
    let done: Function
    this.#ready = new Promise(resolve=>done=resolve)
    // tell the user that we have begun
    console.debug(`⏳ Spawning new node...`)
    // get a free port
    this.port = (await freePort()) as number
    // create the state dirs and files
    const items = [this.stateRoot, this.nodeState, this.daemonDir, this.clientDir]
    for (const item of items) item.make()
    // create the container
    console.debug('Spawning...', await this.spawnContainerOptions)
    this.container = await this.createContainer(this.spawnContainerOptions)
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
    // update the
    this.save()
    // wait for logs to confirm that the genesis is done
    await waitUntilLogsSay(this.container, 'GENESIS COMPLETE')
    // wait for port to be open
    await waitPort({ host: this.host, port: this.port })
    done()
  }

  /** Dockerode passes these to the Docker API in order to launch a localnet container. */
  get spawnContainerOptions () {
    return pulled(this.image, this.docker)
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
    return { [this.initScript.path]: `/init.sh:ro`,
             [this.identities.path]: `/shared-keys:rw` } }

  /** Environment variables that will be set in the container.
    * Use them to pass parameters to the init script. */
  get env () {
    return [`Port=${this.port}`
           ,`ChainID=${this.chainId}`
           ,`GenesisAccounts=${this.identitiesToCreate.join(' ')}`]}

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
    } catch (e) {
      console.info("Didn't stop any container.")
    }
  }

  /** External environment needs to be returned to a pristine state via Docker.
    * (Otherwise, root-owned dotdirs leak and have to be manually removed with sudo.) */
  async erase () {
    const path = bold(relative(cwd(), this.stateRoot.path))
    try {
      if (this.stateRoot.exists()) {
        console.log(`⏳ Deleting ${path}...`)
        this.stateRoot.delete()
      }
    } catch (e) {
      console.warn(`Failed to delete ${path}, because:`)
      console.warn(e)
      if (e.code === 'EACCES') {
        console.log(`⏳ Creating cleanup container...`)
        const container = await this.createContainer(this.cleanupContainerOptions)
        console.log(`⏳ Starting cleanup container...`)
        await container.start()
        console.log('⏳ Waiting for cleanup to finish...')
        await container.wait()
        console.info(`Deleted ${path} via cleanup container.`)
      }
    }
  }

  /** What Dockerode (https://www.npmjs.com/package/dockerode) passes to the Docker API
    * in order to launch a cleanup container. */
  get cleanupContainerOptions () {
    return pulled(this.image, this.docker).then((Image:string)=>({
      Image,
      Name:       `${this.chainId}-${this.port}-cleanup`,
      Entrypoint: [ '/bin/rm' ],
      Cmd:        ['-rvf', '/state',],
      HostConfig: { Binds: [`${this.stateRoot.path}:/state:rw`] }
      //Tty: true, AttachStdin: true, AttachStdout: true, AttachStderr: true,
    }))
  }
}

export function pick (obj: Record<any, any>, ...keys: Array<any>) {
  return Object.keys(obj)
    .filter(key=>keys.indexOf(key)>-1)
    .reduce((obj2,key)=>{
      obj2[key] = obj[key]
      return obj2 }, {})
}

export function required (label: string) {
  return () => { throw new Error(`required: ${label}`) }
}
