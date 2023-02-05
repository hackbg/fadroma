import { Devnet, devnetPortModes } from './devnet-base'
import type { DevnetOpts, DevnetPlatform } from './devnet-base'
import { DevnetError as Error, DevnetConsole as Console } from './devnet-events'

import type { AgentOpts, DevnetHandle } from '@fadroma/core'
import { bold } from '@hackbg/logs'
import { freePort, Endpoint } from '@hackbg/port'
import { randomHex } from '@hackbg/4mat'
import $ from '@hackbg/file'

/** Parameters for the HTTP API-managed implementation of Devnet. */
export type RemoteDevnetOpts = DevnetOpts & {
  /** Base URL of the API that controls the managed node. */
  managerURL: string
}

/** When running in docker-compose, Fadroma needs to request
  * from the devnet container to spawn a chain node with the
  * given chain id and identities via a HTTP API. */
export class RemoteDevnet extends Devnet implements DevnetHandle {

  static managerScriptName = 'devnet.server.mjs'

  /** Get a handle to a remote devnet. If there isn't one,
    * create one. If there already is one, reuse it. */
  static getOrCreate (
    kind:        DevnetPlatform,
    projectRoot: string,
    managerURL:  string,
    chainId?:    string,
    prefix?:     string,
    portMode:    string = devnetPortModes[kind]
  ) {

    const log = new Console('@fadroma/devnet: remote (init)')

    // If passed a chain id, use it; this makes a passed prefix irrelevant.
    if (chainId && prefix) {
      log.warn('Passed both chainId and prefix to RemoteDevnet.getOrCreate: ignoring prefix')
    }

    // Establish default prefix. Chain subclasses should define this.
    if (!prefix) {
      prefix = 'devnet'
    }

    // If no chain id passed, try to reuse the last created devnet;
    // if there isn't one, create a new one and symlink it as active.
    if (!chainId) {
      const active = $(projectRoot, 'receipts', `${prefix}-active`)
      if (active.exists()) {
        log.info('Reusing existing managed devnet with chain id', bold(active.real.name))
      } else {
        chainId = `${prefix}-${randomHex(4)}`
        const devnet = $(projectRoot).in('receipts').in(chainId)
        devnet.make()
        active.pointTo(devnet.path)
        log.info('Creating new managed devnet with chain id', bold(chainId))
      }
    }

    return new RemoteDevnet({ managerURL, chainId, portMode })

  }

  constructor (options: any) {
    super(options)
    this.log.info('Constructing', bold('remotely managed'), 'devnet')
    this.manager = new Endpoint(options.managerURL)
    this.host    = this.manager.url.hostname
  }

  log = new Console('@fadroma/devnet: remote')

  manager: Endpoint

  async spawn () {
    const port = await freePort()
    this.port = port
    this.log.info(bold('Spawning managed devnet'), this.chainId, 'on port', port)
    const result = await this.manager.get('/spawn', {
      id:          this.chainId,
      genesis:     this.genesisAccounts.join(','),
      lcpPort:     (this.portMode === 'lcp')     ? String(port)      : undefined,
      grpcWebAddr: (this.portMode === 'grpcWeb') ? `0.0.0.0:${port}` : undefined
    })
    if (result.error === 'Node already running') {
      this.log.info('Remote devnet already running')
      if (this.portMode === 'lcp' && result.lcpPort) {
        this.port = Number(result.lcpPort)
      } else if (this.portMode === 'grpcWeb' && result.grpcWebAddr) {
        this.port = Number(new URL('idk://'+result.grpcWebAddr).port)
      }
      this.log.info('Reusing port', this.port, 'for', this.portMode)
    }
    await this.ready()
    this.log.info(`Waiting 7 seconds for good measure...`)
    await new Promise(ok=>setTimeout(ok, 7000))
    return this
  }

  save () {
    const shortPath = $(this.nodeState.path).shortPath
    this.log.info(`Saving devnet node to ${shortPath}`)
    const data = { chainId: this.chainId, port: this.port }
    this.nodeState.save(data)
    return this
  }

  async respawn () {
    const shortPath = $(this.nodeState.path).shortPath
    // if no node state, spawn
    if (!this.nodeState.exists()) {
      this.log.info(`No devnet found at ${bold(shortPath)}`)
      return this.spawn()
    }
    return this
  }

  protected async ready (): Promise<void> {
    while (true) {
      const { ready } = await this.manager.get('/ready')
      if (ready) {
        break
      }
      this.log.info('Waiting for devnet to become ready...')
      await new Promise(resolve=>setTimeout(resolve, 2000))
    }
  }

  async getGenesisAccount (name: string): Promise<AgentOpts> {
    const identity = await this.manager.get('/identity', { name })
    if (identity.error) {
      throw new Error(`RemoteDevnet#getGenesisAccount: failed to get ${name}: ${identity.error}`)
    }
    return identity
  }

  async erase () {
    throw new Error('RemoteDevnet#erase: not implemented')
  }

  async kill () {
    throw new Error('RemoteDevnet#kill: not implemented')
  }

}
