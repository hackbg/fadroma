import portManager, { waitPort } from '@hackbg/port'
import $, { Path, JSONFile } from '@hackbg/file'
import { OCIConnection, OCIImage, OCIContainer } from '@fadroma/oci'

import {
  assign,
  bold,
  colors,
  randomBase16,
  randomColor,
  Backend,
  Console,
  Identity,
} from '@fadroma/agent'
import type { Address, CodeId, Uint128, CompiledCode, Connection } from '@fadroma/agent'

import { packageRoot } from './package'
import type { APIMode } from './devnet'
import {
  containerOptions,
  forceDelete,
  defaultPorts,
  setExitHandler,
  FILTER
} from './devnet-impl'

/** A private local instance of a network,
  * running in a container managed by @fadroma/oci. */
export default abstract class DevnetContainer extends Backend {

  declare url: string

  /** Whether more detailed output is preferred. */
  verbose: boolean = false

  /** Containerization engine (Docker or Podman). */
  containerEngine?:   OCIConnection
  /** Name or tag of image if set */
  containerImageTag?: string
  /** Container image from which devnet will be spawned. */
  containerImage?:    OCIImage
  /** Path to Dockerfile to build the image if missing. */
  containerManifest?: string
  /** ID of container if exists */
  containerId?:       string

  /** Name of binary in container to start. */
  nodeBinary?:        string
  /** Which service does the API URL port correspond to. */
  nodePortMode?:      APIMode
  /** The protocol of the API URL without the trailing colon. */
  nodeProtocol:       string = 'http'
  /** The hostname of the API URL. */
  nodeHost:           string = 'localhost'
  /** The port of the API URL. */
  nodePort?:          string|number

  /** This directory is created to remember the state of the devnet setup. */
  stateDir:           Path
  /** Whether to skip mounting a local state directory into/out of the container. */
  dontMountState:     boolean = false

  /** Initial accounts. */
  genesisAccounts:    Record<Address, number|bigint|Uint128> = {}
  /** Initial uploads. */
  genesisUploads:     Record<CodeId, Partial<CompiledCode>> = {}

  /** If set, overrides the script that launches the devnet in the container. */
  initScript:         Path = $(packageRoot, 'devnet.init.mjs')

  /** Once this phrase is encountered in the log output
    * from the container, the devnet is ready to accept requests. */
  readyString:        string = ''

  /** What to do with the devnet once the process that has spawned it exits.
    * - "remain": the devnet container keeps running
    * - "pause": the devnet container is stopped
    * - "delete": the devnet container is stopped and deleted, along with the state directory */
  onExit: 'remain'|'pause'|'delete'

  /** The exit handler that cleans up external resources. */
  private exitHandler?: (...args: any)=>void

  constructor (options: Partial<DevnetContainer> = {}) {
    super(options)
    assign(this, options, [
      'chainId',
      'containerEngine',
      'containerId',
      'containerImageTag',
      'containerManifest',
      'dontMountState',
      'genesisAccounts',
      'genesisUploads',
      'initScript',
      'nodeBinary',
      'nodeHost',
      'nodePort',
      'nodePortMode',
      'nodeProtocol',
      'platform',
      'readyString',
      'verbose',
    ])
    if (this.nodePortMode) {
      this.nodePort ??= defaultPorts[this.nodePortMode]
    }
    this.containerEngine ??= new OCIConnection()
    if (this.containerEngine && this.containerImageTag) {
      this.containerImage = this.containerEngine.image(
        this.containerImageTag,
        this.containerManifest,
        [this.initScriptMount]
      )
      this.containerImage.log.label = this.log.label
    }
    if (!this.chainId) {
      if (!this.platform) {
        throw new Error('no platform or chainId specified')
      }
      this.chainId = `local-${this.platform}-${randomBase16(4).toLowerCase()}`
    }
    this.stateDir = $(options.stateDir ?? $('state', this.chainId).path)
    if ($(this.stateDir).isDirectory() && this.stateFile.isFile()) {
      try {
        const state = (this.stateFile.as(JSONFile).load() || {}) as Record<any, unknown>
        // Options always override stored state
        options = { ...state, ...options }
      } catch (e) {
        console.error(e)
        throw new Error(
          `failed to load devnet state from ${this.stateFile.path}: ${e.message}`
        )
      }
    }
    const loggerColor = randomColor({ luminosity: 'dark', seed: this.chainId })
    const loggerTag = colors.whiteBright.bgHex(loggerColor)(this.chainId)
    const logger = new Console(`Devnet ${loggerTag}`)
    Object.defineProperties(this, {
      url: {
        enumerable: true, configurable: true, get () {
          let url = `${this.nodeProtocol}://${this.nodeHost}:${this.nodePort}`
          try {
            return new URL(url).toString()
          } catch (e) {
            this.log.error(`Invalid URL: ${url}`)
            throw e
          }
        }, set () {
          throw new Error("can't change devnet url")
        }
      },
      log: {
        enumerable: true, configurable: true, get () {
          return logger
        }, set () {
          throw new Error("can't change devnet logger")
        }
      }
    })
  }

  /** Handle to created devnet container */
  get container () {
    if (this.containerEngine && this.containerId) {
      return this.containerEngine.container(this.containerId).then(container=>{
        container.log.label = this.log.label
        return container
      })
    }
  }

  /** Virtual path inside the container where the init script is mounted. */
  get initScriptMount (): string {
    return this.initScript ? $('/', $(this.initScript).basename).path : '/devnet.init.mjs'
  }

  /** Create the devnet container and save state. */
  async create (): Promise<this> {
    const exists = await this.container?.catch(()=>null)
    if (exists) {
      this.log(`Found`, bold(this.chainId), `in container`, bold(this.containerId?.slice(0, 8)))
    } else {
      if (this.verbose) {
        this.log.debug('Creating container for', bold(this.chainId))
      }
      // ensure we have image and chain id
      await this.containerImage.ensure()
      if (!this.chainId) {
        throw new Error("can't create devnet without chain ID")
      }
      // if port is unspecified or taken, increment
      this.nodePort = await portManager.getFreePort(this.nodePort)
      // create container
      this.log(`Creating devnet`, bold(this.chainId), `on`, bold(String(this.url)))
      const init = this.initScript ? [this.initScriptMount] : []
      const container = this.containerImage!.container(
        this.chainId, containerOptions(this), init
      )
      container.log.label = this.log.label
      await container.create()
      setExitHandler(this)
      // set id and save
      if (this.verbose) {
        this.log.debug(`Created container:`, bold(this.containerId?.slice(0, 8)))
      }
      this.containerId = container.id
    }
    return await this.save()
  }

  /** Idempotent create. */
  protected get containerCreated (): Promise<this> {
    const creating = this.create()
    Object.defineProperty(this, 'containerCreated', { get () { return creating } })
    return creating
  }

  /** Delete the devnet container and state. */
  async delete () {
    this.log('Deleting...')
    let container
    try {
      container = await this.container
    } catch (e) {
      if (e.statusCode === 404) {
        this.log(`No container found`, bold(this.containerId?.slice(0, 8)))
      } else {
        throw e
      }
    }
    if (container && await container?.isRunning) {
      if (await container.isRunning) {
        await this.pause()
      }
      await container.remove()
      this.containerId = undefined
    }
    const state = $(this.stateDir)
    const path = state.shortPath
    try {
      if (state.exists()) {
        this.log(`Deleting ${path}...`)
        state.delete()
      }
    } catch (e: any) {
      if (e.code === 'EACCES' || e.code === 'ENOTEMPTY') {
        this.log.warn(`unable to delete ${path}: ${e.code}, trying cleanup container`)
        await forceDelete(this)
      } else {
        this.log.error(`failed to delete ${path}:`, e)
        throw e
      }
    }
    return this
  }

  /** Start the container. */
  async start (): Promise<this> {
    if (!this.running) {
      const container = await this.container ?? await (await this.create()).container!
      this.log.debug(`Starting container:`, bold(this.containerId?.slice(0, 8)))
      try {
        await container.start()
      } catch (e) {
        this.log.warn(e)
        // Don't throw if container already started.
        // TODO: This must be handled in @fadroma/oci
        if (e.code !== 304) throw e
      }
      this.running = true
      await this.save()
      this.log.debug('Waiting for container to say:', bold(this.readyString))
      await container.waitLog(this.readyString, FILTER, true)
      this.log.debug('Waiting for', bold(String(this.postLaunchWait)), 'seconds...')
      await new Promise(resolve=>setTimeout(resolve, this.postLaunchWait))
      //await Dock.Docker.waitSeconds(this.postLaunchWait)
      await this.waitPort({ host: this.nodeHost, port: Number(this.nodePort) })
    } else {
      this.log.log('Container already started:', bold(this.chainId))
    }
    return this
  }

  /** Idempotent start. */
  get containerStarted (): Promise<this> {
    const starting = this.start()
    Object.defineProperty(this, 'containerStarted', { get () { return starting } })
    return starting
  }

  /** Stop the container. */
  async pause () {
    const container = await this.container
    if (container) {
      this.log.debug(`Stopping container:`, bold(this.containerId?.slice(0, 8)))
      try {
        if (await container.isRunning) await container.kill()
      } catch (e) {
        if (e.statusCode == 404) {
          this.log.warn(`Container ${bold(this.containerId?.slice(0, 8))} not found`)
        } else {
          throw e
        }
      }
    }
    this.running = false
    return this
  }

  /** Export the state of the devnet as a container image. */
  async export (repository?: string, tag?: string) {
    const container = await this.container
    if (!container) {
      throw new Error("can't export: no container")
    }
    return container.export(repository, tag)
  }

  async import () {
    throw new Error("unimplemented")
  }

  /** Write the state of the devnet to a file. This saves the info needed to respawn the node */
  async save (extra = {}): Promise<this> {
    this.stateFile.save({
      chainId:           this.chainId,
      containerImageTag: this.containerImageTag,
      containerId:       this.containerId,
      nodePort:          this.nodePort,
    })
    return this
  }

  /** This file contains the id of the current devnet container.
    * TODO store multiple containers */
  get stateFile (): JSONFile<Partial<this>> {
    return $(this.stateDir, DevnetContainer.stateFile).as(JSONFile) as JSONFile<Partial<this>>
  }

  /** Get info for named genesis account, including the mnemonic */
  async getIdentity (
    name: string|{ name?: string }
  ): Promise<Partial<Identity> & { mnemonic: string }> {

    if (typeof name === 'object') {
      name = name.name!
    }
    if (!name) {
      throw new Error('no name')
    }

    this.log.debug('Authenticating to devnet as genesis account:', bold(name))

    if (!$(this.stateDir).exists()) {
      this.log.debug('Waking devnet container')
      await this.containerCreated
      await this.containerStarted
    }

    if (this.dontMountState) {
      if (!this.container) {
        throw new Error('no devnet container')
      }
      const path = `/state/${this.chainId}/wallet/${name}.json`
      const [identity] = await (await this.container).exec('cat', path)
      return JSON.parse(identity)
    }

    return $(this.stateDir, 'wallet', `${name}.json`)
      .as(JSONFile<Partial<Identity> & { mnemonic: string }>)
      .load()
  }

  /** Name of the file containing devnet state. */
  static stateFile = 'devnet.json'

  /** Restore a Devnet from the info stored in the state file */
  static fromFile <A extends typeof Connection> (
    dir: string|Path, allowInvalid: boolean = false
  ): DevnetContainer {
    dir = $(dir)
    if (!dir.isDirectory()) {
      throw new Error(`not a directory: ${dir.path}`)
    }
    const stateFile = dir.at(DevnetContainer.stateFile)
    if (!dir.at(DevnetContainer.stateFile).isFile()) {
      throw new Error(`not a file: ${stateFile.path}`)
    }
    let state: Partial<DevnetContainer> = {}
    try {
      state = stateFile.as(JSONFile).load() || {}
    } catch (e) {
      console.warn(e)
      if (!allowInvalid) {
        throw new Error(`failed to load devnet state from ${stateFile.path}`)
      }
    }
    if (!state.containerId) {
      console.warn(`${stateFile.path}: no containerId`)
    }
    if (!state.chainId) {
      console.warn(`${stateFile.path}: no chainId`)
    }
    if (!state.nodePort) {
      console.warn(`${stateFile.path}: no port`)
    }
    throw new Error('not implemented')
  }

  /** Function that waits for port to open after launching container.
    * Tests override this to save time. */
  //@ts-ignore
  protected waitPort = waitPort

  /** Seconds to wait after first block.
    * Tests override this to save time. */
  protected postLaunchWait = 7

}
