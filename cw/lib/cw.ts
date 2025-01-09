import type { Tendermint } from '../deps.ts'
/** A code ID, identifying uploaded code on a chain. */
export type CodeId = string|number
/** The hash of a contract's code. */
export type CodeHash = string
/** A contract's full unique on-chain label. */
export type Label = string
/** A transaction message that can be sent to a contract. */
export type Message = string|number|boolean|Record<string, unknown>
/** Available CosmWasm API methods. */
export type Api = Tendermint.Api
