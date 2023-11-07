/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import {
  assign, Config, Error, Console, bold, Token, Agent, Devnet, Scrt, CW, Stub
} from '@fadroma/connect'
import type { CodeId, ChainId, Environment, Address, Uint128, CompiledCode } from '@fadroma/connect'
import $, { JSONFile, JSONDirectory, Directory } from '@hackbg/file'
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

/** Mapping of connection type to default port number. */
export const ports: Record<Port, number> = {
  http: 1317, rpc: 26657, grpc: 9090, grpcWeb: 9091
}

/** Mapping of connection type to environment variable
  * used by devnet.init.mjs to set port number. */
export const portEnvVars: Record<Port, string> = {
  http: 'HTTP_PORT', rpc: 'RPC_PORT', grpc: 'GRPC_PORT', grpcWeb: 'GRPC_WEB_PORT'
}

/** Regexp for filtering out non-printable characters that may be output by the containers. */
const RE_NON_PRINTABLE = /[\x00-\x1F]/

/** A private local instance of a network,
  * running in a container managed by @hackbg/dock. */
abstract class DevnetContainer<A extends typeof Agent> extends Devnet<A> {
  /** Name of the file containing devnet state. */
  static stateFile = 'devnet.json'
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
  initScript: Path = $(packageRoot, 'devnets', 'devnet.init.mjs')
  /** Once this phrase is encountered in the log output
    * from the container, the devnet is ready to accept requests. */
  readyString: string = ''
  /** After how many seconds to throw if container is not ready. */
  launchTimeout: number = 10
  /** Create an object representing a devnet.
    * Must call the `respawn` method to get it running. */

  declare url: string

  constructor (options: Partial<DevnetContainer<A>> = {}) {
    super(options)
    assign(this, options, [
      'verbose', 'autoStop', 'autoDelete',
      'containerEngine', 'containerImage', 'containerManifest', 'containerId',
      'daemon', 'portMode', 'protocol', 'host', 'port', 'dontMountState',
      'genesisAccounts', 'genesisUploads', 'initScript', 'readyString', 'launchTimeout',
    ])
    if (this.portMode) {
      this.port ??= ports[this.portMode]
    }
    this.containerEngine ??= new Dock.Docker.Engine()
    this.chainId ??= `local-${this.platform}-${randomBytes(4).toString('hex')}`
    this.stateDir = $(options.stateDir ?? $('state', this.chainId).path)
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
    Object.defineProperties(this, {
      url: {
        enumerable: true, configurable: true, get () {
          return new URL(`${this.protocol}://${this.host}:${this.port}`).toString()
        }, set () {
          throw new Error("can't change devnet url")
        }
      },
      log: {
        enumerable: true, configurable: true, get () {
          return new Console(`devnet: ${bold(this.chainId)} @ ${bold(`${this.host}:${this.port}`)}`)
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
  async copyUploads (from: Agent, codeIds?: CodeId[]) {
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
      TOKEN:     this.Agent.gasToken,
      CHAIN_ID:  this.chainId!,
      ACCOUNTS:  JSON.stringify(this.genesisAccounts),
      STATE_UID: String((process.getuid!)()),
      STATE_GID: String((process.getgid!)()),
    }
    if (this.verbose) {
      env['VERBOSE'] = 'yes'
    }
    const portVar = portEnvVars[this.portMode!]
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
      containerImage:   this.containerImage,
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
      await Dock.Docker.waitSeconds(this.postLaunchWait)
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
  async getGenesisAccount (name: string): Promise<Partial<Agent>> {
    this.log.br()
    this.log.debug('Authenticating devnet account:', bold(name))
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

  /** Function that waits for port to open after launching container.
    * Tests override this to save time. */
  //@ts-ignore
  protected waitPort = waitPort

  /** Seconds to wait after first block.
    * Tests override this to save time. */
  protected postLaunchWait = 7

  /** Set an exit handler on the process to let the devnet
    * stop/remove its container if configured to do so */
  protected setExitHandler () {
    if (this.exitHandler) {
      this.log.warn('Exit handler already set for', this.chainId)
      return
    }
    let exitHandlerCalled = false
    this.exitHandler = async () => {
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
    process.once('beforeExit', this.exitHandler)
    process.once('uncaughtExceptionMonitor', this.exitHandler)
  }

  /** Kludge. */
  private exitHandler?: (...args: any)=>void
}

class ScrtDevnetContainer extends DevnetContainer<typeof Scrt.Agent> {
  Agent = Scrt.Agent

  static ['v1.2'] = class ScrtDevnetContainer_1_2 extends ScrtDevnetContainer {
    containerImage    = 'ghcr.io/hackbg/fadroma-devnet-scrt-1.2:master'
    containerManifest = $(packageRoot, 'devnets', 'scrt_1_2.Dockerfile').path
    readyString       = 'indexed block'
    daemon            = 'secretd'
    portMode          = 'http' as Port
    platform          = 'scrt_1_2'
  }

  static ['v1.3'] = class ScrtDevnetContainer_1_3 extends ScrtDevnetContainer {
    containerImage    = 'ghcr.io/hackbg/fadroma-devnet-scrt-1.3:master'
    containerManifest = $(packageRoot, 'devnets', 'scrt_1_3.Dockerfile').path
    readyString       = 'indexed block'
    daemon            = 'secretd'
    portMode          = 'grpcWeb' as Port
    platform          = 'scrt_1_3'
  }

  static ['1.4'] = class ScrtDevnetContainer_1_4 extends ScrtDevnetContainer {
    containerImage    = 'ghcr.io/hackbg/fadroma-devnet-scrt-1.4:master'
    containerManifest = $(packageRoot, 'devnets', 'scrt_1_4.Dockerfile').path
    readyString       = 'indexed block'
    daemon            = 'secretd'
    portMode          = 'grpcWeb' as Port
    platform          = 'scrt_1_4'
  }

  static ['v1.5'] = class ScrtDevnetContainer_1_5 extends ScrtDevnetContainer {
    containerImage    = 'ghcr.io/hackbg/fadroma-devnet-scrt-1.5:master'
    containerManifest = $(packageRoot, 'devnets', 'scrt_1_5.Dockerfile').path
    readyString       = 'indexed block'
    daemon            = 'secretd'
    portMode          = 'http' as Port
    platform          = 'scrt_1_5'
  }

  static ['v1.6'] = class ScrtDevnetContainer_1_6 extends ScrtDevnetContainer {
    containerImage    = 'ghcr.io/hackbg/fadroma-devnet-scrt-1.6:master'
    containerManifest = $(packageRoot, 'devnets', 'scrt_1_6.Dockerfile').path
    readyString       = 'indexed block'
    daemon            = 'secretd'
    portMode          = 'http' as Port
    platform          = 'scrt_1_6'
  }

  static ['v1.7'] = class ScrtDevnetContainer_1_7 extends ScrtDevnetContainer {
    containerImage    = 'ghcr.io/hackbg/fadroma-devnet-scrt-1.7:master'
    containerManifest = $(packageRoot, 'devnets', 'scrt_1_7.Dockerfile').path
    readyString       = 'indexed block'
    daemon            = 'secretd'
    portMode          = 'http' as Port
    platform          = 'scrt_1_7'
  }

  static ['v1.8'] = class ScrtDevnetContainer_1_8 extends ScrtDevnetContainer {
    containerImage    = 'ghcr.io/hackbg/fadroma-devnet-scrt-1.8:master'
    containerManifest = $(packageRoot, 'devnets', 'scrt_1_8.Dockerfile').path
    readyString       = 'Done verifying block height'
    daemon            = 'secretd'
    portMode          = 'http' as Port
    platform          = 'scrt_1_8'
  }

  static ['v1.9'] = class ScrtDevnetContainer_1_9 extends ScrtDevnetContainer {
    containerImage    = 'ghcr.io/hackbg/fadroma-devnet-scrt-1.9:master'
    containerManifest = $(packageRoot, 'devnets', 'scrt_1_9.Dockerfile').path
    readyString       = 'Validating proposal'
    daemon            = 'secretd'
    portMode          = 'http' as Port
    platform          = 'scrt_1_9'
  }
}

class OKP4DevnetContainer extends DevnetContainer<typeof CW.OKP4.Agent> {
  Agent = CW.OKP4.Agent

  static ['v5.0'] = class OKP4DevnetContainer_5_0 extends OKP4DevnetContainer {
    containerImage    = 'ghcr.io/hackbg/fadroma-devnet-okp4-5.0:master'
    containerManifest = $(packageRoot, 'devnets', 'okp4_5_0.Dockerfile').path
    readyString       = 'indexed block'
    daemon            = 'okp4d'
    portMode          = 'rpc' as Port
    platform          = 'okp4_5_0'
  }
}

export {
  DevnetContainer as Container,
  ScrtDevnetContainer as ScrtContainer,
  OKP4DevnetContainer as OKP4Container,
}

export function getDevnetFromEnvironment <A extends typeof Agent> (
  properties: Partial<DevnetContainer<A>> & { Agent: A }
): DevnetContainer<A> {
  const config = new Config()
  const defaults = {
    chainId:        config.getString('FADROMA_DEVNET_CHAIN_ID', ()=>undefined),
    platform:       config.getString('FADROMA_DEVNET_PLATFORM', ()=>'scrt_1.9'),
    autoDelete:     config.getFlag('FADROMA_DEVNET_REMOVE_ON_EXIT', ()=>false),
    autoStop:       config.getFlag('FADROMA_DEVNET_KEEP_RUNNING', ()=>true),
    host:           config.getString('FADROMA_DEVNET_HOST', ()=>undefined),
    port:           config.getString('FADROMA_DEVNET_PORT', ()=>undefined),
    dontMountState: config.getFlag('FADROMA_DEVNET_DONT_MOUNT_STATE', ()=>false),
  }
  if (properties.Agent === Scrt.Agent) {
    return new ScrtDevnetContainer({ ...defaults, ...properties }) as DevnetContainer<typeof Scrt.Agent>
  } else if (properties.Agent === CW.OKP4.Agent) {
    return new OKP4DevnetContainer({ ...defaults, ...properties }) as DevnetContainer<typeof CW.OKP4.Agent>
  } else {
    throw new Error('pass Scrt.Agent or CW.OKP4.Agent to getDevnet({ Agent })')
  }
}

/** Restore a Devnet from the info stored in the state file */
export function getDevnetFromFile <A extends typeof Agent> (
  dir: string|Path, allowInvalid: boolean = false
): DevnetContainer<A> {
  dir = $(dir)
  if (!dir.isDirectory()) {
    throw new Error(`not a directory: ${dir.path}`)
  }
  const stateFile = dir.at(DevnetContainer.stateFile)
  if (!dir.at(DevnetContainer.stateFile).isFile()) {
    throw new Error(`not a file: ${stateFile.path}`)
  }
  let state: Partial<DevnetContainer<A>> = {}
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
  return new (class extends DevnetContainer<typeof Stub.Agent> { Agent = Stub.Agent })(
    state as any
  )
}

/** Delete multiple devnets. */
export async function deleteDevnets (
  path: string|Path, ids?: ChainId[]
): Promise<void> {
  const state = $(path).as(Directory)
  const chains = (state.exists()&&state.list()||[])
    .map(name => $(state, name))
    .filter(path => path.isDirectory())
    .map(path => path.at(DevnetContainer.stateFile).as(JSONFile))
    .filter(path => path.isFile())
    .map(path => $(path, '..'))
  await Promise.all(chains.map(dir=>getDevnetFromFile(dir, true).delete()))
}
