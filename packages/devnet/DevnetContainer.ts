import Error from './DevnetError'
import Console from './DevnetConsole'
import Devnet from './DevnetBase'
import { devnetPortModes, DevnetPlatform } from './DevnetConfig'
import type { DevnetOpts, DevnetState } from './DevnetBase'

import type { AgentOpts, DevnetHandle } from '@fadroma/core'

import * as Dock from '@hackbg/dock'
import $, { JSONFile, JSONDirectory } from '@hackbg/file'
import { bold } from '@hackbg/logs'
import { freePort, waitPort } from '@hackbg/port'

import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Root of this module.
  * Used for finding embedded assets, e.g. Dockerfiles.
  * TypeScript doesn't like `import.meta.url` when compiling to JS. */
//@ts-ignore
export const devnetPackage = dirname(fileURLToPath(import.meta.url)) // resource finder

/** Parameters for the Dockerode-based implementation of Devnet.
  * (https://www.npmjs.com/package/dockerode) */
export interface DockerDevnetOpts extends DevnetOpts {
  /** Container image of the chain's runtime. */
  image?: Dock.Image
  /** Init script to launch the devnet. */
  initScript?: string
  /** Once this string is encountered in the log output
    * from the container, the devnet is ready to accept requests. */
  readyPhrase?: string
}

/** Fadroma can spawn a devnet in a container using Dockerode.
  * This requires an image name and a handle to Dockerode. */
export default class DevnetContainer extends Devnet implements DevnetHandle {

  static dockerfiles: Record<DevnetPlatform, string> = {
    'scrt_1.2': $(devnetPackage, 'scrt_1_2.Dockerfile').path,
    'scrt_1.3': $(devnetPackage, 'scrt_1_3.Dockerfile').path,
    'scrt_1.4': $(devnetPackage, 'scrt_1_4.Dockerfile').path,
    'scrt_1.5': $(devnetPackage, 'scrt_1_5.Dockerfile').path,
    'scrt_1.6': $(devnetPackage, 'scrt_1_6.Dockerfile').path,
    'scrt_1.7': $(devnetPackage, 'scrt_1_7.Dockerfile').path
  }

  static dockerTags: Record<DevnetPlatform, string> = {
    'scrt_1.2': 'ghcr.io/hackbg/fadroma-devnet-scrt-1.2:master',
    'scrt_1.3': 'ghcr.io/hackbg/fadroma-devnet-scrt-1.3:master',
    'scrt_1.4': 'ghcr.io/hackbg/fadroma-devnet-scrt-1.4:master',
    'scrt_1.5': 'ghcr.io/hackbg/fadroma-devnet-scrt-1.5:master',
    'scrt_1.6': 'ghcr.io/hackbg/fadroma-devnet-scrt-1.6:master',
    'scrt_1.7': 'ghcr.io/hackbg/fadroma-devnet-scrt-1.7:master',
  }

  static initScriptMount = 'devnet.init.mjs'

  static getOrCreate (kind: DevnetPlatform, dock: Dock.Engine) {
    const portMode = devnetPortModes[kind]
    const dockerfile = this.dockerfiles[kind]
    const imageTag = this.dockerTags[kind]
    const readyPhrase = 'indexed block'
    //const initScript = $(devnetPackage, this.initScriptMount).path
    const image = dock.image(imageTag, dockerfile, [this.initScriptMount])
    return new DevnetContainer({ portMode, image, readyPhrase })
  }

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

  constructor (options: DockerDevnetOpts = {}) {
    super(options)
    this.log.debug('Using a containerized devnet')
    this.identities  ??= this.stateRoot.in('identities').as(JSONDirectory)
    this.image       ??= options.image!
    this.initScript  ??= options.initScript!
    this.readyPhrase ??= options.readyPhrase!
  }

  log = new Console('@fadroma/devnet: docker')

  /** This should point to the standard production docker image for the network. */
  image: Dock.Image

  /** Handle to created devnet container */
  container: Dock.Container|null = null

  /** If set, overrides the script that launches the devnet in the container. */
  initScript: string|null = null

  /** Mounted out of devnet container to persist keys of genesis wallets. */
  identities: JSONDirectory<unknown>

  /** Once this phrase is encountered in the log output
    * from the container, the devnet is ready to accept requests. */
  readyPhrase: string

  /** Overridable for testing. */
  //@ts-ignore
  protected waitPort = waitPort

  /** Overridable for testing. */
  protected waitSeconds = 7

  /** Handle to Docker API if configured. */
  get dock (): Dock.Engine|null {
    return this.image.engine
  }

  /** Gets the info for a genesis account, including the mnemonic */
  async getGenesisAccount (name: string): Promise<AgentOpts> {
    if (process.env.FADROMA_DEVNET_NO_STATE_MOUNT) {
      if (!this.container) throw new Error.ContainerNotSet()
      const [identity] = await this.container.exec('cat', `/receipts/${this.chainId}/identities/${name}.json`)
      return JSON.parse(identity)
    } else {
      return this.identities.at(`${name}.json`).as(JSONFile).load() as AgentOpts
    }
  }

  /** Virtual path inside the container where the init script is mounted. */
  get initScriptMount (): string {
    return this.initScript ? $('/', $(this.initScript).name).path : '/devnet.init.mjs'
  }

  async spawn () {
    // if no port is specified, use a random port
    this.host = process.env.FADROMA_DEVNET_HOST ?? this.host

    // if no port is specified, use a random port
    this.port ??= (await freePort()) as number

    // tell the user that we have begun
    this.log.info(`Spawning new node to listen on`, bold(this.url))

    // create the state dirs and files
    const stateDirs = [ this.stateRoot, this.nodeState ]
    for (const item of stateDirs) {
      try {
        item.make()
      } catch (e: any) {
        this.log.warn(`Failed to create ${item.path}: ${e.message}`)
      }
    }

    // run the container
    this.container = await this.image.run(
      `${this.chainId}-${this.port}`,               // container name
      this.spawnOptions,                            // container options
      this.initScript ? [this.initScriptMount] : [] // command and arguments
    )

    // address the container by ip if possible to support docker-in-docker scenarios
    // FIXME: this currently uses an env var; move it to DevnetConfig
    //this.host = await this.container.ip ?? 'localhost'

    // update the record
    this.save()

    // wait for logs to confirm that the genesis is done
    await this.container.waitLog(
      this.readyPhrase,
      false,
      this.waitSeconds,
      DevnetContainer.logFilter
    )

    // wait for port to be open
    await this.waitPort({
      host: this.host,
      port: Number(this.port)
    })

    return this
  }

  /** The @hackbg/dock options for spawining a container */
  get spawnOptions () {

    // Environment variables in devnet container
    const env: Record<string, string> = {
      Verbose:         process.env.FADROMA_DEVNET_VERBOSE ? 'yes' : '',
      ChainID:         this.chainId,
      GenesisAccounts: this.genesisAccounts.join(' '),
    }

    // Which kind of API to expose at the default container port
    switch (this.portMode) {
      case 'lcp':     env.lcpPort     = String(this.port);      break
      case 'grpcWeb': env.grpcWebAddr = `0.0.0.0:${this.port}`; break
      default: throw new Error(`DockerDevnet#portMode must be either 'lcp' or 'grpcWeb'`)
    }

    // Container options
    const options = {
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
          Binds: [] as string[],
          PortBindings: { [`${this.port}/tcp`]: [{HostPort: `${this.port}`}] }
        }
      }
    }

    // Override init script for development
    if (this.initScript) {
      options.extra.HostConfig.Binds.push(
        `${this.initScript}:${this.initScriptMount}:ro`
      )
    }

    // Mount receipts directory (FIXME:
    // - breaks Drone DinD CI
    // - leaves root-owned files in project dir)
    if (!process.env.FADROMA_DEVNET_NO_STATE_MOUNT) {
      options.extra.HostConfig.Binds.push(
        `${this.stateRoot.path}:/receipts/${this.chainId}:rw`
      )
    }

    return options

  }

  async load (): Promise<DevnetState> {
    const data = await super.load()
    if (data?.containerId) {
      this.container = await this.dock!.container(data.containerId)
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
      this.log.info(`No devnet found at ${bold(shortPath)}`)
      return this.spawn()
    }

    // get stored info about the container was supposed to be
    let id: string
    try {
      id = (await this.load()).containerId!
    } catch (e) {
      // if node state is corrupted, spawn
      this.log.warn(e)
      this.log.info(`Reading ${bold(shortPath)} failed`)
      return this.spawn()
    }

    this.container = await this.dock!.container(id)

    // check if contract is running
    let running: boolean
    try {
      running = await this.container.isRunning
    } catch (e) {
      // if error when checking, RESPAWN
      this.log.info(`✋ Failed to get container ${bold(id)}`)
      this.log.info('Error was:', e)
      this.log.info(`Cleaning up outdated state...`)
      await this.erase()
      this.log.info(`Trying to launch a new node...`)
      return this.spawn()
    }

    // if not running, RESPAWN
    if (!running) {
      await this.container.start()
    }

    // ...and try to make sure it dies when the Node process dies
    if (!this.exitHandlerSet) {
      process.on('beforeExit', () => {
        if (this.ephemeral) {
          this.container!.kill()
        } else {
          this.log.br()
          this.log.devnetIsRunning(this)
        }
      })
      this.exitHandlerSet = true
    }

    return this

  }

  private exitHandlerSet = false

  /** Kill the container, if necessary find it first */
  async kill () {

    if (this.container) {
      const { id } = this.container
      await this.container.kill()
      this.log.info(`Stopped container`, bold(id))
      return
    }

    this.log.info(`Checking if there's an old node that needs to be stopped...`)

    try {
      const { containerId } = await this.load()
      await this.container!.kill()
      this.log.info(`Stopped container ${bold(containerId!)}.`)
    } catch (_e) {
      this.log.info("Didn't stop any container.")
    }

  }

  /** External environment needs to be returned to a pristine state via Docker.
    * (Otherwise, root-owned dotdirs leak and have to be manually removed with sudo.) */
  async erase () {
    const path = this.stateRoot.shortPath
    try {
      if (this.stateRoot.exists()) {
        this.log.info(`Deleting ${path}...`)
        this.stateRoot.delete()
      }
    } catch (e: any) {
      if (e.code === 'EACCES' || e.code === 'ENOTEMPTY') {
        this.log.warn(`Failed to delete ${path}: ${e.code}; trying cleanup container...`)
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
        this.log.info(`Starting cleanup container...`)
        await cleanupContainer.start()
        this.log.info('Waiting for cleanup to finish...')
        await cleanupContainer.wait()
        this.log.info(`Deleted ${path} via cleanup container.`)
      } else {
        this.log.warn(`Failed to delete ${path}: ${e.message}`)
        throw e
      }
    }
  }

  async export (repository?: string, tag?: string) {
    if (!this.container) throw new Error("Can't export: no container")
    return this.container.export(repository, tag)
  }

}

