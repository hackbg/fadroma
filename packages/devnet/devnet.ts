import $, { JSONFile, JSONDirectory, OpaqueDirectory } from '@hackbg/kabinet'
import { CustomError, bold } from '@hackbg/konzola'
import { EnvConfig } from '@hackbg/konfizi'
import { CommandContext } from '@hackbg/komandi'
import { freePort, waitPort, Endpoint } from '@hackbg/portali'
import { randomHex } from '@hackbg/formati'
import * as Dokeres from '@hackbg/dokeres'
import * as Fadroma from '@fadroma/core'
import { AgentOpts, DevnetHandle, Chain, ChainMode, ClientConsole } from '@fadroma/core'

import { resolve, relative, basename, dirname } from 'path'
import { cwd }                                  from 'process'
import { readlinkSync, symlinkSync }            from 'fs'
import { fileURLToPath }                        from 'url'

import {
  Devnet,
  DevnetConfig,
  DevnetCommands,
  devnetPortModes,
  resetDevnet
} from './devnet-base'
import type { DevnetPlatform, DevnetPortMode } from './devnet-base'
//import { RemoteDevnet } from './devnet-remote'
import { DockerDevnet } from './devnet-docker'

/** Returns the function that goes into Fadroma.Chain.variants (when it's populated
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
  dokeres?: Dokeres.Engine
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
