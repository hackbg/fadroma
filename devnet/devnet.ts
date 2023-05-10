import { Error, Console, Config } from '../fadroma-base'
import { bold, randomHex, ChainMode, Chain, randomChainId } from '@fadroma/agent'
import type { Agent, ChainClass, ChainId, DevnetHandle } from '@fadroma/agent'
import $, { JSONFile, JSONDirectory, OpaqueDirectory } from '@hackbg/file'
import type { Path } from '@hackbg/file'
import { freePort, Endpoint, waitPort, isPortTaken } from '@hackbg/port'
import * as Dock from '@hackbg/dock'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'

/** @returns Devnet configured as per environment and options. */
export function getDevnet (options: Partial<Config["devnet"]> = {}) {
  return new Config({ devnet: options }).getDevnet()
}

/** Root of this module.
  * Used for finding embedded assets, e.g. Dockerfiles.
  * TypeScript doesn't like `import.meta.url` when compiling to JS. */
//@ts-ignore
export const devnetPackage = dirname(fileURLToPath(import.meta.url)) // resource finder

/** Used to reconnect between runs. */
export type DevnetState = Partial<Devnet> & {
  /** ID of Docker container to restart. */
  containerId?: string
  /** Chain ID that was set when creating the devnet. */
  chainId: string
}

/** Supported connection types. */
export type DevnetPortMode = 'lcp'|'grpcWeb'

/** Supported devnet variants. */
export type DevnetPlatform = `scrt_1.${2|3|4|5|6|7|8}`

/** A private local instance of a network. */
export class Devnet implements DevnetHandle {
  /** Whether to use Podman instead of Docker to run the devnet container. */
  podman: boolean
  /** Which kind of devnet to launch */
  platform: DevnetPlatform
  /** Which service does the API URL port correspond to. */
  portMode: DevnetPortMode
  /** The chain ID that will be passed to the devnet node. */
  chainId: ChainId = randomChainId()
  /** Whether to destroy this devnet on exit. */
  temporary: boolean = false
  /** Whether the devnet should remain running after the command ends. */
  persistent: boolean
  /** The protocol of the API URL without the trailing colon. */
  protocol: string
  /** The hostname of the API URL. */
  host: string
  /** The port of the API URL. */
  port?: string|number
  /** This directory is created to remember the state of the devnet setup. */
  stateDir: string
  /** Containerization engine (Docker or Podman). */
  engine: Dock.Engine
  /** This should point to the standard production docker image for the network. */
  image: Dock.Image
  /** Handle to created devnet container */
  container?: Dock.Container
  /** If set, overrides the script that launches the devnet in the container. */
  initScript?: string
  /** Whether to skip mounting a local state directory into/out of the container. */
  noStateMount: boolean
  /** Once this phrase is encountered in the log output
    * from the container, the devnet is ready to accept requests. */
  readyPhrase: string
  /** After how many seconds to throw if container is not ready. */
  launchTimeout: number
  /** Whether more detailed output is preferred. */
  verbose: boolean
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
    this.temporary = options.temporary ?? false
    this.chainId = options.chainId ?? (options.temporary ? randomChainId() : 'fadroma-devnet')
    if (!this.chainId) throw new Error.Devnet.NoChainId()
    this.persistent = options.persistent ?? true
    this.podman = options.podman ?? false
    this.platform = options.platform ?? 'scrt_1.8'
    this.verbose = options.verbose ?? false
    this.launchTimeout = options.launchTimeout ?? 10
    this.noStateMount = options.noStateMount ?? false
    this.genesisAccounts = options.genesisAccounts ?? this.genesisAccounts
    this.stateDir = options.stateDir ?? $('state', this.chainId).path
    this.initScript ??= options.initScript!
    this.readyPhrase ??= options.readyPhrase ?? Devnet.readyMessage[this.platform]
    this.protocol = options.protocol ?? 'http'
    this.host = options.host ?? 'localhost'
    this.portMode = Devnet.portModes[this.platform]
    this.port = options.port ?? ((this.portMode === 'lcp') ? 1317 : 9091)
    this.engine = options.container?.image?.engine ?? options.image?.engine ?? options.engine ??
      new (this.podman ? Dock.Podman.Engine : Dock.Docker.Engine)()
    this.container = options.container
    this.image = this.container?.image ?? options.image ?? this.engine.image(
      Devnet.dockerTags[this.platform],
      Devnet.dockerfiles[this.platform],
      [this.initScriptMount]
    )
  }

  get log (): Console {
    return new Console(`${this.chainId} @ ${this.host}:${this.port}`)
  }
  /** The API URL that can be used to talk to the devnet. */
  get url (): URL { return new URL(`${this.protocol}://${this.host}:${this.port}`) }
  /** This file contains the id of the current devnet container.
    * TODO store multiple containers */
  get devnetJSON (): JSONFile<DevnetState> {
    return $(this.stateDir, 'devnet.json').as(JSONFile) as JSONFile<DevnetState>
  }
  /** Handle to Docker API if configured. */
  get dock (): Dock.Engine|null {
    return this.image.engine
  }
  /** Environment variables in the container. */
  get spawnEnv () {
    // Environment variables in devnet container
    const env: Record<string, string> = {
      Verbose: this.verbose ? 'yes' : '',
      ChainId: this.chainId,
      GenesisAccounts: this.genesisAccounts.join(' '),
      _UID: String((process.getuid!)()),
      _GID: String((process.getgid!)()),
    }
    // Which kind of API to expose at the default container port
    switch (this.portMode) {
      case 'lcp':     env.lcpPort     = String(this.port);      break
      case 'grpcWeb': env.grpcWebAddr = `0.0.0.0:${this.port}`; break
      default: throw new Error.Devnet(`DockerDevnet#portMode must be either 'lcp' or 'grpcWeb'`)
    }
    return env
  }
  /** Options for the container. */
  get spawnOptions () {
    const Binds: string[] = []
    if (this.initScript)
      Binds.push(`${this.initScript}:${this.initScriptMount}:ro`)
    if (!this.noStateMount)
      Binds.push(`${$(this.stateDir).path}:/state/${this.chainId}:rw`)
    const NetworkMode = 'bridge'
    const PortBindings = { [`${this.port}/tcp`]: [{HostPort: `${this.port}`}] }
    const HostConfig = { Binds, NetworkMode, PortBindings }
    const Tty = true
    const AttachStdin = true
    const AttachStdout = true
    const AttachStderr = true
    const Hostname = this.chainId
    const Domainname = this.chainId
    const extra = { Tty, AttachStdin, AttachStdout, AttachStderr, Hostname, Domainname, HostConfig }
    const options = { env: this.spawnEnv, exposed: [`${this.port}/tcp`], extra }
    return options
  }
  /** Virtual path inside the container where the init script is mounted. */
  get initScriptMount (): string {
    return this.initScript ? $('/', $(this.initScript).name).path : '/devnet.init.mjs'
  }
  /** List of genesis accounts that will be given an initial balance
    * when creating the devnet container for the first time. */
  genesisAccounts: Array<string> = [
    'Admin', 'Alice', 'Bob', 'Charlie', 'Mallory'
  ]
  /** Restore this node from the info stored in the devnetJSON file */
  async load (): Promise<DevnetState|null> {
    const path = this.devnetJSON.shortPath
    if (!$(this.stateDir).exists() || !this.devnetJSON.exists()) {
      this.log.devnet.loadingRejected(path)
      return null
    }
    let state
    try {
      state = this.devnetJSON.load() || {}
    } catch (e) {
      this.log.devnet.loadingFailed(path)
      $(this.stateDir).delete()
      throw e
    }
    const { podman, chainId, containerId, port } = state
    if (containerId) {
      this.container = await this.engine.container(containerId)
    } else {
      throw new Error.Devnet('missing container id in devnet state')
    }
    if (this.chainId !== chainId) this.log.devnet.loadingState(chainId, this.chainId)
    this.port = port as number
    return state
  }
  /** Write the state of the devnet to a file.
    * This saves the info needed to respawn the node */
  save (extra = {}) {
    this.devnetJSON.save({
      podman:      this.podman,
      port:        this.port,
      containerId: this.container?.id,
      imageName:   this.image?.name
    })
    return this
  }
  /** Stop this node and delete its state. */
  async terminate () {
    return await this.erase()
  }
  /** Get a Chain object corresponding to this devnet. */
  getChain <C extends Chain> (
    $C: ChainClass<C> = Chain as unknown as ChainClass<C>
  ): C {
    return new $C({ id: this.chainId, mode: Chain.Mode.Devnet, devnet: this })
  }
  /** Get the info for a genesis account, including the mnemonic */
  async getGenesisAccount (name: string): Promise<Partial<Agent>> {
    if (this.noStateMount) {
      if (!this.container) throw new Error.Devnet.ContainerNotSet()
      const [identity] = await this.container.exec(
        'cat', `/state/${this.chainId}/wallet/${name}.json`
      )
      return JSON.parse(identity)
    } else {
      return $(this.stateDir, 'wallet', `${name}.json`).as(JSONFile).load() as Partial<Agent>
    }
  }

  async spawn () {
    if (!this.chainId) throw new Error.Missing.ChainId()
    // if port is unspecified or taken, increment
    while (!this.port || await isPortTaken(Number(this.port))) {
      this.port = Number(this.port) + 1 || await freePort()
      if (this.port < 1024 || this.port > 65535) Object.assign(this, { port: undefined })
      if (this.port) this.log.log('Trying port', this.port)
    }
    // tell the user that we have begun
    this.log.log(`Spawning new node to listen on`, bold(this.url))
    // create the state dirs and files
    for (const item of [ $(this.stateDir).as(OpaqueDirectory), this.devnetJSON ]) item.make()
    // run the container
    this.container = await this.image.run(
      this.chainId,
      this.spawnOptions,
      this.initScript ? [this.initScriptMount] : []
    )
    if (!this.persistent) process.on('beforeExit', async () => await this.kill())
    // update the record
    this.save()
    // Wait for everything to be ready
    await this.container.waitLog(this.readyPhrase, Devnet.logFilter, true)
    await Dock.Docker.waitSeconds(this.postLaunchWait)
    await this.waitPort({ host: this.host, port: Number(this.port) })
    return this
  }

  /** Start the node if stopped. */
  async respawn () {
    const shortPath = $(this.devnetJSON.path).shortPath
    // if no node state, spawn
    if (!this.devnetJSON.exists()) {
      this.log.log(`No devnet found at ${bold(shortPath)}`)
      return this.spawn()
    }
    // get stored info about the container was supposed to be
    let id: string
    try {
      id = (await this.load())?.containerId!
    } catch (e) {
      if (!(e?.statusCode == 404 && e?.json?.message.startsWith('No such container'))) {
        this.log.warn(e)
      } else {
        this.log.warn('Devnet container not found, recreating')
      }
      this.log.log(`Reading ${bold(shortPath)} failed, starting devnet container`)
      return this.spawn()
    }
    // check if container is running
    this.container = await this.dock!.container(id)
    let running: boolean
    try {
      running = await this.container.isRunning
    } catch (e) {
      // if error when checking, RESPAWN
      this.log.log(`Failed to get container ${bold(id)}. Error was:`, e)
      this.log.log(`Cleaning up outdated state...`)
      await this.erase()
      this.log.log(`Trying to launch a new node...`)
      return this.spawn()
    }
    // if not running, RESPAWN
    if (!running) await this.container.start()
    // ...and try to make sure it dies when the Node process dies
    this.setExitHandler()
    return this
  }

  private setExitHandler () {
    if (!this.exitHandlerSet) {
      process.once('beforeExit', () => {
        if (this.temporary) {
          this.container!.kill()
        } else {
          this.log.br()
          this.log.devnet.isNowRunning(this)
        }
      })
      this.exitHandlerSet = true
    }
  }

  /** Kill the container, if necessary find it first */
  async kill () {
    if (this.container) {
      const { id } = this.container
      await this.container.kill()
      this.log.log(`Stopped container`, bold(id))
      return this
    }
    this.log.log(`Checking if there's an old node that needs to be stopped...`)
    const { containerId } = await this.load() || {}
    if (containerId) {
      this.log(`Stopped container ${bold(containerId!)}.`)
      await this.container!.kill()
      return this
    }
    this.log("Didn't stop any container.")
    return this
      //console.log(`${chainId} (${devnetJSON.shortPath})`)
      //console.log(`${engine}: ${containerId}`)
      //if (engine === 'docker') {
        //try {
          //const docker = new Dock.Docker.Engine()
          //const container = await docker.container(containerId)
          //await container.kill()
          //console.log(`${containerId}: killed`)
          //await container.remove()
          //console.log(`${containerId}: removed`)
        //} catch (e) {
          //if (e.statusCode === 404) {
            //console.log(`${containerId}: not found`)
          //} else {
            //console.warn(`${containerId}: failed to remove:`, e)
          //}
        //}
      //} else {
        //console.warn(`BUG: can't reset devnet on engine: ${engine}`)
      //}
      //const dir = $(devnetJSON, '..')
      //try {
        //dir.delete()
      //} catch (e) {
        //if (e.code === 'EACCES') console.warn(
          //`BUG: devnet may have written its files with wrong permissions at ${dir.shortPath}`
        //)
        //console.warn(`Failed to delete ${dir.shortPath}`, e)
      //}
  }

  /** External environment needs to be returned to a pristine state via Docker.
    * (Otherwise, root-owned dotdirs leak and have to be manually removed with sudo.) */
  async erase () {
    const state = $(this.stateDir)
    const path  = state.shortPath
    try {
      if (state.exists()) {
        this.log.log(`Deleting ${path}...`)
        state.delete()
      }
    } catch (e: any) {
      if (e.code === 'EACCES' || e.code === 'ENOTEMPTY') {
        this.log.warn(`failed to delete ${path}: ${e.code}`)
        await this.runCleanupContainer(path)
      } else {
        this.log.warn(`failed to delete ${path}:`, e)
        throw e
      }
    }
    return this
  }

  async runCleanupContainer (path: string) {
    this.log.log('running cleanup container for', path)
    await this.image.ensure()
    const containerName = `${this.chainId}-cleanup`
    const options = {
      AutoRemove: true,
      Image:      this.image.name,
      Entrypoint: [ '/bin/rm' ],
      Cmd:        ['-rvf', '/state',],
      HostConfig: { Binds: [`${$(this.stateDir).path}:/state:rw`] }
      //Tty: true, AttachStdin: true, AttachStdout: true, AttachStderr: true,
    }
    const cleanupContainer = await this.image.run(
      containerName,
      { extra: options },
      ['-rvf', '/state'],
      '/bin/rm'
    )
    this.log.log(`Starting cleanup container...`)
    await cleanupContainer.start()
    this.log.log('Waiting for cleanup to finish...')
    await cleanupContainer.wait()
    this.log.log(`Deleted ${path} via cleanup container.`)
  }

  async export (repository?: string, tag?: string) {
    if (!this.container) throw new Error.Devnet("Can't export: no container")
    return this.container.export(repository, tag)
  }

  static dockerfiles: Record<DevnetPlatform, string> = {
    'scrt_1.2': $(devnetPackage, 'scrt_1_2.Dockerfile').path,
    'scrt_1.3': $(devnetPackage, 'scrt_1_3.Dockerfile').path,
    'scrt_1.4': $(devnetPackage, 'scrt_1_4.Dockerfile').path,
    'scrt_1.5': $(devnetPackage, 'scrt_1_5.Dockerfile').path,
    'scrt_1.6': $(devnetPackage, 'scrt_1_6.Dockerfile').path,
    'scrt_1.7': $(devnetPackage, 'scrt_1_7.Dockerfile').path,
    'scrt_1.8': $(devnetPackage, 'scrt_1_8.Dockerfile').path
  }

  static dockerTags: Record<DevnetPlatform, string> = {
    'scrt_1.2': 'ghcr.io/hackbg/fadroma-devnet-scrt-1.2:master',
    'scrt_1.3': 'ghcr.io/hackbg/fadroma-devnet-scrt-1.3:master',
    'scrt_1.4': 'ghcr.io/hackbg/fadroma-devnet-scrt-1.4:master',
    'scrt_1.5': 'ghcr.io/hackbg/fadroma-devnet-scrt-1.5:master',
    'scrt_1.6': 'ghcr.io/hackbg/fadroma-devnet-scrt-1.6:master',
    'scrt_1.7': 'ghcr.io/hackbg/fadroma-devnet-scrt-1.7:master',
    'scrt_1.8': 'ghcr.io/hackbg/fadroma-devnet-scrt-1.8:master',
  }

  static readyMessage: Record<DevnetPlatform, string> = {
    'scrt_1.2': 'indexed block',
    'scrt_1.3': 'indexed block',
    'scrt_1.4': 'indexed block',
    'scrt_1.5': 'indexed block',
    'scrt_1.6': 'indexed block',
    'scrt_1.7': 'indexed block',
    'scrt_1.8': 'Done verifying block height',
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

  static resetMany = async (path: string|Path, ids?: ChainId[]) => {
    const console = new Console('devnet')
    const state  = $(path).as(OpaqueDirectory)
    const chains = (state.exists()&&state.list()||[])
      .map(name => $(state, name))
      .filter(path => path.isDirectory())
      .map(path => path.at('devnet.json').as(JSONFile))
      .filter(path => path.isFile())
    for (const devnetJSON of chains) {
      await new Devnet(devnetJSON.load()!).kill().then(devnet=>devnet.erase())
    }
  }

  /** Default connection type to expose on each devnet variant. */
  static portModes: Record<DevnetPlatform, DevnetPortMode> = {
    'scrt_1.2': 'lcp',
    'scrt_1.3': 'grpcWeb',
    'scrt_1.4': 'grpcWeb',
    'scrt_1.5': 'lcp',
    'scrt_1.6': 'lcp',
    'scrt_1.7': 'lcp',
    'scrt_1.8': 'lcp'
  }

}
