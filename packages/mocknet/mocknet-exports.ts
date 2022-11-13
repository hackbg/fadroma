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
