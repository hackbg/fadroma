export * from './DevnetBase'
export { default as Devnet } from './DevnetBase'

export * from './DevnetContainer'
export { default as DevnetContainer } from './DevnetContainer'

export * from './DevnetRemote'
export { default as DevnetRemote } from './DevnetRemote'

import { Config } from '../util'
import type { DevnetConfig } from '../util'

/** @returns Devnet configured as per environment and options. */
export function getDevnet (options: Partial<DevnetConfig> = {}) {
  return new Config({ devnet: options }).getDevnet()
}
