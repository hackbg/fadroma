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
import Error from './fadroma-error'
import Config from './fadroma-config'
import Console from './fadroma-console'

import { bold, randomHex, ChainMode, Chain, randomChainId } from '@fadroma/connect'

import $, { JSONFile, JSONDirectory, OpaqueDirectory } from '@hackbg/file'
import type { Path } from '@hackbg/file'
import { freePort, Endpoint, waitPort, isPortTaken } from '@hackbg/port'
import * as Dock from '@hackbg/dock'

import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'

/** Path to this package. Used to find the build script, dockerfile, etc.
  * WARNING: Keep the ts-ignore otherwise it might break at publishing the package. */
//@ts-ignore
const thisPackage = dirname(fileURLToPath(import.meta.url))

/** Supported connection types. */
export type DevnetPortMode = 'lcp'|'grpcWeb'

/** Supported devnet variants. */
export type DevnetPlatform = `scrt_1.${2|3|4|5|6|7|8|9}`

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
    this.deleteOnExit   = options.deleteOnExit ?? false
    this.chainId        = options.chainId ?? (this.deleteOnExit ? randomChainId() : 'fadroma-devnet')
    if (!this.chainId) throw new Error.Devnet.NoChainId()
    this.keepRunning    = options.keepRunning ?? !this.deleteOnExit
    this.podman         = options.podman ?? false
    this.platform       = options.platform ?? 'scrt_1.9'
    this.verbose        = options.verbose ?? false
    this.launchTimeout  = options.launchTimeout ?? 10
    this.dontMountState = options.dontMountState ?? false
    this.accounts       = options.accounts ?? this.accounts
    this.stateDir       = options.stateDir ?? $('state', this.chainId).path
    this.initScript     = options.initScript! ?? this.initScript
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

  get log (): Console {
    return new Console(`${this.chainId} @ ${this.host}:${this.port}`)
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
    // Environment variables in devnet container
    const env: Record<string, string> = {
      Verbose: this.verbose ? 'yes' : '',
      ChainId: this.chainId,
      GenesisAccounts: this.accounts.join(' '),
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
    if (this.initScript) Binds.push(`${this.initScript}:${this.initScriptMount}:ro`)
    if (!this.dontMountState) Binds.push(`${$(this.stateDir).path}:/state/${this.chainId}:rw`)
    const NetworkMode  = 'bridge'
    const PortBindings = { [`${this.port}/tcp`]: [{HostPort: `${this.port}`}] }
    const HostConfig   = { Binds, NetworkMode, PortBindings }
    const Tty          = true
    const AttachStdin  = true
    const AttachStdout = true
    const AttachStderr = true
    const Hostname     = this.chainId
    const Domainname   = this.chainId
    const extra   = {Tty, AttachStdin, AttachStdout, AttachStderr, Hostname, Domainname, HostConfig}
    const options = { env: this.spawnEnv, exposed: [`${this.port}/tcp`], extra }
    return options
  }
  /** Handle to created devnet container */
  get container () {
    if (this.engine && this.containerId) {
      return this.engine.container(this.containerId)
    }
  }
  /** This file contains the id of the current devnet container.
    * TODO store multiple containers */
  get devnetJSON (): JSONFile<Partial<this>> {
    return $(this.stateDir, 'devnet.json').as(JSONFile) as JSONFile<Partial<this>>
  }

  create = async (): Promise<this> => {
    // ensure we have image and chain id
    const image = await this.image
    if (!this.image) throw new Error.Missing('devnet image')
    if (!this.chainId) throw new Error.Missing.ChainId()
    // if port is unspecified or taken, increment
    while (!this.port || await isPortTaken(Number(this.port))) {
      this.port = Number(this.port) + 1 || await freePort()
      if (this.port < 1024 || this.port > 65535) Object.assign(this, { port: undefined })
      if (this.port) this.log.log('trying port', this.port)
    }
    // create container
    this.log.log(`creating devnet`, this.chainId, `on`, String(this.url))
    const container = image!.container(
      this.chainId, this.spawnOptions, this.initScript ? [this.initScriptMount] : []
    )
    await container.create()
    this.setExitHandler()
    // set id and save
    this.containerId = container.id
    this.log.log(`created container`, container.id?.slice(0, 8))
    return await this.save()
  }

  /** Write the state of the devnet to a file. This saves the info needed to respawn the node */
  save = async (extra = {}): Promise<this> => {
    this.devnetJSON.save({
      chainId:     this.chainId,
      containerId: this.containerId,
      port:        this.port,
      imageTag:    this.imageTag,
      podman:      this.podman||undefined,
    })
    return this
  }

  /** Restore a Devnet from the info stored in the devnet.json file */
  static load (dir: string|Path): Devnet {
    const console = new Console('devnet')
    dir = $(dir)
    if (!dir.isDirectory()) throw new Error(`not a directory: ${dir.path}`)
    const devnetJSON = dir.at('devnet.json')
    if (!dir.at('devnet.json').isFile()) throw new Error(`not a file: ${devnetJSON.path}`)
    let state: Partial<Devnet>
    try {
      state = devnetJSON.as(JSONFile).load() || {}
    } catch (e) {
      console.warn(e)
      throw new Error(`failed restoring devnet from ${devnetJSON.path}`)
    }
    if (!state.containerId) console.warn(`${devnetJSON.path}: no containerId`)
    if (!state.chainId) console.warn(`${devnetJSON.path}: no chainId`)
    if (!state.port) console.warn(`${devnetJSON.path}: no port`)
    return new Devnet(state)
  }

  /** Start the container. */
  start = async (): Promise<this> => {
    if (!this.running) {
      const container = await this.container ?? await (await this.create()).container!
      this.log.log('starting container', container.id?.slice(0, 8))
      await container.start()
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
    const container = await this.container
    if (container) {
      this.log.log('stopping container', container.id)
      try {
        if (await container.isRunning) await container.kill()
      } catch (e) {
        if (e.statusCode == 404) {
          this.log.warn(`container ${this.containerId} not found`)
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
    if (!container) throw new Error.Devnet("can't export: no container")
    return container.export(repository, tag)
  }

  delete = async () => {
    let container
    try {
      container = await this.container
    } catch (e) {
      if (e.statusCode === 404) {
        this.log.info(`no container`, this.containerId?.slice(0, 8))
      } else {
        throw e
      }
    }
    if (container && await container?.isRunning) {
      await this.pause()
      await container.remove()
    }
    const state = $(this.stateDir)
    const path  = state.shortPath
    try {
      if (state.exists()) {
        this.log.log(`deleting ${path}...`)
        state.delete()
      }
    } catch (e: any) {
      if (e.code === 'EACCES' || e.code === 'ENOTEMPTY') {
        this.log.warn(`failed to delete ${path}: ${e.code}`)
        const image = await this.image
        if (image) {
          this.log.log('running cleanup container for', path)
          await image.ensure()
          const name = `${this.chainId}-cleanup`
          const extra = {
            AutoRemove: true,
            HostConfig: { Binds: [`${$(this.stateDir).path}:/state:rw`] }
          }
          const cleanupContainer = await image.run(name, { extra }, ['-rvf', '/state'], '/bin/rm')
          await cleanupContainer.start()
          this.log.log('waiting for cleanup container to finish...')
          await cleanupContainer.wait()
          this.log.log(`deleted ${path}/* via cleanup container.`)
          $(this.stateDir).delete()
        }
      } else {
        this.log.warn(`failed to delete ${path}:`, e)
        throw e
      }
    }
    return this
  }

  static deleteMany = (path: string|Path, ids?: ChainId[]): Promise<Devnet[]> => {
    const state  = $(path).as(OpaqueDirectory)
    const chains = (state.exists()&&state.list()||[])
      .map(name => $(state, name))
      .filter(path => path.isDirectory())
      .map(path => path.at('devnet.json').as(JSONFile))
      .filter(path => path.isFile())
      .map(path => $(path, '..'))
    return Promise.all(chains.map(dir=>Devnet.load(dir).delete()))
  }

  /** Get a Chain object corresponding to this devnet. */
  getChain = <C extends Chain, D extends ChainClass<C>> (
    $C: ChainClass<C> = Chain as unknown as ChainClass<C>
  ): C => {
    const chain = new $C({ id: this.chainId, mode: Chain.Mode.Devnet, devnet: this })
    return chain
  }

  /** Get the info for a genesis account, including the mnemonic */
  getAccount = async (name: string): Promise<Partial<Agent>> => {
    if (this.dontMountState) {
      if (!this.container) throw new Error.Devnet.ContainerNotSet()
      const [identity] = await (await this.container).exec(
        'cat', `/state/${this.chainId}/wallet/${name}.json`
      )
      return JSON.parse(identity)
    } else {
      return $(this.stateDir, 'wallet', `${name}.json`).as(JSONFile).load() as Partial<Agent>
    }
  }

  protected setExitHandler () {
    if (this.exitHandlerSet) {
      this.log.warn('exit handler already set')
      return
    }
    process.once('beforeExit', async () => {
      if (this.deleteOnExit) {
        await this.pause()
        await this.delete()
      } else if (!this.keepRunning) {
        await this.pause()
      } else {
        this.log.br()
        this.log.devnet.isNowRunning(this)
      }
    })
    this.exitHandlerSet = true
  }

  static dockerfiles: Record<DevnetPlatform, string> = {
    'scrt_1.2': $(thisPackage, 'devnets', 'scrt_1_2.Dockerfile').path,
    'scrt_1.3': $(thisPackage, 'devnets', 'scrt_1_3.Dockerfile').path,
    'scrt_1.4': $(thisPackage, 'devnets', 'scrt_1_4.Dockerfile').path,
    'scrt_1.5': $(thisPackage, 'devnets', 'scrt_1_5.Dockerfile').path,
    'scrt_1.6': $(thisPackage, 'devnets', 'scrt_1_6.Dockerfile').path,
    'scrt_1.7': $(thisPackage, 'devnets', 'scrt_1_7.Dockerfile').path,
    'scrt_1.8': $(thisPackage, 'devnets', 'scrt_1_8.Dockerfile').path,
    'scrt_1.9': $(thisPackage, 'devnets', 'scrt_1_9.Dockerfile').path
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
    'scrt_1.9': 'lcp'
  }

}
