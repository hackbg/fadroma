import $, { JSONFile } from '@hackbg/kabinet'
import { CustomConsole, CustomError, bold } from '@hackbg/konzola'
import { EnvConfig } from '@hackbg/konfizi'
import { freePort, waitPort, Endpoint } from '@hackbg/portali'
import { randomHex } from '@hackbg/formati'

import * as Kabinet from '@hackbg/kabinet'
import * as Komandi from '@hackbg/komandi'
import * as Dokeres from '@hackbg/dokeres'
import * as Fadroma from '@fadroma/client'

import { resolve, relative, basename, dirname } from 'path'
import { cwd }                                  from 'process'
import { readlinkSync, symlinkSync }            from 'fs'
import { fileURLToPath }                        from 'url'

//@ts-ignore
export const devnetPackage = dirname(fileURLToPath(import.meta.url)) // resource finder

/** Module-specific log. */
const log = new CustomConsole('Fadroma Devnet')

/** Gets devnet settings from environment. */
export class DevnetConfig extends EnvConfig {

  /** URL to the devnet manager endpoint, if used. */
  manager:   string|null =
    this.getString ('FADROMA_DEVNET_MANAGER',    ()=>null)

  /** Whether to remove the devnet after the command ends. */
  ephemeral: boolean =
    this.getBoolean('FADROMA_DEVNET_EPHEMERAL', ()=>false)

  /** Chain id for devnet .*/
  chainId:   string =
    this.getString ('FADROMA_DEVNET_CHAIN_ID',   ()=>"fadroma-devnet")

  /** Port for devnet. */
  port:      string|null =
    this.getString ('FADROMA_DEVNET_PORT',       ()=>null)

}

/** A Devnet is created from a given chain ID with given pre-configured identities,
  * and its state is stored in a given directory (e.g. `receipts/fadroma-devnet`). */
export interface DevnetOpts {
  /** Internal name that will be given to chain. */
  chainId?:    string
  /** Names of genesis accounts to be created with the node */
  identities?: Array<string>
  /** Path to directory where state will be stored. */
  stateRoot?:  string,
  /** Port to connect to. */
  port?:       number
  /** Which of the services should be exposed the devnet's port. */
  portMode?:   DevnetPortMode
  /** Whether to destroy this devnet on exit. */
  ephemeral?:  boolean
}

/** Used to reconnect between runs. */
export interface DevnetState {
  /** ID of Docker container to restart. */
  containerId?: string
  /** Chain ID that was set when creating the devnet. */
  chainId:      string
  /** The port on which the devnet will be listening. */
  port:         number|string
}

export abstract class Devnet implements Fadroma.DevnetHandle {

  /** Default connection type to expose on the devnets. */
  static defaultPort: Record<DevnetKind, DevnetPortMode> = {
    'scrt_1.2': 'lcp',
    'scrt_1.3': 'grpcWeb'
  }

  static get (
    kind:     DevnetKind,
    manager?: string,
    chainId?: string,
    dokeres?: Dokeres.Engine
  ): Devnet {
    if (manager) {
      return RemoteDevnet.getOrCreate(kind, 'TODO', manager, undefined, chainId, chainId)
    } else {
      return DockerDevnet.getOrCreate(kind, dokeres)
    }
  }

  static async reset ({ chain }: { chain: Fadroma.Chain }) {
    if (!chain) {
      log.info('No active chain.')
    } else if (!chain.isDevnet || !chain.node) {
      log.info('This command is only valid for devnets.')
    } else {
      await chain.node.terminate()
    }
  }

  static define (
    Chain: { new(...args:any[]): Fadroma.Chain },
    version: DevnetKind
  ) {
    return async <T> (config: T) => {
      const mode = Fadroma.ChainMode.Devnet
      const node = await Devnet.get(version)
      const id   = node.chainId
      const url  = node.url.toString()
      return new Chain(id, { url, mode, node })
    }
  }

  /** Create an object representing a devnet.
    * Must call the `respawn` method to get it running. */
  constructor ({
    chainId,
    identities,
    stateRoot,
    port,
    portMode,
    ephemeral
  }: DevnetOpts) {
    this.ephemeral = ephemeral ?? this.ephemeral
    this.chainId   = chainId      || this.chainId
    this.port      = Number(port) || this.port
    this.portMode  = portMode!
    if (!this.chainId) {
      throw new Error(
        '@fadroma/ops/Devnet: refusing to create directories for devnet with empty chain id'
      )
    }
    if (identities) {
      this.genesisAccounts = identities
    }
    stateRoot      = stateRoot || resolve(cwd(), 'receipts', this.chainId)
    this.stateRoot = $(stateRoot).as(Kabinet.OpaqueDirectory)
    this.nodeState = this.stateRoot.at('node.json').as(Kabinet.JSONFile) as Kabinet.JSONFile<DevnetState>
  }

  /** Whether to destroy this devnet on exit. */
  ephemeral = false

  /** The chain ID that will be passed to the devnet node. */
  chainId  = 'fadroma-devnet'

  /** The protocol of the API URL without the trailing colon. */
  protocol = 'http'

  /** The hostname of the API URL. */
  host     = 'localhost'

  /** The port of the API URL. If `null`, `freePort` will be used to obtain a random port. */
  port     = 9091

  /** Which service does the API URL port correspond to. */
  portMode: DevnetPortMode

  /** The API URL that can be used to talk to the devnet. */
  get url (): URL {
    const url = `${this.protocol}://${this.host}:${this.port}`
    return new URL(url)
  }

  /** This directory is created to remember the state of the devnet setup. */
  stateRoot: Kabinet.OpaqueDirectory

  /** List of genesis accounts that will be given an initial balance
    * when creating the devnet container for the first time. */
  genesisAccounts: Array<string> = ['ADMIN', 'ALICE', 'BOB', 'CHARLIE', 'MALLORY']

  /** This file contains the id of the current devnet container.
    * TODO store multiple containers */
  nodeState: JSONFile<DevnetState>

  /** Save the info needed to respawn the node */
  save (extraData = {}) {
    const shortPath = relative(cwd(), this.nodeState.path)
    //log.info(`Saving devnet node to ${shortPath}`)
    const data = { chainId: this.chainId, port: this.port, ...extraData }
    this.nodeState.save(data)
    return this
  }

  /** Restore this node from the info stored in the nodeState file */
  async load (): Promise<DevnetState|null> {
    const path = relative(cwd(), this.nodeState.path)
    if (this.stateRoot.exists() && this.nodeState.exists()) {
      //log.info(bold(`Loading:  `), path)
      try {
        const data = this.nodeState.load()
        const { chainId, port } = data
        if (this.chainId !== chainId) {
          log.warn(`Loading state of ${chainId} into Devnet with id ${this.chainId}`)
        }
        this.port = port as number
        return data
      } catch (e) {
        log.warn(`Failed to load ${path}. Deleting it`)
        this.stateRoot.delete()
        throw e
      }
    } else {
      log.info(`${path} does not exist.`)
      return null
    }
  }

  /** Stop this node and delete its state. */
  async terminate () {
    await this.kill()
    await this.erase()
  }

  /** Retrieve an identity */
  abstract getGenesisAccount (name: string): Promise<Fadroma.AgentOpts>

  /** Start the node. */
  abstract spawn (): Promise<this>

  /** Start the node if stopped. */
  abstract respawn (): Promise<this>

  /** Stop the node. */
  abstract kill (): Promise<void>

  /** Erase the state of the node. */
  abstract erase (): Promise<void>

}

export type DevnetPortMode = 'lcp'|'grpcWeb'

/** Parameters for the Dockerode-based implementation of Devnet.
  * (https://www.npmjs.com/package/dockerode) */
export interface DockerDevnetOpts extends DevnetOpts {
  /** Docker image of the chain's runtime. */
  image?:       Dokeres.Image
  /** Init script to launch the devnet. */
  initScript?:  string
  /** Once this string is encountered in the log output
    * from the container, the devnet is ready to accept requests. */
  readyPhrase?: string
}

export type DevnetKind = 'scrt_1.2'|'scrt_1.3'

/** Fadroma can spawn a devnet in a container using Dockerode.
  * This requires an image name and a handle to Dockerode. */
export class DockerDevnet extends Devnet implements Fadroma.DevnetHandle {

  static dockerfiles: Record<DevnetKind, string> = {
    'scrt_1.2': resolve(devnetPackage, 'scrt_1_2.Dockerfile'),
    'scrt_1.3': resolve(devnetPackage, 'scrt_1_3.Dockerfile')
  }

  static dockerTags: Record<DevnetKind, string> = {
    'scrt_1.2': 'fadroma/scrt-devnet:1.2',
    'scrt_1.3': 'fadroma/scrt-devnet:1.3',
  }

  static initScriptName = 'devnet-init.mjs'

  static getOrCreate (kind: DevnetKind, dokeres = new Dokeres.Engine()) {
    const portMode    = Devnet.defaultPort[kind]
    const dockerfile  = this.dockerfiles[kind]
    const imageTag    = this.dockerTags[kind]
    const readyPhrase = 'indexed block'
    const initScript  = resolve(devnetPackage, this.initScriptName)
    const image       = dokeres.image(imageTag, dockerfile, [this.initScriptName])
    return new DockerDevnet({ portMode, image, readyPhrase, initScript })
  }

  constructor (options: DockerDevnetOpts = {}) {
    super(options)
    log.trace('Constructing devnet with', bold('@hackbg/dokeres'))
    this.identities  ??= this.stateRoot.in('identities').as(Kabinet.JSONDirectory)
    this.image       ??= options.image!
    this.initScript  ??= options.initScript!
    this.readyPhrase ??= options.readyPhrase!
  }

  get dokeres (): Dokeres.Engine|null {
    return this.image.dokeres
  }

  /** This should point to the standard production docker image for the network. */
  image: Dokeres.Image

  /** Handle to created devnet container */
  container: Dokeres.Container|null = null

  /** Mounted into devnet container in place of default init script
    * in order to add custom genesis accounts with initial balances
    * and store their keys. */
  initScript: string

  /** Mounted out of devnet container to persist keys of genesis wallets. */
  identities: Kabinet.JSONDirectory<unknown>

  /** Gets the info for a genesis account, including the mnemonic */
  async getGenesisAccount (name: string): Promise<Fadroma.AgentOpts> {
    return this.identities.at(`${name}.json`).as(JSONFile).load() as Fadroma.AgentOpts
  }

  /** Once this phrase is encountered in the log output
    * from the container, the devnet is ready to accept requests. */
  readyPhrase: string

  /** Path under which the init script is mounted in the container. */
  get initScriptName (): string {
    return resolve('/', basename(this.initScript))
  }

  async spawn () {
    // tell the user that we have begun
    log.info(`Spawning new node...`)
    // if no port is specified, use a random port
    if (!this.port) {
      this.port = (await freePort()) as number
    }
    // create the state dirs and files
    const items = [this.stateRoot, this.nodeState]
    for (const item of items) {
      try {
        item.make()
      } catch (e: any) {
        log.warn(`Failed to create ${item.path}: ${e.message}`)
      }
    }
    // run the container
    const containerName = `${this.chainId}-${this.port}`
    log.info('Creating and starting devnet container:', bold(containerName))
    this.container = await this.image.run(
      containerName, this.spawnOptions, ['node', this.initScriptName], '/usr/bin/env'
    )
    // update the record
    this.save()
    // wait for logs to confirm that the genesis is done
    await this.container.waitLog(this.readyPhrase, false, this.waitSeconds, DockerDevnet.logFilter)
    // wait for port to be open
    await this.waitPort({ host: this.host, port: Number(this.port) })
    return this
  }

  get spawnOptions () {
    const env: Record<string, string> = {
      ChainID:         this.chainId,
      GenesisAccounts: this.genesisAccounts.join(' '),
    }
    switch (this.portMode) {
      case 'lcp':     env.lcpPort     = String(this.port);      break
      case 'grpcWeb': env.grpcWebAddr = `0.0.0.0:${this.port}`; break
      default: throw new Error(`DockerDevnet#portMode must be either 'lcp' or 'grpcWeb'`)
    }
    return {
      env,
      exposed: [`${this.port}/tcp`],
      extra: {
        Tty:          true,
        AttachStdin:  true,
        AttachStdout: true,
        AttachStderr: true,
        Hostname:     this.chainId,
        Domainname:   this.chainId,
        HostConfig:   {
          NetworkMode: 'bridge',
          Binds: [
            `${this.initScript}:${resolve('/', basename(this.initScript))}:ro`,
            `${this.stateRoot.path}:/receipts/${this.chainId}:rw`
          ],
          PortBindings: {
            [`${this.port}/tcp`]: [{HostPort: `${this.port}`}]
          }
        }
      }
    }
  }

  /** Overridable for testing. */
  //@ts-ignore
  protected waitPort = waitPort

  /** Overridable for testing. */
  protected waitSeconds = 7

  /** Filter logs when waiting for the ready phrase. */
  static logFilter (data: string) {
    const RE_GARBAGE = /[\x00-\x1F]/
    return (
      data.length > 0                            &&
      !data.startsWith('TRACE ')                 &&
      !data.startsWith('DEBUG ')                 &&
      !data.startsWith('INFO ')                  &&
      !data.startsWith('I[')                     &&
      !data.startsWith('Storing key:')           &&
      !RE_GARBAGE.test(data)                     &&
      !data.startsWith('{"app_message":')        &&
      !data.startsWith('configuration saved to') &&
      !(data.length>1000)
    )
  }

  async load (): Promise<DevnetState> {
    const data = await super.load()
    if (data?.containerId) {
      this.container = await this.dokeres!.container(data.containerId)
    } else {
      throw new Error('@fadroma/ops/Devnet: missing container id in devnet state')
    }
    return data
  }

  /** Write the state of the devnet to a file. */
  save () {
    return super.save({ containerId: this.container?.id })
  }

  /** Spawn the existing localnet, or a new one if that is impossible */
  async respawn () {

    const shortPath = $(this.nodeState.path).shortPath

    // if no node state, spawn
    if (!this.nodeState.exists()) {
      log.info(`No devnet found at ${bold(shortPath)}`)
      return this.spawn()
    }

    // get stored info about the container was supposed to be
    let id: string
    try {
      id = (await this.load()).containerId!
    } catch (e) {
      // if node state is corrupted, spawn
      log.warn(e)
      log.info(`Reading ${bold(shortPath)} failed`)
      return this.spawn()
    }

    this.container = await this.dokeres!.container(id)

    // check if contract is running
    let running: boolean
    try {
      running = await this.container.isRunning
    } catch (e) {
      // if error when checking, RESPAWN
      log.info(`✋ Failed to get container ${bold(id)}`)
      log.info('Error was:', e)
      log.info(`Cleaning up outdated state...`)
      await this.erase()
      log.info(`Trying to launch a new node...`)
      return this.spawn()
    }

    // if not running, RESPAWN
    if (!running) {
      await this.container.start()
    }

    // ...and try to make sure it dies when the Node process dies
    process.on('beforeExit', () => {
      if (this.ephemeral) {
        this.container!.kill()
      } else {
        log.log()
        log.info(
          'Devnet is running on port', bold(String(this.port)),
          'from container', bold(this.container!.id.slice(0,8))
        )
      }
    })

    return this

  }

  /** Kill the container, if necessary find it first */
  async kill () {

    if (this.container) {
      const { id } = this.container
      await this.container.kill()
      log.info(
        `Stopped container`, bold(id)
      )
      return
    }

    log.info(`Checking if there's an old node that needs to be stopped...`)

    try {
      const { containerId } = await this.load()
      await this.container!.kill()
      log.info(`Stopped container ${bold(containerId!)}.`)
    } catch (_e) {
      log.info("Didn't stop any container.")
    }

  }

  /** External environment needs to be returned to a pristine state via Docker.
    * (Otherwise, root-owned dotdirs leak and have to be manually removed with sudo.) */
  async erase () {
    const path = bold(relative(cwd(), this.stateRoot.path))
    try {
      if (this.stateRoot.exists()) {
        log.info(`Deleting ${path}...`)
        this.stateRoot.delete()
      }
    } catch (e: any) {
      if (e.code === 'EACCES' || e.code === 'ENOTEMPTY') {
        log.warn(`Failed to delete ${path}: ${e.code}; trying cleanup container...`)
        await this.image.ensure()
        const containerName = `${this.chainId}-${this.port}-cleanup`
        const options = {
          AutoRemove: true,
          Image:      this.image.name,
          Entrypoint: [ '/bin/rm' ],
          Cmd:        ['-rvf', '/state',],
          HostConfig: { Binds: [`${this.stateRoot.path}:/state:rw`] }
          //Tty: true, AttachStdin: true, AttachStdout: true, AttachStderr: true,
        }
        const cleanupContainer = await this.image.run(
          containerName,
          { extra: options },
          ['-rvf', '/state'],
          '/bin/rm'
        )
        log.info(`Starting cleanup container...`)
        await cleanupContainer.start()
        log.info('Waiting for cleanup to finish...')
        await cleanupContainer.wait()
        log.info(`Deleted ${path} via cleanup container.`)
      } else {
        log.warn(`Failed to delete ${path}: ${e.message}`)
        throw e
      }
    }
  }

}

/** Parameters for the HTTP API-managed implementation of Devnet. */
export type RemoteDevnetOpts = DevnetOpts & {
  /** Base URL of the API that controls the managed node. */
  managerURL: string
}

/** When running in docker-compose, Fadroma needs to request
  * from the devnet container to spawn a chain node with the
  * given chain id and identities via a HTTP API. */
export class RemoteDevnet extends Devnet implements Fadroma.DevnetHandle {

  static managerScriptName = 'devnet-manager.mjs'

  /** Get a handle to a remote devnet. If there isn't one,
    * create one. If there already is one, reuse it. */
  static getOrCreate (
    kind:        DevnetKind,
    projectRoot: string,
    managerURL:  string,
    chainId?:    string,
    prefix?:     string,
    portMode:    string = Devnet.defaultPort[kind]
  ) {

    // If passed a chain id, use it; this makes a passed prefix irrelevant.
    if (chainId && prefix) {
      log.warn('Passed both chainId and prefix to RemoteDevnet.getOrCreate: ignoring prefix')
    }

    // Establish default prefix. Chain subclasses should define this.
    if (!prefix) {
      prefix = 'devnet'
    }

    // If no chain id passed, try to reuse the last created devnet;
    // if there isn't one, create a new one and symlink it as active.
    if (!chainId) {
      const active = $(projectRoot, 'receipts', `${prefix}-active`)
      if ($(active).exists()) {
        chainId = basename(readlinkSync(active.path))
        log.info('Reusing existing managed devnet with chain id', bold(chainId))
      } else {
        chainId = `${prefix}-${randomHex(4)}`
        const devnet = $(projectRoot).in('receipts').in(chainId)
        devnet.make()
        symlinkSync(devnet.path, active.path)
        log.info('Creating new managed devnet with chain id', bold(chainId))
      }
    }

    return new RemoteDevnet({ managerURL, chainId, portMode })

  }

  constructor (options: any) {
    super(options)
    log.info('Constructing', bold('remotely managed'), 'devnet')
    this.manager = new Endpoint(options.managerURL)
    this.host    = this.manager.url.hostname
  }

  manager: Endpoint

  async spawn () {
    const port = await freePort()
    this.port = port
    log.info(bold('Spawning managed devnet'), this.chainId, 'on port', port)
    const result = await this.manager.get('/spawn', {
      id:          this.chainId,
      genesis:     this.genesisAccounts.join(','),
      lcpPort:     (this.portMode === 'lcp')     ? String(port)      : undefined,
      grpcWebAddr: (this.portMode === 'grpcWeb') ? `0.0.0.0:${port}` : undefined
    })
    if (result.error === 'Node already running') {
      log.info('Remote devnet already running')
      if (this.portMode === 'lcp' && result.lcpPort) {
        this.port = Number(result.lcpPort)
      } else if (this.portMode === 'grpcWeb' && result.grpcWebAddr) {
        this.port = Number(new URL('idk://'+result.grpcWebAddr).port)
      }
      log.info('Reusing port', this.port, 'for', this.portMode)
    }
    await this.ready()
    log.info(`Waiting 7 seconds for good measure...`)
    await new Promise(ok=>setTimeout(ok, 7000))
    return this
  }

  save () {
    const shortPath = $(this.nodeState.path).shortPath
    log.info(`Saving devnet node to ${shortPath}`)
    const data = { chainId: this.chainId, port: this.port }
    this.nodeState.save(data)
    return this
  }

  async respawn () {
    const shortPath = $(this.nodeState.path).shortPath
    // if no node state, spawn
    if (!this.nodeState.exists()) {
      log.info(`No devnet found at ${bold(shortPath)}`)
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
      log.info('Waiting for devnet to become ready...')
      await new Promise(resolve=>setTimeout(resolve, 2000))
    }
  }

  async getGenesisAccount (name: string): Promise<Fadroma.AgentOpts> {
    const identity = await this.manager.get('/identity', { name })
    if (identity.error) {
      throw new Error(`RemoteDevnet#getGenesisAccount: failed to get ${name}: ${identity.error}`)
    }
    return identity
  }

  async erase () {
    throw new Error('RemoteDevnet#erase: not implemented')
  }

  async kill () {
    throw new Error('RemoteDevnet#kill: not implemented')
  }

}

export default class DevnetCommands extends Fadroma.Deployment {

  constructor (options: Partial<DevnetCommands> = {}) {
    options.name ??= 'devnet'
    super(options as Partial<Fadroma.Deployment>)
    this
      .command('status', 'print the status of the current devnet', this.status)
      .command('reset',  'print the status of the current devnet', this.reset)
  }

  status = () => {
    new Fadroma.ClientConsole('Fadroma Devnet').chainStatus(this)
  }

  reset = () => {
    if (this.chain) return Devnet.reset({ chain: this.chain })
  }

}

export class DevnetError extends CustomError {

  static NoChainId = this.define('NoChainId',
    ()=>'No chain id')

  static PortMode = this.define('PortMode',
    ()=>"DockerDevnet#portMode must be either 'lcp' or 'grpcWeb'")

  static NoContainerId = this.define('NoContainerId',
    ()=>'Missing container id in devnet state')

  static NoGenesisAccount = this.define('NoGenesisAccount',
    (name: string, error: any)=>
      `Genesis account not found: ${name} (${error})`)

}
