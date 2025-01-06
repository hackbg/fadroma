import type { Entity } from './coreEntity.ts'
import type { Hash }   from './coreHash.ts'
import type { Chain }  from './coreChain.ts'
import type { Height } from './coreBlock.ts'
import type { Agent }  from './coreAgent.ts'

/** A transaction hash, uniquely identifying an executed transaction on a chain. */
export type TxHash = Hash

/** A transaction in a block on a chain. */
export interface Transaction extends Entity {
  chain: Chain,
  block: Height,
  hash:  Hash,
  data:  unknown
}

/** A batch of transactions. */
export interface Batch {
  /** Add a transaction to the batch. */
  add (tx: unknown): this
  /** Submit the batch. */
  submit (agent: Agent): Promise<unknown>
}
