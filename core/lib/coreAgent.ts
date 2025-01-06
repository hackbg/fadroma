import type { LoggingEntity } from './coreEntity.ts'
import type { Hash } from './coreHash.ts'
import type { Chain, Address } from './coreChain.ts'
import type { Uint128 } from './coreNumber.ts'
import type { Batch } from './coreTx.ts'

/** A cryptographic identity. */
export interface Signer extends LoggingEntity {
  publicKey?: Hash
  sign (_: unknown): unknown
}

/** Binds an `Signer` to a `Chain`, enabling broadcasting of transactions. */
export interface Agent extends Signer {
  chain:   Chain
  address: Address
  //fees?:   Token.FeeMap<'send'|'upload'|'init'|'exec'>,

  batch        (): Batch
  fetchBalance (): Promise<Record<string, Uint128>>
}
