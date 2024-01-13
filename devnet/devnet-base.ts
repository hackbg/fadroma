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
import * as Impl from './devnet-impl'

/** Identifiers of supported platforms. */
export type Platform = 'scrt'|'okp4'

/** Identifiers of supported API endpoints.
  * These are different APIs exposed by a node at different ports.
  * One of these is used by default - can be a different one
  * depending on platform version. */
export type APIMode = 'http'|'rpc'|'grpc'|'grpcWeb'

/** A private local instance of a network,
  * running in a container managed by @fadroma/oci. */
export default abstract class DevnetContainer extends Backend {
  /** Whether more detailed output is preferred. */
  verbose:              boolean       = false
  /** Name of devnet platform. */
  platformName:         Platform
  /** Version of devnet platform. */
  platformVersion:      string
  /** Container instance of devnet. */
  container:            OCIContainer  = new OCIContainer()
  /** The protocol of the API URL without the trailing colon. */
  nodeProtocol:         string        = 'http'
  /** The hostname of the API URL. */
  nodeHost:             string        = 'localhost'
  /** Which service does the API URL port correspond to. */
  nodePortMode?:        APIMode
  /** The port of the API URL. */
  nodePort?:            string|number
  /** Name of binary in container to start. */
  nodeBinary?:          string
  /** Initial accounts. */
  genesisAccounts:      Record<Address, number|bigint|Uint128> = {}
  /** Initial uploads. */
  genesisUploads:       Record<CodeId, Partial<CompiledCode>>  = {}
  /** If set, overrides the script that launches the devnet in the container. */
  initScript:           Path = $(packageRoot, 'devnet.init.mjs')
  /** Function that waits for port to open after launching container.
    * Tests override this to save time. */
  waitPort:             typeof waitPort = waitPort
  /** Once this phrase is encountered in the log output
    * from the container, the devnet is ready to accept requests. */
  waitString:           string = ''
  /** Seconds to wait after first block.
    * Tests override this to save time. */
  waitMore:             number = 7
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
      'container',
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
      'waitString',
      'verbose',
    ])
    Impl.initPort(this)
    Impl.initChainId(this)
    Impl.initLogger(this)
    Impl.initState(this, options)
    Impl.initDynamicUrl(this)
    Impl.initContainer(this)
    Impl.initContainerState(this)
  }

  /** Wait for the devnet to be created. */
  declare readonly created: Promise<void>

  /** Wait for the devnet to be deleted. */
  declare readonly deleted: Promise<void>

  /** Wait for the devnet to be started. */
  declare readonly started: Promise<void>

  /** Wait for the devnet to be stopped. */
  declare readonly paused:  Promise<void>

  /** Get info for named genesis account, including the mnemonic */
  async getIdentity (
    name: string|{ name?: string }
  ): Promise<Partial<Identity> & { mnemonic: string }> {
    return Impl.getIdentity(this, name)
  }

  /** Export the contents of the devnet as a container image. */
  async export (repository?: string, tag?: string) {
    const container = await this.container
    if (!container) {
      throw new Error("can't export: no container")
    }
    return container.export(repository, tag)
  }

}
