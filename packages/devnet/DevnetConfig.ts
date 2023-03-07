import DevnetContainer from './DevnetContainer'
import { ChainMode } from '@fadroma/core'
import type { Chain } from '@fadroma/core'

import { EnvConfig } from '@hackbg/conf'
import { Engine, Docker, Podman } from '@hackbg/dock'

/** Gets devnet settings from environment. */
export default class DevnetConfig extends EnvConfig {

  /** Whether to use Podman instead of Docker to run the devnet container. */
  podman: boolean = this.getBoolean('FADROMA_DEVNET_PODMAN', () =>
    this.getBoolean('FADROMA_PODMAN', ()=>false))

  /** URL to the devnet manager endpoint, if used. */
  manager: string|null = this.getString('FADROMA_DEVNET_MANAGER', ()=>null)

  /** Whether to remove the devnet after the command ends. */
  ephemeral: boolean = this.getBoolean('FADROMA_DEVNET_EPHEMERAL', ()=>false)

  /** Chain id for devnet .*/
  chainId: string = this.getString('FADROMA_DEVNET_CHAIN_ID', ()=>"fadroma-devnet")

  /** Host for devnet. */
  host: string|null = this.getString('FADROMA_DEVNET_HOST', ()=>null)

  /** Port for devnet. */
  port: string|null = this.getString('FADROMA_DEVNET_PORT', ()=>null)

  getContainerEngine (): Engine {
    if (this.podman) {
      return new Docker.Engine()
    } else {
      return new Podman.Engine()
    }
  }

  getDevnetContainer (kind: DevnetPlatform, chainId?: string) {
    return DevnetContainer.getOrCreate(kind, this.getContainerEngine())
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

/** Default connection type to expose on each devnet variant. */
export const devnetPortModes: Record<DevnetPlatform, DevnetPortMode> = {
  'scrt_1.2': 'lcp',
  'scrt_1.3': 'grpcWeb',
  'scrt_1.4': 'grpcWeb',
  'scrt_1.5': 'lcp',
  'scrt_1.6': 'lcp',
  'scrt_1.7': 'lcp'
}

/** Returns the function that goes into Chain.variants (when it's populated
  * in @fadroma/connect) to enable devnets for a target platform. */
export function defineDevnet (
  Chain: { new(...args:any[]): Chain },
  version: DevnetPlatform
) {
  return async <T> (config: T) => {
    const mode = ChainMode.Devnet
    const node = await new DevnetConfig().getDevnetContainer(version)
    const id   = node.chainId
    const url  = node.url.toString()
    return new Chain(id, { url, mode, node })
  }
}
