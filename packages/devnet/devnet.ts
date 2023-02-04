import {
  Chain,
  ChainMode,
  ClientConsole
} from '@fadroma/core'
import {
  Devnet,
  DevnetCommands,
  DevnetConfig,
  DevnetPlatform,
  DevnetPortMode,
  devnetPortModes,
  resetDevnet
} from './devnet-base'
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
    const node = await getDevnet(version)
    const id   = node.chainId
    const url  = node.url.toString()
    return new Chain(id, { url, mode, node })
  }
}

export function getDevnet (
  platform: DevnetPlatform,
  server?:  string,
  chainId?: string,
  dokeres?: Dock.Engine
): Devnet {
  //if (server) {
    //return RemoteDevnet.getOrCreate(platform, 'TODO', server, undefined, chainId, chainId)
  //} else {
    return DockerDevnet.getOrCreate(platform, dokeres)
  //}
}

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
