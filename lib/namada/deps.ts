export type { Address, Hash, ChainId, Uint128 }
export { decode, u64, u256 } from '@hackbg/borshest'
export { Console, bold } from '@hackbg/logs'
export { Case, base16, base64 } from '@hackbg/4mat'

export * as Core from '@hackbg/fadroma'
import type { Address, Hash, ChainId, Uint128 } from '@hackbg/fadroma'

export * as Tendermint from '@fadroma/tm'
export class BaseConsole { /*FIXME*/ }
export class BaseError extends Error {}
