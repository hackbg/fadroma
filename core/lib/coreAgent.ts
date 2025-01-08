import type { Logs } from '../deps.ts'
import type { LoggingEntity, Hash } from './coreEntity.ts'
import type { Chain, Address } from './coreChain.ts'
import type { Batch } from './coreChain.ts'
import type { Uint128 } from './coreNumber.ts'

/** A cryptographic identity. */
export type Signer = LoggingEntity<Hash, Logs.Console> & {
  publicKey?: Hash, sign (_: unknown): unknown
}
/** Binds an `Signer` to a `Chain`, enabling broadcasting of transactions. */
export type Agent = Signer & AgentApi & { chain: Chain, address: Address, batch(): Batch }
export type AgentApi = {
  fetchBalance (): Promise<Record<string, Uint128>>
}
