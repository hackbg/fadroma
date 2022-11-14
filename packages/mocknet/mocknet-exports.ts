import { MocknetError } from './mocknet-events'
import type { Address, CodeHash, ChainId } from '@fadroma/core'
import type { Ptr, IOExports } from './mocknet-data'

export interface ContractExports_Base extends IOExports {
  query (msg: Ptr): Ptr
}

/** A CW0.10 contract's raw API methods. */
export interface ContractExports_CW0 extends ContractExports_Base {
  init   (env: Ptr, msg: Ptr): Ptr
  handle (env: Ptr, msg: Ptr): Ptr
}

/** A CW1.0 contract's raw API methods. */
export interface ContractExports_CW1 extends ContractExports_Base {
  instantiate      (env: Ptr, info: Ptr, msg: Ptr): Ptr
  execute          (env: Ptr, info: Ptr, msg: Ptr): Ptr
  requires_staking ():                              Ptr
}

/** A contract's raw API methods. */
export type ContractExports = ContractExports_CW0 | ContractExports_CW1

function makeContext_Base (now: number = + new Date()) {
  const height = Math.floor(now/5000)
  const time = String(Math.floor(now/1000))
  const sent_funds: any[] = []
  return { height, time, sent_funds }
}

/** Create the Env context parameter for a CW0 contract. */
export function makeContext_CW0 (
  chain_id:  ChainId,
  sender:    Address,
  address?:  Address,
  codeHash?: CodeHash|undefined,
  now:       number = + new Date()
): [unknown] {
  if (!address) throw new MocknetError.ContextNoAddress()
  const { height, time, sent_funds } = makeContext_Base()
  const env  = { block: { height, time, chain_id }, transaction: { index: 0 }, contract: { address } }
  const info = { sender, funds: [] }
  return [{
    block:    { height, time, chain_id },
    message:  { sender, sent_funds },
    contract: { address },
    contract_key: "",
    contract_code_hash: codeHash
  }]
}

/** Create the Env and Info context parameters for a CW1 contract. */
export function makeContext_CW1 (
  chain_id:  ChainId,
  sender:    Address,
  address?:  Address,
  codeHash?: CodeHash|undefined,
  now:       number = + new Date()
): [unknown, unknown] {
  if (!address) throw new MocknetError.ContextNoAddress()
  const { height, time, sent_funds } = makeContext_Base()
  const env  = { block: { height, time, chain_id }, transaction: { index: 0 }, contract: { address } }
  const info = { sender, funds: [] }
  return [env, info]
}
