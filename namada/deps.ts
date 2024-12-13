export type { Address, Hash, ChainId, Uint128 }
export { decode, u64, u256 } from '@hackbg/borshest'
export { Console, bold } from '@hackbg/logs'
export { Case, base16 } from '@hackbg/4mat'
export * as Tendermint from '@fadroma/tm'

import type { Address, Hash, Chain, Connection, ChainId, Uint128 } from '@hackbg/fadroma'

export async function tendermintConnect (options: {
  url: string|URL,
  chainId?: ChainId,
  bech32Prefix?: string
}) {
  throw new Error('todo!')
  return {}
}

export function optionallyParallel (...args: any[]): any {
  throw new Error('not implemented')
}

export function getValidators(...args: any[]): any {
  throw new Error('not implemented')
}
