/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Config, Error, Console, bold, Token, Agent, Devnet, Scrt, CW, } from '@fadroma/connect'
import type { CodeId, ChainId, Environment, AgentClass, Address, Uint128 } from '@fadroma/connect'
import $, { JSONFile, JSONDirectory, OpaqueDirectory } from '@hackbg/file'
import type { Path } from '@hackbg/file'
import portManager, { waitPort } from '@hackbg/port'
import * as Dock from '@hackbg/dock'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import { console, packageRoot } from './config'

/** Supported devnet variants. Add new devnets here first. */
export type Platform =
  | `scrt_1.${2|3|4|5|6|7|8|9}`
  | `okp4_5.0`

/** Ports exposed by the devnet. One of these is used by default. */
export type Port = 'http'|'rpc'|'grpc'|'grpcWeb'

/** Parameters that define a supported devnet. */
export type PlatformInfo = {
  /** Tag of devnet image to download. */
  dockerTag:  string
  /** Path to dockerfile to use to build devnet image if not downloadable. */
  dockerFile: string
  /** Log message to wait for before the devnet is ready. */
  ready:      string
  /** Name of node daemon binary to run inside the container. */
  daemon:     string
  /** Which port is being used. */
  portMode:   Port
  /** Which Chain subclass to return from devnet.getChain. */
  Chain: Function & { defaultDenom: string }
}

/** Mapping of connection type to default port number. */
export const ports: Record<Port, number> = {
  http: 1317, rpc: 26657, grpc: 9090, grpcWeb: 9091
}

/** Mapping of connection type to environment variable
  * used by devnet.init.mjs to set port number. */
export const portEnvVars: Record<Port, string> = {
  http: 'HTTP_PORT', rpc: 'RPC_PORT', grpc: 'GRPC_PORT', grpcWeb: 'GRPC_WEB_PORT'
}

/** Descriptions of supported devnet variants. */
export const platforms: Record<Platform, PlatformInfo> = {
  'scrt_1.2': {
    Chain:      Scrt.Agent,
    dockerTag:  'ghcr.io/hackbg/fadroma-devnet-scrt-1.2:master',
    dockerFile: $(packageRoot, 'devnets', 'scrt_1_2.Dockerfile').path,
    ready:      'indexed block',
    daemon:     'secretd',
    portMode:   'http',
  },
  'scrt_1.3': {
    Chain:      Scrt.Agent,
    dockerTag:  'ghcr.io/hackbg/fadroma-devnet-scrt-1.3:master',
    dockerFile: $(packageRoot, 'devnets', 'scrt_1_3.Dockerfile').path,
    ready:      'indexed block',
    daemon:     'secretd',
    portMode:   'grpcWeb',
  },
  'scrt_1.4': {
    Chain:      Scrt.Agent,
    dockerTag:  'ghcr.io/hackbg/fadroma-devnet-scrt-1.4:master',
    dockerFile: $(packageRoot, 'devnets', 'scrt_1_4.Dockerfile').path,
    ready:      'indexed block',
    daemon:     'secretd',
    portMode:   'grpcWeb',
  },
  'scrt_1.5': {
    Chain:      Scrt.Agent,
    dockerTag:  'ghcr.io/hackbg/fadroma-devnet-scrt-1.5:master',
    dockerFile: $(packageRoot, 'devnets', 'scrt_1_5.Dockerfile').path,
    ready:      'indexed block',
    daemon:     'secretd',
    portMode:   'http',
  },
  'scrt_1.6': {
    Chain:      Scrt.Agent,
    dockerTag:  'ghcr.io/hackbg/fadroma-devnet-scrt-1.6:master',
    dockerFile: $(packageRoot, 'devnets', 'scrt_1_6.Dockerfile').path,
    ready:      'indexed block',
    daemon:     'secretd',
    portMode:   'http',
  },
  'scrt_1.7': {
    Chain:      Scrt.Agent,
    dockerTag:  'ghcr.io/hackbg/fadroma-devnet-scrt-1.7:master',
    dockerFile: $(packageRoot, 'devnets', 'scrt_1_7.Dockerfile').path,
    ready:      'indexed block',
    daemon:     'secretd',
    portMode:   'http',
  },
  'scrt_1.8': {
    Chain:      Scrt.Agent,
    dockerTag:  'ghcr.io/hackbg/fadroma-devnet-scrt-1.8:master',
    dockerFile: $(packageRoot, 'devnets', 'scrt_1_8.Dockerfile').path,
    ready:      'Done verifying block height',
    daemon:     'secretd',
    portMode:   'http',
  },
  'scrt_1.9': {
    Chain:      Scrt.Agent,
    dockerTag:  'ghcr.io/hackbg/fadroma-devnet-scrt-1.9:master',
    dockerFile: $(packageRoot, 'devnets', 'scrt_1_9.Dockerfile').path,
    ready:      'Validating proposal',
    daemon:     'secretd',
    portMode:   'http',
  },
  'okp4_5.0': {
    Chain:      CW.OKP4.Agent,
    dockerTag:  'ghcr.io/hackbg/fadroma-devnet-okp4-5.0:master',
    dockerFile: $(packageRoot, 'devnets', 'okp4_5_0.Dockerfile').path,
    ready:      'indexed block',
    daemon:     'okp4d',
    portMode:   'rpc',
  },
}

/** A private local instance of a network,
  * running in a container managed by @hackbg/dock. */
class ContainerDevnet extends Devnet {

  /** Delete multiple devnets. */
  static deleteMany (path: string|Path, ids?: ChainId[]): Promise<ContainerDevnet[]> {
    const state = $(path).as(OpaqueDirectory)
    const chains = (state.exists()&&state.list()||[])
      .map(name => $(state, name))
      .filter(path => path.isDirectory())
      .map(path => path.at(ContainerDevnet.stateFile).as(JSONFile))
      .filter(path => path.isFile())
      .map(path => $(path, '..'))
    return Promise.all(chains.map(dir=>ContainerDevnet.fromFile(dir, true).delete()))
  }

  /** Restore a Devnet from the info stored in the state file */
  static fromFile (dir: string|Path, allowInvalid: boolean = false): ContainerDevnet {
    dir = $(dir)
    if (!dir.isDirectory()) {
      throw new Error(`not a directory: ${dir.path}`)
    }
    const stateFile = dir.at(ContainerDevnet.stateFile)
    if (!dir.at(ContainerDevnet.stateFile).isFile()) {
      throw new Error(`not a file: ${stateFile.path}`)
    }
    let state: Partial<ContainerDevnet> = {}
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
    if (!state.port) {
      console.warn(`${stateFile.path}: no port`)
    }
    return new ContainerDevnet(state)
  }

  static fromEnvironment (properties?: Partial<ContainerDevnet>) {
    const config = new Config()
    return new this({
      chainId:
        config.getString('FADROMA_DEVNET_CHAIN_ID', ()=>undefined),
      platform:
        config.getString('FADROMA_DEVNET_PLATFORM', ()=>'scrt_1.9'),
      autoDelete:
        config.getFlag('FADROMA_DEVNET_REMOVE_ON_EXIT', ()=>false),
      autoStop:
        config.getFlag('FADROMA_DEVNET_KEEP_RUNNING', ()=>true),
      host:
        config.getString('FADROMA_DEVNET_HOST', ()=>undefined),
      port:
        config.getString('FADROMA_DEVNET_PORT', ()=>undefined),
      podman:
        config.getFlag('FADROMA_DEVNET_PODMAN', ()=> config.getFlag('FADROMA_PODMAN', ()=>false)),
      dontMountState:
        config.getFlag('FADROMA_DEVNET_DONT_MOUNT_STATE', ()=>false),
      ...properties
    })
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

  /** Whether more detailed output is preferred. */
  verbose: boolean

  /** Containerization engine (Docker or Podman). */
  engine?: Dock.Engine
  /** Path to Dockerfile to build image */
  dockerfile?: string
  /** Name or tag of image if set */
  imageTag?: string
  /** ID of container if exists */
  containerId?: string
  /** Whether to use Podman instead of Docker to run the devnet container. */
  podman?: boolean

  /** Whether to destroy this devnet on exit. */
  autoDelete: boolean
  /** Whether the devnet should remain running after the command ends. */
  autoStop: boolean
  /** Kludge. */
  private exitHandlerSet = false

  /** Name of binary in container to start. */
  daemon: string
  /** Which service does the API URL port correspond to. */
  portMode: Port
  /** The protocol of the API URL without the trailing colon. */
  protocol: string
  /** The hostname of the API URL. */
  host: string
  /** The port of the API URL. */
  port?: string|number

  /** This directory is created to remember the state of the devnet setup. */
  stateDir: string
  /** Whether to skip mounting a local state directory into/out of the container. */
  dontMountState: boolean

  /** Initial accounts. */
  genesisAccounts: Record<Address, number|bigint|Uint128>
  /** Initial uploads. */
  genesisUploads: Record<CodeId, Partial<{ codeData: Uint8Array }>>
  /** If set, overrides the script that launches the devnet in the container. */
  initScript?: string
  /** Once this phrase is encountered in the log output
    * from the container, the devnet is ready to accept requests. */
  readyPhrase: string
  /** After how many seconds to throw if container is not ready. */
  launchTimeout: number

  // Overridable for testing:

  /** Function that waits for port to open after launching container.
    * Tests override this to save time. */
  //@ts-ignore
  protected waitPort = waitPort
  /** Seconds to wait after first block.
    * Tests override this to save time. */
  protected postLaunchWait = 7

  /** Create an object representing a devnet.
    * Must call the `respawn` method to get it running. */
  constructor (options: Platform|Partial<ContainerDevnet> = {}) {
    if (typeof options === 'string') options = {
      platform: options
    }
    if (!options || !options.platform) {
      throw new Error("can't create devnet without specifying at least platform")
    }
    super(options)
    this.platform = options.platform
    const { dockerTag, dockerFile, ready, portMode, daemon } =
      platforms[this.platform as Platform]
    this.verbose = options.verbose
      ?? false
    this.autoStop = options.autoStop
      ?? true
    this.autoDelete = options.autoDelete
      ?? true
    this.imageTag = options.imageTag
      ?? this.imageTag ?? dockerTag
    this.dockerfile = options.dockerfile
      ?? this.dockerfile ?? dockerFile
    this.initScript = options.initScript!
      ?? resolve(packageRoot, 'devnets', 'devnet.init.mjs')
    this.readyPhrase = options.readyPhrase
      ?? ready
    this.daemon = options.daemon
      ?? daemon
    this.portMode = options.portMode
      ?? portMode
    this.port = options.port
      ?? ports[this.portMode]
    this.protocol = options.protocol
      ?? 'http'
    this.host = options.host
      ?? 'localhost'
    this.launchTimeout = options.launchTimeout
      ?? 10
    this.dontMountState = options.dontMountState
      ?? false
    this.genesisAccounts = options.genesisAccounts
      ?? {}
    this.genesisUploads = options.genesisUploads
      ?? {}
    this.podman = options.podman
      ?? false
    this.engine = options.engine
      ?? new Dock[this.podman?'Podman':'Docker'].Engine()
    this.containerId = options.containerId
      ?? this.containerId
    this.chainId = options.chainId
      || `fadroma-local-${options.platform}-${randomBytes(4).toString('hex')}`
    this.stateDir = options.stateDir
      ?? $('state', this.chainId).path
    if ($(this.stateDir).isDirectory() && this.stateFile.isFile()) {
      try {
        const state = this.stateFile.as(JSONFile).load() || {}
        // Options always override stored state
        options = { ...state, ...options }
      } catch (e) {
        console.error(e)
        throw new Error(
          `failed to load devnet state from ${this.stateFile.path}: ${e.message}`
        )
      }
    }

    Object.defineProperty(this, 'url', {
      enumerable: true,
      configurable: true,
      get () {
        return new URL(`${this.protocol}://${this.host}:${this.port}`).toString()
      },
      set () {
        throw new Error("can't change devnet url")
      }
    })
  }

  declare url: string

  get log (): Console {
    return new Console(`devnet: ${bold(this.chainId)} @ ${bold(`${this.host}:${this.port}`)}`)
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
  async copyUploads (from: Agent, codeIds?: CodeId[]) {
    const image = await this.image
  }

  /** Virtual path inside the container where the init script is mounted. */
  get initScriptMount (): string {
    return this.initScript ? $('/', $(this.initScript).name).path : '/devnet.init.mjs'
  }

  /** Environment variables in the container. */
  get spawnEnv () {
    const env: Record<string, string> = {
      DAEMON:    platforms[this.platform as Platform].daemon,
      TOKEN:     platforms[this.platform as Platform].Chain.defaultDenom,
      CHAIN_ID:  this.chainId!,
      ACCOUNTS:  JSON.stringify(this.genesisAccounts),
      STATE_UID: String((process.getuid!)()),
      STATE_GID: String((process.getgid!)()),
    }
    if (this.verbose) {
      env['VERBOSE'] = 'yes'
    }
    const portVar = portEnvVars[this.portMode]
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
  async create (): Promise<this> {
    const exists = await this.container?.catch(()=>null)
    if (exists) {
      this.log(`Found`, bold(this.chainId), `in container`, bold(this.containerId?.slice(0, 8)))
    } else {
      if (this.verbose) {
        this.log.debug('Creating container for', bold(this.chainId))
      }
      // ensure we have image and chain id
      const image = await this.image
      if (!this.image) {
        throw new Error("missing devnet container image")
      }
      if (!this.chainId) {
        throw new Error("can't create devnet without chain ID")
      }
      // if port is unspecified or taken, increment
      this.port = await portManager.getFreePort(this.port)
      // create container
      this.log.br()
      this.log(`Creating devnet`, bold(this.chainId), `on`, bold(String(this.url)))
      const init = this.initScript ? [this.initScriptMount] : []
      const container = image!.container(this.chainId, this.spawnOptions, init)
      if (this.verbose) {
        for (const [key, val] of Object.entries(this.spawnEnv)) {
          this.log.debug(`  ${key}=${val}`)
        }
      }
      await container.create()
      this.setExitHandler()
      // set id and save
      if (this.verbose) {
        this.log.debug(`Created container:`, bold(this.containerId?.slice(0, 8)))
      }
      this.containerId = container.id
    }
    return await this.save()
  }

  /** Write the state of the devnet to a file. This saves the info needed to respawn the node */
  async save (extra = {}): Promise<this> {
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
    return $(this.stateDir, ContainerDevnet.stateFile).as(JSONFile) as JSONFile<Partial<this>>
  }

  /** Start the container. */
  async start (): Promise<this> {
    if (!this.running) {
      const container = await this.container ?? await (await this.create()).container!
      this.log.br()
      this.log.debug(`Starting container:`, bold(this.containerId?.slice(0, 8)))
      try {
        await container.start()
      } catch (e) {
        this.log.warn(e)
        // Don't throw if container already started.
        // TODO: This must be handled in @hackbg/dock
        if (e.code !== 304) throw e
      }
      this.running = true
      await this.save()
      this.log.debug('Waiting for container to say:', bold(this.readyPhrase))
      await container.waitLog(this.readyPhrase, ContainerDevnet.logFilter, true)
      this.log.debug('Waiting for', bold(String(this.postLaunchWait)), 'seconds...')
      await Dock.Docker.waitSeconds(this.postLaunchWait)
      await this.waitPort({ host: this.host, port: Number(this.port) })
    } else {
      this.log.log('Container already started:', bold(this.chainId))
    }
    return this
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
        await this.forceDelete()
      } else {
        this.log.error(`failed to delete ${path}:`, e)
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
      this.log('Running cleanup container for', path)
      await image.ensure()
      const name       = `${this.chainId}-cleanup`
      const AutoRemove = true
      const HostConfig = { Binds: [`${$(this.stateDir).path}:/state:rw`] }
      const extra      = { AutoRemove, HostConfig }
      const cleanupContainer = await image.run(name, { extra }, ['-rvf', '/state'], '/bin/rm')
      await cleanupContainer.start()
      this.log('Waiting for cleanup container to finish...')
      await cleanupContainer.wait()
      this.log(`Deleted ${path}/* via cleanup container.`)
      $(this.stateDir).delete()
    }
  }

  protected get containerCreated (): Promise<this> {
    const creating = this.create()
    Object.defineProperty(this, 'containerCreated', { get () { return creating } })
    return creating
  }

  protected get containerStarted (): Promise<this> {
    const starting = this.start()
    Object.defineProperty(this, 'containerStarted', { get () { return starting } })
    return starting
  }

  /** Authenticate with named genesis account. */
  async authenticate <A extends Agent> (name: string) {
    this.log.br()
    this.log.debug('Authenticating devnet account:', bold(name))
    const account = await this.getGenesisAccount(name)
    const { Chain } = platforms[this.platform as Platform]
    return new (Chain as unknown as AgentClass<A>)({ devnet: this }).authenticate(account)
  }

  /** Get the info for a genesis account, including the mnemonic */
  async getGenesisAccount (name: string): Promise<Partial<Agent>> {
    if (!$(this.stateDir).exists()) {
      this.log.debug('Waking devnet container')
      await this.containerCreated
      await this.containerStarted
    }
    if (this.dontMountState) {
      if (!this.container) {
        throw new Error('missing devnet container')
      }
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
      this.log.warn('Exit handler already set for', this.chainId)
      return
    }
    let exitHandlerCalled = false
    const exitHandler = async () => {
      if (exitHandlerCalled) return
      this.log.debug('Running exit handler')
      if (this.autoDelete) {
        await this.pause()
        await this.delete()
      } else if (!this.autoStop) {
        await this.pause()
      } else {
        this.log.br()
        this.log.log(
          'Devnet is running on port', bold(String(this.port)),
          `from container`, bold(this.containerId?.slice(0,8))
        ).info('To remove the devnet:'
        ).info('  $ npm run devnet reset'
        ).info('Or manually:'
        ).info(`  $ docker kill`, this.containerId?.slice(0,8),
        ).info(`  $ docker rm`, this.containerId?.slice(0,8),
        ).info(`  $ sudo rm -rf state/${this.chainId??'fadroma-devnet'}`)
      }
    }
    process.once('beforeExit', exitHandler)
    process.once('uncaughtExceptionMonitor', exitHandler)
    this.exitHandlerSet = true
  }
}

export {
  ContainerDevnet as Container,
}
