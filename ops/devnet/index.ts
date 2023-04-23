export * from './DevnetBase'
export { default as Devnet } from './DevnetBase'

export * from './DevnetContainer'
export { default as DevnetContainer } from './DevnetContainer'

export * from './DevnetRemote'
export { default as DevnetRemote } from './DevnetRemote'

import { Config } from '../util'
import type { DevnetConfig } from '../util'

import { Chain, ChainMode } from '@fadroma/agent'

/** @returns Devnet configured as per environment and options. */
export function getDevnet (options: Partial<DevnetConfig> = {}) {
  return new Config({ devnet: options }).getDevnet()
}

export function defineDevnet (
  Chain: { new(...args:any[]): Chain },
  version: unknown
) {
  return <T> (config: T) => {
    const mode = ChainMode.Devnet
    const conf = new Config()
    const node = conf.getDevnet(version as Parameters<typeof conf.getDevnet>[0])
    const id   = node.chainId
    const url  = node.url.toString()
    return new Chain(id, { url, mode, node })
  }
}
