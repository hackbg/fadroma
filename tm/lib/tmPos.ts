import type { Core } from '../deps.ts'
import { Error, Console } from './tmLog.ts'
/** A Namada validator. */
export interface Validator {
  address?: Core.Address, publicKey?: Core.Hash, votingPower: bigint, proposerPriority: bigint
}
