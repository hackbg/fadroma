/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import {
  Error as BaseError, Console, Config,
  bold, randomHex, ChainMode, Chain, Scrt, CW,
  connectModes
} from '@fadroma/connect'
import type {
  CodeId, Agent, ChainClass, ChainId, DevnetHandle, Environment
} from '@fadroma/connect'

import $, { JSONFile, JSONDirectory, OpaqueDirectory } from '@hackbg/file'
import type { Path } from '@hackbg/file'
import ports, { waitPort } from '@hackbg/port'
import * as Dock from '@hackbg/dock'

import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'

/** Path to this package. Used to find the build script, dockerfile, etc.
  * WARNING: Keep the ts-ignore otherwise it might break at publishing the package. */
//@ts-ignore
const thisPackage = dirname(dirname(fileURLToPath(import.meta.url)))

/** @returns Devnet configured as per environment and options. */
export function getDevnet (options: Partial<DevnetConfig> = {}) {
  return new DevnetConfig(options).getDevnet()
}

/** Supported devnet variants. Add new devnets here first. */
export type DevnetPlatform =
  | `scrt_1.${2|3|4|5|6|7|8|9}`
  | `okp4_5.0`

/** Ports exposed by the devnet. One of these is used by default. */
export type DevnetPort = 'http'|'rpc'|'grpc'|'grpcWeb'

/** Parameters that define a supported devnet. */
export type DevnetPlatformInfo = {
  /** Tag of devnet image to download. */
  dockerTag:  string
  /** Path to dockerfile to use to build devnet image if not downloadable. */
  dockerFile: string
  /** Log message to wait for before the devnet is ready. */
  ready:      string
  /** Name of node daemon binary to run inside the container. */
  daemon:     string
  /** Which port is being used. */
  portMode:   DevnetPort
  /** Which Chain subclass to return from devnet.getChain. */
  Chain: Function & { defaultDenom: string }
}

/** Mapping of connection type to default port number. */
export const devnetPorts: Record<DevnetPort, number> = {
  http:    1317,
  rpc:     26657,
  grpc:    9090,
  grpcWeb: 9091
}

/** Mapping of connection type to environment variable
  * used by devnet.init.mjs to set port number. */
export const devnetPortEnvVars: Record<DevnetPort, string> = {
  http:    'HTTP_PORT',
  rpc:     'RPC_PORT',
  grpc:    'GRPC_PORT',
  grpcWeb: 'GRPC_WEB_PORT'
}

/** Descriptions of supported devnet variants. */
export const devnetPlatforms: Record<DevnetPlatform, DevnetPlatformInfo> = {
  'scrt_1.2': {
    Chain:      Scrt.Chain,
    dockerTag:  'ghcr.io/hackbg/fadroma-devnet-scrt-1.2:master',
    dockerFile: $(thisPackage, 'devnets', 'scrt_1_2.Dockerfile').path,
    ready:      'indexed block',
    daemon:     'secretd',
    portMode:   'http',
  },
  'scrt_1.3': {
    Chain:      Scrt.Chain,
    dockerTag:  'ghcr.io/hackbg/fadroma-devnet-scrt-1.3:master',
    dockerFile: $(thisPackage, 'devnets', 'scrt_1_3.Dockerfile').path,
    ready:      'indexed block',
    daemon:     'secretd',
    portMode:   'grpcWeb',
  },
  'scrt_1.4': {
    Chain:      Scrt.Chain,
    dockerTag:  'ghcr.io/hackbg/fadroma-devnet-scrt-1.4:master',
    dockerFile: $(thisPackage, 'devnets', 'scrt_1_4.Dockerfile').path,
    ready:      'indexed block',
    daemon:     'secretd',
    portMode:   'grpcWeb',
  },
  'scrt_1.5': {
    Chain:      Scrt.Chain,
    dockerTag:  'ghcr.io/hackbg/fadroma-devnet-scrt-1.5:master',
    dockerFile: $(thisPackage, 'devnets', 'scrt_1_5.Dockerfile').path,
    ready:      'indexed block',
    daemon:     'secretd',
    portMode:   'http',
  },
  'scrt_1.6': {
    Chain:      Scrt.Chain,
    dockerTag:  'ghcr.io/hackbg/fadroma-devnet-scrt-1.6:master',
    dockerFile: $(thisPackage, 'devnets', 'scrt_1_6.Dockerfile').path,
    ready:      'indexed block',
    daemon:     'secretd',
    portMode:   'http',
  },
  'scrt_1.7': {
    Chain:      Scrt.Chain,
    dockerTag:  'ghcr.io/hackbg/fadroma-devnet-scrt-1.7:master',
    dockerFile: $(thisPackage, 'devnets', 'scrt_1_7.Dockerfile').path,
    ready:      'indexed block',
    daemon:     'secretd',
    portMode:   'http',
  },
  'scrt_1.8': {
    Chain:      Scrt.Chain,
    dockerTag:  'ghcr.io/hackbg/fadroma-devnet-scrt-1.8:master',
    dockerFile: $(thisPackage, 'devnets', 'scrt_1_8.Dockerfile').path,
    ready:      'Done verifying block height',
    daemon:     'secretd',
    portMode:   'http',
  },
  'scrt_1.9': {
    Chain:      Scrt.Chain,
    dockerTag:  'ghcr.io/hackbg/fadroma-devnet-scrt-1.9:master',
    dockerFile: $(thisPackage, 'devnets', 'scrt_1_9.Dockerfile').path,
    ready:      'Validating proposal',
    daemon:     'secretd',
    portMode:   'http',
  },
  'okp4_5.0': {
    Chain:      CW.OKP4.Chain,
    dockerTag:  'ghcr.io/hackbg/fadroma-devnet-okp4-5.0:master',
    dockerFile: $(thisPackage, 'devnets', 'okp4_5_0.Dockerfile').path,
    ready:      'indexed block',
    daemon:     'okp4d',
    portMode:   'rpc',
  },
}

/** A private local instance of a network,
  * running in a container managed by @hackbg/dock. */
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
  portMode: DevnetPort
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
  accounts: Array<string> = [ 'Admin', 'Alice', 'Bob', 'Carol', 'Mallory' ]
  /** Name of node binary. */
  daemon: string

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
    this.chainId = options.chainId || `fadroma-local-${options.platform}-${randomBytes(4).toString('hex')}`
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
    const defaultInit   = resolve(thisPackage, 'devnets', 'devnet.init.mjs')
    this.initScript     = options.initScript! ?? defaultInit
    this.keepRunning    = options.keepRunning ?? !this.deleteOnExit
    this.podman         = options.podman ?? false
    this.platform       = options.platform ?? 'scrt_1.9'
    this.verbose        = options.verbose ?? false
    this.launchTimeout  = options.launchTimeout ?? 10
    this.dontMountState = options.dontMountState ?? false
    this.accounts       = options.accounts ?? this.accounts
    this.engine         = options.engine ?? new Dock[this.podman?'Podman':'Docker'].Engine()
    this.containerId    = options.containerId ?? this.containerId
    const { dockerTag, dockerFile, ready, portMode, daemon } = devnetPlatforms[this.platform]
    this.imageTag    = options.imageTag ?? this.imageTag ?? dockerTag
    this.dockerfile  = options.dockerfile ?? this.dockerfile ?? dockerFile
    this.readyPhrase = options.readyPhrase ?? ready
    this.daemon      = options.daemon ?? daemon
    this.portMode    = options.portMode ?? portMode
    this.port        = options.port ?? devnetPorts[this.portMode]
    this.protocol    = options.protocol ?? 'http'
    this.host        = options.host ?? 'localhost'
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

  /** Handle to created devnet container */
  get container () {
    if (this.engine && this.containerId) {
      return this.engine.container(this.containerId)
    }
  }

  /** Build image containing all or some code ids from a given chain id */
  async copyUploads (chain: Chain, codeIds?: CodeId[]) {
    const image = await this.image
  }

  /** Virtual path inside the container where the init script is mounted. */
  get initScriptMount (): string {
    return this.initScript ? $('/', $(this.initScript).name).path : '/devnet.init.mjs'
  }

  /** Environment variables in the container. */
  get spawnEnv () {
    const env: Record<string, string> = {
      DAEMON:    devnetPlatforms[this.platform].daemon,
      TOKEN:     devnetPlatforms[this.platform].Chain.defaultDenom,
      CHAIN_ID:  this.chainId,
      ACCOUNTS:  this.accounts.join(' '),
      STATE_UID: String((process.getuid!)()),
      STATE_GID: String((process.getgid!)()),
    }
    if (this.verbose) {
      env['VERBOSE'] = 'yes'
    }
    const portVar = devnetPortEnvVars[this.portMode]
    if (portVar) {
      env[portVar] = String(this.port)
    } else {
      this.log.warn(`Unknown port mode ${this.portMode}, devnet may not be accessible.`)
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

  /** Emit a warning if devnet state is missing. */
  async assertPresence () {
    if (this.containerId) {
      try {
        const container = await this.container!
        const result = await container.inspect()
        this.log.debug("Container id:", bold(this.containerId.slice(0, 8)))
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
      this.log.debug('Creating...')
      // ensure we have image and chain id
      const image = await this.image
      if (!this.image) throw new DevnetError.Missing.DevnetImage()
      if (!this.chainId) throw new DevnetError.Missing.ChainId()
      // if port is unspecified or taken, increment
      this.port = await ports.getFreePort(this.port)
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
    return $(this.stateDir, Devnet.stateFile).as(JSONFile) as JSONFile<Partial<this>>
  }

  /** Start the container. */
  start = async (): Promise<this> => {
    this.log.debug('Starting...')
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
    this.log('Pausing devnet...')
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

  /** Delete the devnet container and state. */
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

  /** Run the cleanup container, deleting devnet state even if emitted as root. */
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

  /** Get a Chain object wrapping this devnet. */
  getChain = <C extends Chain, D extends ChainClass<C>> (
    $C: D = (devnetPlatforms[this.platform].Chain || Chain) as unknown as D,
    options?: Partial<C>
  ): C => {
    return new $C({ ...options, devnet: this })
  }

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

  /** Set an exit handler on the process to let the devnet
    * stop/remove its container if configured to do so */
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

  /** Delete multiple devnets. */
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

  /** Name of the file containing devnet state. */
  static stateFile = 'devnet.json'

  /** Name under which the devnet init script is mounted in the container. */
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
}

export class DevnetConfig extends Config {
  constructor (
    options: Partial<DevnetConfig> = {},
    environment?: Environment
  ) {
    super(environment)
    this.override(options)
  }
  chainId = this.getString(
    'FADROMA_DEVNET_CHAIN_ID', ()=>undefined
  )
  platform = this.getString(
    'FADROMA_DEVNET_PLATFORM', ()=>'scrt_1.9'
  )
  deleteOnExit = this.getFlag(
    'FADROMA_DEVNET_REMOVE_ON_EXIT', ()=>false
  )
  keepRunning = this.getFlag(
    'FADROMA_DEVNET_KEEP_RUNNING', ()=>true
  )
  host = this.getString(
    'FADROMA_DEVNET_HOST', ()=>undefined
  )
  port = this.getString(
    'FADROMA_DEVNET_PORT', ()=>undefined
  )
  podman = this.getFlag(
    'FADROMA_DEVNET_PODMAN', ()=> this.getFlag('FADROMA_PODMAN', ()=>false)
  )
  dontMountState = this.getFlag(
    'FADROMA_DEVNET_DONT_MOUNT_STATE', ()=>false
  )

  /** @returns Devnet */
  getDevnet (options: Partial<Devnet> = {}) {
    return new Devnet({...this})
  }
}

/** A logger emitting devnet-related messages. */
class DevnetConsole extends Console {
  tryingPort = (port: string|number, taken?: string|number) =>
    taken
      ? this.debug('Port', bold(taken), 'is taken, trying port', bold(port))
      : this.debug(`Trying port`, bold(port))
  creating = ({ chainId, url }: Partial<Devnet>) =>
    this.log(`Creating devnet`, bold(chainId), `on`, bold(String(url)))
  loadingState = (chainId1: string, chainId2: string) =>
    this.info(`Loading state of ${chainId1} into Devnet with id ${chainId2}`)
  loadingFailed = (path: string) =>
    this.warn(`Failed to load devnet state from ${path}. Deleting it.`)
  loadingRejected = (path: string) =>
    this.log(`${path} does not exist.`)
  createdContainer = (id: string = '') =>
    this.debug(`Created container:`, bold(id.slice(0, 8)))
  alreadyExists = (id: string = '') =>
    this.log(`Devnet already exists in container`, bold(id.slice(0, 8)))
  startingContainer = (id: string = '') =>
    this.debug(`Starting container:`, bold(id.slice(0, 8)))
  stoppingContainer = (id: string = '') =>
    this.debug(`Stopping container:`, bold(id.slice(0, 8)))
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

/** An error emitted by the devnet. */
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

