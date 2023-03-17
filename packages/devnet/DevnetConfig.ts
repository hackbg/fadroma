import DevnetContainer from './DevnetContainer'
import { ChainMode } from '@fadroma/core'
import type { Chain } from '@fadroma/core'

import { Config } from '@hackbg/conf'
import { Engine, Docker, Podman } from '@hackbg/dock'

/** Gets devnet settings from environment. */
export default class DevnetConfig extends Config {

  /** Which kind of devnet to launch */
  platform: DevnetPlatform = this.getString(
    'FADROMA_DEVNET_PLATFORM',
    ()=>'scrt_1.8'
  ) as DevnetPlatform

  /** Chain id for devnet .*/
  chainId: string = this.getString(
    'FADROMA_DEVNET_CHAIN_ID',
    ()=>"fadroma-devnet"
  )

  /** Whether to remove the devnet after the command ends. */
  ephemeral: boolean = this.getFlag(
    'FADROMA_DEVNET_EPHEMERAL',
    ()=>false
  )

  /** Host for devnet. */
  host: string|null = this.getString(
    'FADROMA_DEVNET_HOST',
    ()=>null
  )

  /** Port for devnet. */
  port: string|null = this.getString(
    'FADROMA_DEVNET_PORT',
    ()=>null)

  /** Whether to use Podman instead of Docker to run the devnet container. */
  podman: boolean = this.getFlag(
    'FADROMA_DEVNET_PODMAN',
    () => this.getFlag(
      'FADROMA_PODMAN',
      ()=>false))

  getDevnet (platform: DevnetPlatform = this.platform ?? 'scrt_1.8') {
    if (!platform) throw new Error('Devnet platform not specified')
    const Engine = this.podman ? Podman.Engine : Docker.Engine
    const containerEngine = new Engine()
    return DevnetContainer.getOrCreate(platform, containerEngine)
  }

}

/** Supported connection types. */
export type DevnetPortMode = 'lcp'|'grpcWeb'

/** Supported devnet variants. */
export type DevnetPlatform =
  |'scrt_1.2'
  |'scrt_1.3'
  |'scrt_1.4'
  |'scrt_1.5'
  |'scrt_1.6'
  |'scrt_1.7'
  |'scrt_1.8'

/** Default connection type to expose on each devnet variant. */
export const devnetPortModes: Record<DevnetPlatform, DevnetPortMode> = {
  'scrt_1.2': 'lcp',
  'scrt_1.3': 'grpcWeb',
  'scrt_1.4': 'grpcWeb',
  'scrt_1.5': 'lcp',
  'scrt_1.6': 'lcp',
  'scrt_1.7': 'lcp',
  'scrt_1.8': 'lcp'
}

/** Returns the function that goes into Chain.variants (when it's populated
  * in @fadroma/connect) to enable devnets for a target platform. */
export function defineDevnet (
  Chain: { new(...args:any[]): Chain },
  version: DevnetPlatform
) {
  return async <T> (config: T) => {
    const mode = ChainMode.Devnet
    const node = await new DevnetConfig().getDevnet(version)
    const id   = node.chainId
    const url  = node.url.toString()
    return new Chain(id, { url, mode, node })
  }
}
