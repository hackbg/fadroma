import portManager, { waitPort } from '@hackbg/port'
import { Path, SyncFS, FileFormat } from '@hackbg/file'
import * as OCI from '@fadroma/oci'
import { Core, Program, Chain, Token } from '@fadroma/agent'
import type { Address, CodeId, Uint128 } from '@fadroma/agent'

import { packageRoot } from './package'
import * as Impl from './devnet-impl'

/** Identifiers of supported platforms. */
export type Platform = 'scrt'|'okp4'

/** Identifiers of supported API endpoints.
  * These are different APIs exposed by a node at different ports.
  * One of these is used by default - can be a different one
  * depending on platform version. */
export type APIMode = 'http'|'rpc'|'grpc'|'grpcWeb'

export class DevnetContainerState {
  /** Whether the devnet container is started. */
  running:         boolean = false
  /** Chain ID of chain node running inside devnet container. */
  chainId?:        string
  /** Denomination of base gas token for this chain. */
  gasToken?:       Token.Native
  /** Whether more detailed output is preferred. */
  verbose:         boolean = false
  /** Name of devnet platform. */
  platformName:    Platform
  /** Version of devnet platform. */
  platformVersion: string
  /** Container instance of devnet. */
  container:       OCI.Container = new OCI.Container()
  /** URL for connecting to a remote devnet. */
  url?:            string|URL
  /** The protocol of the API URL without the trailing colon. */
  nodeProtocol:    string = 'http'
  /** The hostname of the API URL. */
  nodeHost:        string = 'localhost'
  /** Which service does the API URL port correspond to. */
  nodePortMode?:   APIMode
  /** The port of the API URL. */
  nodePort?:       string|number
  /** Name of binary in container to start. */
  nodeBinary?:     string
  /** Initial accounts. */
  genesisAccounts: Record<Address, number|bigint|Uint128> = {}
  /** Initial uploads. */
  genesisUploads:  Record<CodeId, Partial<Program.CompiledCode>>  = {}
  /** If set, overrides the script that launches the devnet in the container. */
  initScript:      Path = new SyncFS.File(packageRoot, 'devnet.init.mjs')
  /** Function that waits for port to open after launching container.
    * Tests override this to save time. */
  waitPort:        typeof waitPort = waitPort
  /** Once this phrase is encountered in the log output
    * from the container, the devnet is ready to accept requests. */
  waitString:      string = ''
  /** Seconds to wait after first block.
    * Tests override this to save time. */
  waitMore:        number = 7
  /** This directory contains the state of all devnets, e.g. `~/.local/share/fadroma/devnets`.
    * The devnet container will create a subdirectory named after the chain ID. */
  stateRoot:       SyncFS.Directory
  /** What to do with the devnet once the process that has spawned it exits.
    * - "remain": the devnet container keeps running
    * - "pause": the devnet container is stopped
    * - "delete": the devnet container is stopped and deleted, along with the state directory */
  onExit:          'remain'|'pause'|'delete'
  /** The exit handler that cleans up external resources. */
  exitHandler?:    (...args: any)=>void

  constructor (options: Partial<DevnetContainerState> = {}) {
    Core.assign(this, options, [
      'chainId',
      'container',
      'gasToken',
      'genesisAccounts',
      'genesisUploads',
      'initScript',
      'nodeBinary',
      'nodeHost',
      'nodePort',
      'nodePortMode',
      'nodeProtocol',
      'onExit',
      'platformName',
      'platformVersion',
      'running',
      'stateRoot',
      'waitString',
      'verbose',
    ])
  }

  get platform () {
    if (!this.platformName) {
      throw new Core.Error('platformName is unset')
    }
    if (!this.platformName) {
      throw new Core.Error('platformVersion is unset')
    }
    return `${this.platformName}_${this.platformVersion}`
  }

  /** This directory contains the state of the devnet,
    * such as statefile, runfile, genesis accounts. */
  get stateDir (): SyncFS.Directory {
    if (!this.chainId) {
      throw new Core.Error("This devnet's chain ID is unset, hence no state directory")
    }
    return this.stateRoot.subdir(this.chainId)
  }
  /** This file contains the state of the devnet,
    * such as container ID. */
  get stateFile (): SyncFS.File {
    if (!this.chainId) {
      throw new Core.Error("This devnet's chain ID is unset, hence no state file")
    }
    return this.stateDir.file('devnet.json').setFormat(FileFormat.JSON)
  }
  /** This file is created when the container is started.
    * Deleting it tells the script running inside the container to kill the devnet. */
  get runFile (): SyncFS.File {
    if (!this.chainId) {
      throw new Core.Error("This devnet's chain ID is unset, hence no runfile.")
    }
    return this.stateDir.file('devnet.run')
  }
}

/** A private local instance of a network,
  * running in a container managed by @fadroma/oci. */
export default abstract class DevnetContainer
  extends DevnetContainerState
  implements Chain.Backend
{
  /** Logger. */
  log = new Core.Console('Devnet')
  constructor (options: Partial<DevnetContainer> = {}) {
    super(options)
    Impl.initPort(this)
    Impl.initChainId(this)
    Impl.initLogger(this)
    Impl.initState(this, options)
    Impl.initDynamicUrl(this)
    Impl.initContainer(this)
    Impl.initContainerState(this)
  }
  /** Wait for the devnet to be created. */
  declare readonly created: Promise<this>
  /** Wait for the devnet to be deleted. */
  declare readonly deleted: Promise<this>
  /** Wait for the devnet to be started. */
  declare readonly started: Promise<this>
  /** Wait for the devnet to be stopped. */
  declare readonly paused:  Promise<this>
  /** Obtain a Connection object to this devnet, optionally with a specific Identity. */
  abstract connect (parameter?: string|Partial<Chain.Identity>): Promise<Chain.Connection>
  /** Get info for named genesis account, including the mnemonic */
  async getIdentity (
    name: string|{ name?: string }
  ): Promise<Partial<Chain.Identity> & { mnemonic: string }> {
    return Impl.getIdentity(this, name)
  }
  /** Export the contents of the devnet as a container image. */
  async export (
    repository: string = this.chainId,
    tag: string = Core.timestamp()
  ) {
    const container = await this.container
    if (!container) {
      throw new Core.Error("can't export: no container")
    }
    return container.export(repository, tag)
  }
}
