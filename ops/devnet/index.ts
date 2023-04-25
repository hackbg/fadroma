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
  Chain: { devnet: (...args:any[])=>Chain },
  version: unknown
) {
  return <T> (options: T) => {
    const config = new Config()
    const devnet = config.getDevnet(version as Parameters<typeof config.getDevnet>[0])
    return Chain.devnet({
      id: devnet.chainId,
      url: devnet.url.toString(),
      mode: ChainMode.Devnet,
      devnet,
    })
  }
}
