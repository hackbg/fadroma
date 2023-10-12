/**

  Fadroma Devnet
  Copyright (C) 2023 Hack.bg

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.

**/

import type { Agent, ChainClass, ChainId, DevnetHandle } from './fadroma'
import Config from './fadroma-config'

import { Error as BaseError, Console, bold, randomHex, ChainMode, Chain, randomChainId } from '@fadroma/connect'

import $, { JSONFile, JSONDirectory, OpaqueDirectory } from '@hackbg/file'
import type { Path } from '@hackbg/file'
import { freePort, Endpoint, waitPort, isPortTaken } from '@hackbg/port'
import * as Dock from '@hackbg/dock'

import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'

/** Path to this package. Used to find the build script, dockerfile, etc.
  * WARNING: Keep the ts-ignore otherwise it might break at publishing the package. */
//@ts-ignore
const thisPackage = dirname(fileURLToPath(import.meta.url))

/** Supported connection types. */
export type DevnetPortMode = 'lcp'|'grpcWeb'

/** Supported devnet variants. */
export type DevnetPlatform = 
  | `scrt_1.${2|3|4|5|6|7|8|9}`
  | `okp4_5.0`

/** A private local instance of a network. */
export class Devnet implements DevnetHandle {
  /** Is this thing on? */
  running: boolean = false
  /** Containerization engine (Docker or Podman). */
  engine?: Dock.Engine
  /** Path to Dockerfile to build image */
  dockerfile?: string
  /** Name or tag of image if set */
  imageTag?: string
  /** ID of container if exists */
  containerId?: string
  /** Whether to use Podman instead of Docker to run the devnet container. */
  podman: boolean
  /** Which kind of devnet to launch */
  platform: DevnetPlatform
  /** Which service does the API URL port correspond to. */
  portMode: DevnetPortMode
  /** The chain ID that will be passed to the devnet node. */
  chainId: ChainId
  /** Whether to destroy this devnet on exit. */
  deleteOnExit: boolean
  /** Whether the devnet should remain running after the command ends. */
  keepRunning: boolean
  /** The protocol of the API URL without the trailing colon. */
  protocol: string
  /** The hostname of the API URL. */
  host: string
  /** The port of the API URL. */
  port?: string|number
  /** This directory is created to remember the state of the devnet setup. */
  stateDir: string
  /** If set, overrides the script that launches the devnet in the container. */
  initScript?: string
  /** Whether to skip mounting a local state directory into/out of the container. */
  dontMountState: boolean
  /** Once this phrase is encountered in the log output
    * from the container, the devnet is ready to accept requests. */
  readyPhrase: string
  /** After how many seconds to throw if container is not ready. */
  launchTimeout: number
  /** Whether more detailed output is preferred. */
  verbose: boolean
  /** List of genesis accounts that will be given an initial balance
    * when creating the devnet container for the first time. */
  accounts: Array<string> = [ 'Admin', 'Alice', 'Bob', 'Charlie', 'Mallory' ]

  /** Overridable for testing. */
  //@ts-ignore
  protected waitPort = waitPort
  /** Seconds to wait after first block.
    * Overridable for testing. */
  protected postLaunchWait = 7
  /** Kludge. */
  private exitHandlerSet = false

  /** Create an object representing a devnet.
    * Must call the `respawn` method to get it running. */
  constructor (options: Partial<Devnet> = {}) {
    // This determines whether generated chain id has random suffix
    this.deleteOnExit = options.deleteOnExit ?? false
    // This determines the state directory path
    this.chainId = options.chainId ?? randomChainId()
    if (!this.chainId) throw new DevnetError.NoChainId()
    // Try to update options from stored state
    this.stateDir = options.stateDir ?? $('state', this.chainId).path
    if ($(this.stateDir).isDirectory() && this.stateFile.isFile()) {
      try {
        const state = this.stateFile.as(JSONFile).load() || {}
        // Options always override stored state
        options = { ...state, ...options }
      } catch (e) {
        throw new DevnetError.LoadingFailed(this.stateFile.path, e)
      }
    }
    // Apply the rest of the configuration options
    const defaultInit   = resolve(dirname(fileURLToPath(import.meta.url)), 'devnets', 'devnet.init.mjs')
    this.initScript     = options.initScript! ?? defaultInit
    this.keepRunning    = options.keepRunning ?? !this.deleteOnExit
    this.podman         = options.podman ?? false
    this.platform       = options.platform ?? 'scrt_1.9'
    this.verbose        = options.verbose ?? false
    this.launchTimeout  = options.launchTimeout ?? 10
    this.dontMountState = options.dontMountState ?? false
    this.accounts       = options.accounts ?? this.accounts
    this.readyPhrase    = options.readyPhrase ?? Devnet.readyMessage[this.platform]
    this.protocol       = options.protocol ?? 'http'
    this.host           = options.host ?? 'localhost'
    this.portMode       = Devnet.portModes[this.platform]
    this.port           = options.port ?? ((this.portMode === 'lcp') ? 1317 : 9091)
    this.engine         = options.engine ?? new Dock[this.podman?'Podman':'Docker'].Engine()
    this.containerId    = options.containerId ?? this.containerId
    this.imageTag       = options.imageTag ?? this.imageTag ?? Devnet.dockerTags[this.platform]
    this.dockerfile     = options.dockerfile ?? this.dockerfile ?? Devnet.dockerfiles[this.platform]
  }

  get log (): DevnetConsole {
    return new DevnetConsole(`${this.chainId} @ ${this.host}:${this.port}`)
  }

  /** The API URL that can be used to talk to the devnet. */
  get url (): URL {
    return new URL(`${this.protocol}://${this.host}:${this.port}`)
  }

  /** This should point to the standard production docker image for the network. */
  get image () {
    if (this.engine && this.imageTag) {
      return this.engine.image(this.imageTag, this.dockerfile, [this.initScriptMount]).ensure()
    }
  }

  /** Virtual path inside the container where the init script is mounted. */
  get initScriptMount (): string {
    return this.initScript ? $('/', $(this.initScript).name).path : '/devnet.init.mjs'
  }

  /** Environment variables in the container. */
  get spawnEnv () {
    const env: Record<string, string> = {
      DAEMON:    Devnet.daemonBinary[this.platform],
      CHAIN_ID:  this.chainId,
      ACCOUNTS:  this.accounts.join(' '),
      STATE_UID: String((process.getuid!)()),
      STATE_GID: String((process.getgid!)()),
    }
    if (this.verbose) {
      env['VERBOSE'] = 'yes'
    }
    if (this.portMode === 'lcp') {
      env['LCP_PORT'] = String(this.port)
    } else if (this.portMode === 'grpcWeb') {
      env['GRPC_WEB_ADDR'] = `0.0.0.0:${this.port}`
    } else {
      throw new DevnetError.PortMode(this.portMode)
    }
    return env
  }

  /** Options for the container. */
  get spawnOptions () {
    const Binds: string[] = []
    if (this.initScript) {
      Binds.push(`${this.initScript}:${this.initScriptMount}:ro`)
    }
    if (!this.dontMountState) {
      Binds.push(`${$(this.stateDir).path}:/state/${this.chainId}:rw`)
    }
    const NetworkMode  = 'bridge'
    const PortBindings = {[`${this.port}/tcp`]: [{HostPort: `${this.port}`}]}
    const HostConfig   = {Binds, NetworkMode, PortBindings}
    const Tty          = true
    const AttachStdin  = true
    const AttachStdout = true
    const AttachStderr = true
    const Hostname     = this.chainId
    const Domainname   = this.chainId
    const extra   = {Tty, AttachStdin, AttachStdout, AttachStderr, Hostname, Domainname, HostConfig}
    const options = {env: this.spawnEnv, exposed: [`${this.port}/tcp`], extra}
    return options
  }

  /** Handle to created devnet container */
  get container () {
    if (this.engine && this.containerId) {
      return this.engine.container(this.containerId)
    }
  }

  /** Emit a warning if devnet state is missing. */
  async assertPresence () {
    if (this.containerId) {
      try {
        await (await this.container!).inspect()
        this.log.info("container id:", bold(this.containerId.slice(0, 8)))
      } catch (e) {
        throw new Error(
          `Failed to connect to devnet "${this.chainId}": ${e.message}`
        )
      }
    }
  }

  /** Create the devnet container and save state. */
  create = async (): Promise<this> => {
    const exists = await this.container?.catch(()=>null)
    if (exists) {
      this.log.alreadyExists(this.containerId)
    } else {
      this.log('Creating...')
      // ensure we have image and chain id
      const image = await this.image
      if (!this.image) throw new DevnetError.Missing.DevnetImage()
      if (!this.chainId) throw new DevnetError.Missing.ChainId()
      // if port is unspecified or taken, increment
      while (!this.port || await isPortTaken(Number(this.port))) {
        const taken = this.port
        this.port = Number(this.port) + 1 || await freePort()
        if (this.port < 1024 || this.port > 65535) Object.assign(this, { port: undefined })
        if (this.port) this.log.tryingPort(this.port, taken)
      }
      // create container
      this.log.creating(this)
      const init = this.initScript ? [this.initScriptMount] : []
      const container = image!.container(this.chainId, this.spawnOptions, init)
      await container.create()
      this.setExitHandler()
      // set id and save
      this.log.createdContainer(container.id)
      this.containerId = container.id
    }
    return await this.save()
  }

  /** Write the state of the devnet to a file. This saves the info needed to respawn the node */
  save = async (extra = {}): Promise<this> => {
    this.stateFile.save({
      chainId:     this.chainId,
      containerId: this.containerId,
      port:        this.port,
      imageTag:    this.imageTag,
      podman:      this.podman||undefined,
    })
    return this
  }

  /** This file contains the id of the current devnet container.
    * TODO store multiple containers */
  get stateFile (): JSONFile<Partial<this>> {
    return $(this.stateDir, Devnet.stateFile)
      .as(JSONFile) as JSONFile<Partial<this>>
  }

  /** Start the container. */
  start = async (): Promise<this> => {
    this.log('Starting...')
    if (!this.running) {
      const container = await this.container ?? await (await this.create()).container!
      this.log.startingContainer(container.id)
      try {
        await container.start()
      } catch (e) {
        // Don't throw if container already started.
        // TODO: This must be handled in @hackbg/dock
        if (e.code !== 304) throw e
      }
      this.running = true
      await this.save()
      await container.waitLog(this.readyPhrase, Devnet.logFilter, true)
      await Dock.Docker.waitSeconds(this.postLaunchWait)
      await this.waitPort({ host: this.host, port: Number(this.port) })
    }
    return this
  }

  /** Stop the container. */
  pause = async () => {
    this.log('Pausing...')
    const container = await this.container
    if (container) {
      this.log.stoppingContainer(container.id)
      try {
        if (await container.isRunning) await container.kill()
      } catch (e) {
        if (e.statusCode == 404) {
          this.log.warnContainerNotFound(this.containerId)
        } else {
          throw e
        }
      }
    }
    this.running = false
    return this
  }

  /** Export the state of the devnet as a container image. */
  export = async (repository?: string, tag?: string) => {
    const container = await this.container
    if (!container) throw new DevnetError.CantExport("no container")
    return container.export(repository, tag)
  }

  delete = async () => {
    this.log('Deleting...')
    let container
    try {
      container = await this.container
    } catch (e) {
      if (e.statusCode === 404) {
        this.log.noContainerToDelete(this.containerId?.slice(0, 8))
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
        this.log.deleting(path)
        state.delete()
      }
    } catch (e: any) {
      if (e.code === 'EACCES' || e.code === 'ENOTEMPTY') {
        this.log.cannotDelete(path, e)
        await this.forceDelete()
      } else {
        this.log.failedToDelete(path, e)
        throw e
      }
    }
    return this
  }

  private async forceDelete () {
    const image = await this.image
    const path = $(this.stateDir).shortPath
    if (image) {
      this.log.runningCleanupContainer(path)
      await image.ensure()
      const name       = `${this.chainId}-cleanup`
      const AutoRemove = true
      const HostConfig = { Binds: [`${$(this.stateDir).path}:/state:rw`] }
      const extra      = { AutoRemove, HostConfig }
      const cleanupContainer = await image.run(name, { extra }, ['-rvf', '/state'], '/bin/rm')
      await cleanupContainer.start()
      this.log.waitingForCleanupContainer()
      await cleanupContainer.wait()
      this.log.cleanupContainerDone(path)
      $(this.stateDir).delete()
    }
  }

  /** Get a Chain object corresponding to this devnet. */
  getChain = <C extends Chain, D extends ChainClass<C>> (
    $C: ChainClass<C> = Chain as unknown as ChainClass<C>
  ): C => new $C({
    id:     this.chainId,
    mode:   Chain.Mode.Devnet,
    devnet: this
  })

  /** Get the info for a genesis account, including the mnemonic */
  getAccount = async (name: string): Promise<Partial<Agent>> => {
    if (this.dontMountState) {
      if (!this.container) throw new DevnetError.ContainerNotSet()
      const path = `/state/${this.chainId}/wallet/${name}.json`
      const [identity] = await (await this.container).exec('cat', path)
      return JSON.parse(identity)
    } else {
      return $(this.stateDir, 'wallet', `${name}.json`)
        .as(JSONFile)
        .load() as Partial<Agent>
    }
  }

  protected setExitHandler () {
    if (this.exitHandlerSet) {
      this.log.exitHandlerSet(this.chainId)
      return
    }
    let exitHandlerCalled = false
    const exitHandler = async () => {
      if (exitHandlerCalled) return
      if (this.deleteOnExit) {
        await this.pause()
        await this.delete()
      } else if (!this.keepRunning) {
        await this.pause()
      } else {
        this.log.br()
        this.log.isNowRunning(this)
      }
    }
    process.once('beforeExit', exitHandler)
    process.once('uncaughtExceptionMonitor', exitHandler)
    this.exitHandlerSet = true
  }

  static deleteMany = (path: string|Path, ids?: ChainId[]): Promise<Devnet[]> => {
    const state = $(path).as(OpaqueDirectory)
    const chains = (state.exists()&&state.list()||[])
      .map(name => $(state, name))
      .filter(path => path.isDirectory())
      .map(path => path.at(Devnet.stateFile).as(JSONFile))
      .filter(path => path.isFile())
      .map(path => $(path, '..'))
    return Promise.all(chains.map(dir=>Devnet.load(dir, true).delete()))
  }

  /** Restore a Devnet from the info stored in the state file */
  static load (dir: string|Path, allowInvalid: boolean = false): Devnet {
    const console = new DevnetConsole('devnet')
    dir = $(dir)
    if (!dir.isDirectory()) {
      throw new DevnetError.NotADirectory(dir.path)
    }
    const stateFile = dir.at(Devnet.stateFile)
    if (!dir.at(Devnet.stateFile).isFile()) {
      throw new DevnetError.NotAFile(stateFile.path)
    }
    let state: Partial<Devnet> = {}
    try {
      state = stateFile.as(JSONFile).load() || {}
    } catch (e) {
      console.warn(e)
      if (!allowInvalid) {
        throw new DevnetError.LoadingFailed(stateFile.path)
      }
    }
    console.missingValues(state, stateFile.path)
    return new Devnet(state)
  }

  static stateFile = 'devnet.json'

  static dockerfiles: Record<DevnetPlatform, string> = {
    'scrt_1.2': $(thisPackage, 'devnets', 'scrt_1_2.Dockerfile').path,
    'scrt_1.3': $(thisPackage, 'devnets', 'scrt_1_3.Dockerfile').path,
    'scrt_1.4': $(thisPackage, 'devnets', 'scrt_1_4.Dockerfile').path,
    'scrt_1.5': $(thisPackage, 'devnets', 'scrt_1_5.Dockerfile').path,
    'scrt_1.6': $(thisPackage, 'devnets', 'scrt_1_6.Dockerfile').path,
    'scrt_1.7': $(thisPackage, 'devnets', 'scrt_1_7.Dockerfile').path,
    'scrt_1.8': $(thisPackage, 'devnets', 'scrt_1_8.Dockerfile').path,
    'scrt_1.9': $(thisPackage, 'devnets', 'scrt_1_9.Dockerfile').path,
    'okp4_5.0': $(thisPackage, 'devnets', 'okp4_5_0.Dockerfile').path,
  }

  static dockerTags: Record<DevnetPlatform, string> = {
    'scrt_1.2': 'ghcr.io/hackbg/fadroma-devnet-scrt-1.2:master',
    'scrt_1.3': 'ghcr.io/hackbg/fadroma-devnet-scrt-1.3:master',
    'scrt_1.4': 'ghcr.io/hackbg/fadroma-devnet-scrt-1.4:master',
    'scrt_1.5': 'ghcr.io/hackbg/fadroma-devnet-scrt-1.5:master',
    'scrt_1.6': 'ghcr.io/hackbg/fadroma-devnet-scrt-1.6:master',
    'scrt_1.7': 'ghcr.io/hackbg/fadroma-devnet-scrt-1.7:master',
    'scrt_1.8': 'ghcr.io/hackbg/fadroma-devnet-scrt-1.8:master',
    'scrt_1.9': 'ghcr.io/hackbg/fadroma-devnet-scrt-1.9:master',
    'okp4_5.0': 'ghcr.io/hackbg/fadroma-devnet-okp4-5.0:master',
  }

  static readyMessage: Record<DevnetPlatform, string> = {
    'scrt_1.2': 'indexed block',
    'scrt_1.3': 'indexed block',
    'scrt_1.4': 'indexed block',
    'scrt_1.5': 'indexed block',
    'scrt_1.6': 'indexed block',
    'scrt_1.7': 'indexed block',
    'scrt_1.8': 'Done verifying block height',
    'scrt_1.9': 'Validating proposal',
    'okp4_5.0': 'NOT KNOWN YET',
  }

  static daemonBinary: Record<DevnetPlatform, string> = {
    'scrt_1.2': 'secretd',
    'scrt_1.3': 'secretd',
    'scrt_1.4': 'secretd',
    'scrt_1.5': 'secretd',
    'scrt_1.6': 'secretd',
    'scrt_1.7': 'secretd',
    'scrt_1.8': 'secretd',
    'scrt_1.9': 'secretd',
    'okp4_5.0': 'okp4d',
  }

  static initScriptMount = 'devnet.init.mjs'

  /** Filter logs when waiting for the ready phrase. */
  static logFilter = (data: string) => {
    return ((data.length > 0 && data.length <= 1024)
      && !data.startsWith('TRACE ')
      && !data.startsWith('DEBUG ')
      && !data.startsWith('INFO ')
      && !data.startsWith('I[')
      && !data.startsWith('Storing key:')
      && !this.RE_NON_PRINTABLE.test(data)
      && !data.startsWith('{"app_message":')
      && !data.startsWith('configuration saved to')
    )
  }

  /** Regexp for non-printable characters. */
  static RE_NON_PRINTABLE = /[\x00-\x1F]/

  /** Default connection type to expose on each devnet variant. */
  static portModes: Record<DevnetPlatform, DevnetPortMode> = {
    'scrt_1.2': 'lcp',
    'scrt_1.3': 'grpcWeb',
    'scrt_1.4': 'grpcWeb',
    'scrt_1.5': 'lcp',
    'scrt_1.6': 'lcp',
    'scrt_1.7': 'lcp',
    'scrt_1.8': 'lcp',
    'scrt_1.9': 'lcp',
    'okp4_5.0': 'lcp',
  }
}

class DevnetConsole extends Console {
  tryingPort = (port: string|number, taken?: string|number) =>
    taken
      ? this.log('Port', bold(taken), 'is taken, trying port', bold(port))
      : this.log(`Trying port`, bold(port))
  creating = ({ chainId, url }: Partial<Devnet>) =>
    this.log(`Creating devnet`, bold(chainId), `on`, bold(String(url)))
  loadingState = (chainId1: string, chainId2: string) =>
    this.info(`Loading state of ${chainId1} into Devnet with id ${chainId2}`)
  loadingFailed = (path: string) =>
    this.warn(`Failed to load devnet state from ${path}. Deleting it.`)
  loadingRejected = (path: string) =>
    this.log(`${path} does not exist.`)
  createdContainer = (id: string = '') =>
    this.log(`Created container`, bold(id.slice(0, 8)))
  alreadyExists = (id: string = '') =>
    this.log(`Devnet already exists in container`, bold(id.slice(0, 8)))
  startingContainer = (id: string = '') =>
    this.log(`Starting container`, bold(id.slice(0, 8)))
  stoppingContainer = (id: string = '') =>
    this.log(`Stopping container`, bold(id.slice(0, 8)))
  warnContainerNotFound = (id: string = '') =>
    this.warn(`Container ${bold(id.slice(0, 8))} not found`)
  noContainerToDelete = (id: string = '') =>
    this.log(`No container found`, bold(id.slice(0, 8)))
  missingValues = ({ chainId, containerId, port }: Partial<Devnet>, path: string) => {
    if (!containerId) console.warn(`${path}: no containerId`)
    if (!chainId)     console.warn(`${path}: no chainId`)
    if (!port)        console.warn(`${path}: no port`)
  }
  deleting = (path: string) =>
    this.log(`Deleting ${path}...`)
  cannotDelete = (path: string, error: any) =>
    this.warn(`Failed to delete ${path}: ${error.code}`)
  runningCleanupContainer = (path: string) =>
    this.log('Running cleanup container for', path)
  waitingForCleanupContainer = () =>
    this.log('Waiting for cleanup container to finish...')
  cleanupContainerDone = (path: string) =>
    this.log(`Deleted ${path}/* via cleanup container.`)
  failedToDelete = (path: string, error: any) =>
    this.warn(`Failed to delete ${path}:`, error)
  exitHandlerSet = (chainId: string) =>
    this.warn('Exit handler already set for', chainId)
  isNowRunning = ({ stateDir, chainId, containerId, port }: Partial<Devnet>) => {
    return this
      .log(
        'Devnet is running on port', bold(String(port)),
        `from container`, bold(containerId?.slice(0,8))
      ).info(
        'To remove the devnet:'
      ).info(
        '  $ npm run devnet reset'
      ).info(
        'Or manually:'
      ).info(
        `  $ docker kill`, containerId?.slice(0,8),
      ).info(
        `  $ docker rm`, containerId?.slice(0,8),
      ).info(
        `  $ sudo rm -rf state/${chainId??'fadroma-devnet'}`
      )
  }
}

export class DevnetError extends BaseError {
  static PortMode = this.define('PortMode',
    (mode?: string) => `devnet.portMode must be either 'lcp' or 'grpcWeb', found: ${mode}`)
  static NoChainId = this.define('NoChainId',
    ()=>'refusing to create directories for devnet with empty chain id')
  static NoContainerId = this.define('NoContainerId',
    ()=>'missing container id in devnet state')
  static ContainerNotSet = this.define('ContainerNotSet',
    ()=>'devnet.container is not set')
  static NoGenesisAccount = this.define('NoGenesisAccount',
    (name: string, error: any)=>`genesis account not found: ${name} (${error})`)
  static NotADirectory = this.define('NotADirectory',
    (path: string) => `not a directory: ${path}`)
  static NotAFile = this.define('NotAFile',
    (path: string) => `not a file: ${path}`)
  static CantExport = this.define('CantExport',
    (reason: string) => `can't export: ${reason}`)
  static LoadingFailed = this.define('LoadingFailed',
    (path: string, cause?: Error) =>
      `failed restoring devnet state from ${path}; ` +
      `try deleting ${dirname(path)}` +
      (cause ? ` ${cause.message}` : ``),
    (error: any, path: string, cause?: Error) =>
      Object.assign(error, { path, cause }))
}
