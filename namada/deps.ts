export type { Address, Hash, ChainId, Uint128 }
export { decode, u64, u256 } from '@hackbg/borshest'
export { Console, bold } from '@hackbg/logs'
export { Case, base16 } from '@hackbg/4mat'

import type { Address, Hash, Chain, Connection, ChainId, Uint128 } from '@hackbg/fadroma'

export async function tendermintConnect (options: {
  url: string|URL,
  chainId?: ChainId,
  bech32Prefix?: string
}) {
  throw new Error('todo!')
  return {}
}

export interface TendermintChain extends Chain {
  bech32Prefix?: string
}

export interface TendermintConnection extends Connection {
  url: string|URL
}

export interface TendermintValidator {
  address?: Address
  publicKey?: Hash
  votingPower: bigint
  proposerPriority: bigint
}

export type TendermintMetadata = Record<string, TendermintValidator>

export interface TendermintTransaction {
  chain: Chain
  hash:  Hash
}

export interface TendermintBlock {
  hash:   unknown
  height: unknown
}

export function optionallyParallel (...args: any[]): any {
  throw new Error('not implemented')
}

export function getValidators(...args: any[]): any {
  throw new Error('not implemented')
}
