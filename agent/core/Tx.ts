import { Error, Console } from '../util'
import type { IFee, ICoin } from '../index'

/** A transaction message that can be sent to a contract. */
export type Message = string|Record<string, unknown>

/** A transaction hash, uniquely identifying an executed transaction on a chain. */
export type TxHash = string

/** Options for a compute transaction. */
export interface ExecOpts {
  /** The maximum fee. */
  fee?:  IFee
  /** A list of native tokens to send alongside the transaction. */
  send?: ICoin[]
  /** A transaction memo. */
  memo?: string
  /** Allow extra options. */
  [k: string]: unknown
}

/** An address on a chain. */
export type Address = string

/** @returns the address of a thing
  * @throws  LinkNoAddress if missing. */
export function assertAddress ({ address }: { address?: Address|null } = {}): Address {
  if (!address) throw new Error.LinkNoAddress()
  return address
}
