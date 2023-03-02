import {
  Chain,
  ChainMode,
} from '@fadroma/core'
import {
  Devnet,
  DevnetCommands,
  DevnetPlatform,
  DevnetPortMode,
  devnetPortModes,
  resetDevnet
} from './devnet-base'
import { DevnetConfig } from './devnet-config'
//import { RemoteDevnet } from './devnet-remote'
import { DockerDevnet } from './devnet-docker'
import * as Dock from '@hackbg/dock'

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

export {
  DevnetError
} from './devnet-events'

export type {
  DevnetPlatform,
  DevnetPortMode
} from './devnet-base'

export {
  Devnet,
  DevnetConfig,
  DevnetCommands,
  devnetPortModes,
  resetDevnet,
  //RemoteDevnet,
  DockerDevnet,
}
