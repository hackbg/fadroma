import portManager, { waitPort } from '@hackbg/port'
import $, { Path, JSONFile } from '@hackbg/file'
import * as Dock from '@hackbg/dock'
import { onExit } from 'gracy'
import { Backend, Identity, assign, randomBase16, Console, bold } from '@fadroma/agent'
import type { Address, CodeId, Uint128, CompiledCode, Connection } from '@fadroma/agent'
import { packageRoot } from './package'

/** A private local instance of a network,
  * running in a container managed by @hackbg/dock. */
export default abstract class DevnetContainer extends Backend {
  declare url: string
  /** Whether more detailed output is preferred. */
  verbose: boolean = false
  /** Whether the devnet container should stop when the process exits. */
  autoStop: boolean = true
  /** Whether the devnet container should be removed when the process exits. */
  autoDelete: boolean = true
  /** Containerization engine (Docker or Podman). */
  containerEngine?: Dock.Engine
  /** Name or tag of image if set */
  containerImage?: string
  /** Path to Dockerfile to build the image if missing. */
  containerManifest?: string
  /** ID of container if exists */
  containerId?: string
  /** Name of binary in container to start. */
  daemon?: string
  /** Which service does the API URL port correspond to. */
  portMode?: Port
  /** The protocol of the API URL without the trailing colon. */
  protocol: string = 'http'
  /** The hostname of the API URL. */
  host: string = 'localhost'
  /** The port of the API URL. */
  port?: string|number
  /** This directory is created to remember the state of the devnet setup. */
  stateDir: Path
  /** Whether to skip mounting a local state directory into/out of the container. */
  dontMountState: boolean = false
  /** Initial accounts. */
  genesisAccounts: Record<Address, number|bigint|Uint128> = {}
  /** Initial uploads. */
  genesisUploads: Record<CodeId, Partial<CompiledCode>> = {}
  /** If set, overrides the script that launches the devnet in the container. */
  initScript: Path = $(packageRoot, 'devnet.init.mjs')
  /** Once this phrase is encountered in the log output
    * from the container, the devnet is ready to accept requests. */
  readyString: string = ''
  /** After how many seconds to throw if container is not ready. */
  launchTimeout: number = 10
  /** Function that waits for port to open after launching container.
    * Tests override this to save time. */
  //@ts-ignore
  protected waitPort = waitPort
  /** Seconds to wait after first block.
    * Tests override this to save time. */
  protected postLaunchWait = 7

  constructor (options: Partial<DevnetContainer> = {}) {
    super(options)
    assign(this, options, [
      'autoDelete',
      'autoStop',
      'chainId',
      'containerEngine',
      'containerId',
      'containerImage',
      'containerManifest',
      'daemon',
      'dontMountState',
      'genesisAccounts',
      'genesisUploads',
      'host',
      'initScript',
      'launchTimeout',
      'platform',
      'port',
      'portMode',
      'protocol',
      'readyString',
      'verbose',
    ])
    if (this.portMode) {
      this.port ??= DevnetContainer.ports[this.portMode]
    }
    this.containerEngine ??= new Dock.Docker.Engine()
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
    Object.defineProperties(this, {
      url: {
        enumerable: true, configurable: true, get () {
          let url = `${this.protocol}://${this.host}:${this.port}`
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
          return new Console(`DevnetContainer(${bold(this.chainId)})`)
        }, set () {
          throw new Error("can't change devnet logger")
        }
      }
    })
  }

  /** This should point to the standard production docker image for the network. */
  get image () {
    if (this.containerEngine && this.containerImage) {
      return this.containerEngine.image(
        this.containerImage,
        this.containerManifest,
        [this.initScriptMount]
      ).ensure()
    }
  }

  /** Handle to created devnet container */
  get container () {
    if (this.containerEngine && this.containerId) {
      return this.containerEngine.container(this.containerId)
    }
  }

  /** Build image containing all or some code ids from a given chain id */
  async copyUploads (from: Connection, codeIds?: CodeId[]) {
    const image = await this.image
  }

  /** Virtual path inside the container where the init script is mounted. */
  get initScriptMount (): string {
    return this.initScript ? $('/', $(this.initScript).basename).path : '/devnet.init.mjs'
  }

  /** Environment variables in the container. */
  get spawnEnv () {
    const env: Record<string, string> = {
      DAEMON:    this.daemon||'',
      TOKEN:     this.gasToken?.denom,
      CHAIN_ID:  this.chainId!,
      ACCOUNTS:  JSON.stringify(this.genesisAccounts),
      STATE_UID: String((process.getuid!)()),
      STATE_GID: String((process.getgid!)()),
    }
    if (this.verbose) {
      env['VERBOSE'] = 'yes'
    }
    const portVar = DevnetContainer.portVars[this.portMode!]
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
      Binds.push(`${this.initScript.path}:${this.initScriptMount}:ro`)
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

  protected get containerCreated (): Promise<this> {
    const creating = this.create()
    Object.defineProperty(this, 'containerCreated', { get () { return creating } })
    return creating
  }

  /** Write the state of the devnet to a file. This saves the info needed to respawn the node */
  async save (extra = {}): Promise<this> {
    this.stateFile.save({
      chainId:     this.chainId,
      containerId: this.containerId,
      port:        this.port,
      containerImage: this.containerImage,
    })
    return this
  }

  /** This file contains the id of the current devnet container.
    * TODO store multiple containers */
  get stateFile (): JSONFile<Partial<this>> {
    return $(this.stateDir, DevnetContainer.stateFile).as(JSONFile) as JSONFile<Partial<this>>
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
        // TODO: This must be handled in @hackbg/dock
        if (e.code !== 304) throw e
      }
      this.running = true
      await this.save()
      this.log.debug('Waiting for container to say:', bold(this.readyString))
      await container.waitLog(this.readyString, (data: string) =>
        ((data.length > 0 && data.length <= 1024)
          && !data.startsWith('TRACE ')
          && !data.startsWith('DEBUG ')
          && !data.startsWith('INFO ')
          && !data.startsWith('I[')
          && !data.startsWith('Storing key:')
          && !RE_NON_PRINTABLE.test(data)
          && !data.startsWith('{"app_message":')
          && !data.startsWith('configuration saved to')
        ), true)
      this.log.debug('Waiting for', bold(String(this.postLaunchWait)), 'seconds...')
      await new Promise(resolve=>setTimeout(resolve, this.postLaunchWait))
      //await Dock.Docker.waitSeconds(this.postLaunchWait)
      await this.waitPort({ host: this.host, port: Number(this.port) })
    } else {
      this.log.log('Container already started:', bold(this.chainId))
    }
    return this
  }

  protected get containerStarted (): Promise<this> {
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

  /** Set an exit handler on the process to let the devnet
    * stop/remove its container if configured to do so */
  protected setExitHandler () {
    if (this.exitHandler) {
      this.log.warn('Exit handler already set for', this.chainId)
      return
    }
    let exitHandlerCalled = false
    onExit(this.exitHandler = async () => {
      if (exitHandlerCalled) {
        this.log.warn('Exit handler called more than once')
        return
      }
      exitHandlerCalled = true
      this.log.debug('Running exit handler')
      if (this.autoDelete) {
        await this.pause()
        await this.delete()
      } else if (!this.autoStop) {
        await this.pause()
      } else {
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
    }, { logger: this.log })
  }
  /** Kludge. */
  private exitHandler?: (...args: any)=>void
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
    if (!state.port) {
      console.warn(`${stateFile.path}: no port`)
    }
    throw new Error('not implemented')
  }
  static ports: Record<Port, number> = {
    http:    1317,
    rpc:     26657,
    grpc:    9090,
    grpcWeb: 9091
  }
  /** Mapping of connection type to environment variable
    * used by devnet.init.mjs to set port number. */
  static portVars: Record<Port, string> = {
    http:    'HTTP_PORT',
    rpc:     'RPC_PORT',
    grpc:    'GRPC_PORT',
    grpcWeb: 'GRPC_WEB_PORT'
  }
}
/** Ports exposed by the devnet. One of these is used by default. */
export type Port = 'http'|'rpc'|'grpc'|'grpcWeb'
/** Mapping of connection type to default port number. */
/** Regexp for filtering out non-printable characters that may be output by the containers. */
const RE_NON_PRINTABLE = /[\x00-\x1F]/
