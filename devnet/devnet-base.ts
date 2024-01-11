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
import * as Impl from './devnet-impl'

/** A private local instance of a network,
  * running in a container managed by @fadroma/oci. */
export default abstract class DevnetContainer extends Backend {
  /** Whether more detailed output is preferred. */
  verbose:              boolean                                = false
  /** Containerization engine (Docker or Podman). */
  containerEngine:      OCIConnection                          = new OCIConnection()
  /** Name or tag of image if set */
  containerImageTag?:   string
  /** Container image from which devnet will be spawned. */
  containerImage?:      OCIImage
  /** Path to Dockerfile to build the image if missing. */
  containerManifest?:   string
  /** ID of container if exists */
  containerId?:         string
  /** Name of binary in container to start. */
  nodeBinary?:          string
  /** Which service does the API URL port correspond to. */
  nodePortMode?:        APIMode
  /** The protocol of the API URL without the trailing colon. */
  nodeProtocol:         string                                 = 'http'
  /** The hostname of the API URL. */
  nodeHost:             string                                 = 'localhost'
  /** The port of the API URL. */
  nodePort?:            string|number
  /** Initial accounts. */
  genesisAccounts:      Record<Address, number|bigint|Uint128> = {}
  /** Initial uploads. */
  genesisUploads:       Record<CodeId, Partial<CompiledCode>>  = {}
  /** If set, overrides the script that launches the devnet in the container. */
  initScript:           Path                                   = $(packageRoot, 'devnet.init.mjs')
  /** Function that waits for port to open after launching container.
    * Tests override this to save time. */
  waitPort:             typeof waitPort                        = waitPort
  /** Once this phrase is encountered in the log output
    * from the container, the devnet is ready to accept requests. */
  readyString:          string                                 = ''
  /** Seconds to wait after first block.
    * Tests override this to save time. */
  postLaunchWait:       number                                 = 7
  /** This directory contains the state of the devnet. */
  stateDir:             Path
  /** This file contains the id of the current devnet container,
    * and possibly other state. */
  stateFile:            JSONFile<Partial<this>>
  /** This hidden file is created when the container is started,
    * and is mounted into the container. Deleting it tells the script
    * running inside the container to kill the devnet. */
  runFile:              Path
  /** What to do with the devnet once the process that has spawned it exits.
    * - "remain": the devnet container keeps running
    * - "pause": the devnet container is stopped
    * - "delete": the devnet container is stopped and deleted, along with the state directory */
  onExit:               'remain'|'pause'|'delete'
  /** The exit handler that cleans up external resources. */
  exitHandler?:         (...args: any)=>void

  constructor (options: Partial<DevnetContainer> = {}) {
    super(options)
    assign(this, options, [
      'chainId',
      'containerEngine',
      'containerId',
      'containerImageTag',
      'containerManifest',
      'genesisAccounts',
      'genesisUploads',
      'initScript',
      'nodeBinary',
      'nodeHost',
      'nodePort',
      'nodePortMode',
      'nodeProtocol',
      'onExit',
      'platform',
      'readyString',
      'verbose',
    ])
    Impl.initPort(this)
    Impl.initImage(this)
    Impl.initChainId(this)
    Impl.initLogger(this)
    Impl.initState(this, options)
    Impl.initDynamicUrl(this)
    Impl.initCreateDelete(this)
    Impl.initStartPause(this)
  }

  declare readonly created: Promise<void>
  declare readonly deleted: Promise<void>
  declare readonly started: Promise<void>
  declare readonly paused:  Promise<void>

  /** Handle to created devnet container */
  get container () {
    if (this.containerEngine && this.containerId) {
      return this.containerEngine.container(this.containerId).then(container=>{
        container.log.label = this.log.label
        return container
      })
    }
  }

  /** Write the state of the devnet to a file.
    * This saves the info needed to respawn the node */
  async save (extra = {}): Promise<this> {
    this.stateFile.save({
      chainId:           this.chainId,
      containerImageTag: this.containerImageTag,
      containerId:       this.containerId,
      nodePort:          this.nodePort,
    })
    return this
  }

  /** Get info for named genesis account, including the mnemonic */
  async getIdentity (
    name: string|{ name?: string }
  ): Promise<Partial<Identity> & { mnemonic: string }> {
    return Impl.getIdentity(this, name)
  }

  /** Export the state of the devnet as a container image. */
  async export (repository?: string, tag?: string) {
    const container = await this.container
    if (!container) {
      throw new Error("can't export: no container")
    }
    return container.export(repository, tag)
  }

  /** Virtual path inside the container where the init script is mounted. */
  get initScriptMount (): string {
    return this.initScript
      ? $('/', $(this.initScript).basename).path
      : '/devnet.init.mjs'
  }

}
