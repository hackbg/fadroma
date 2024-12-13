import type { Address, Height, Uint128 } from '../deps.ts'
import type * as Tendermint from './tmTypes.ts'

/** Slices first argument of implementation signature
  * (see https://stackoverflow.com/a/67605309) */
type Method<F> = F extends (arg0: never, ...rest: infer R) =>
  infer T ? ((...args: R) => T) : never

export interface Api {
  abciInfo:          Method<typeof fetchAbciInfo>
  abciQuery:         Method<typeof fetchAbciQuery>
  block:             Method<typeof fetchBlock>
  blockResults:      Method<typeof fetchBlockResults>
  blockSearch:       Method<typeof fetchBlockSearch>
  blockchain:        Method<typeof fetchBlockchain>
  commit:            Method<typeof fetchCommit>
  genesis:           Method<typeof fetchGenesis>
  health:            Method<typeof fetchHealth>
  numUnconfirmedTxs: Method<typeof fetchNumUnconfirmedTxs>
  status:            Method<typeof fetchStatus>
  tx:                Method<typeof fetchTx>
  txSearch:          Method<typeof fetchTxSearch>
  validators:        Method<typeof fetchValidators>

  subscribe:         Method<typeof subscribe>
  broadcastTx:       Method<typeof broadcastTx>

  fetchBalance (connection: Tendermint.Connection, address: Address, token: string):
    Promise<Uint128>
  fetchBalance (connection: Tendermint.Connection, address: Address, tokens?: string[]):
    Promise<Record<string, Uint128>>
  fetchBalance (connection: Tendermint.Connection, addresses: Address[], token: string):
    Promise<Record<Address, Uint128>>
  fetchBalance (connection: Tendermint.Connection, addresses: Address[], tokens?: string):
    Promise<Record<Address, Record<string, Uint128>>>
  /** Chain-specific implementation of native token transfer. */
  send (connection: Tendermint.Connection, parameters: {
    outputs:   Record<Address, Record<string, Uint128>>,
    sendFee?:  Token.IFee,
    sendMemo?: string,
    parallel?: boolean
  }): Promise<unknown>
}

export default {
  fetchAbciInfo,
  fetchAbciQuery,
  fetchBlock,
  fetchBlockResults,
  fetchBlockSearch,
  fetchBlockchain,
  fetchCommit,
  fetchGenesis,
  fetchHealth,
  fetchNumUnconfirmedTxs,
  fetchStatus,
  fetchTx,
  fetchTxSearch,
  fetchValidators,

  subscribe,
  broadcastTx,
}

export async function fetchAbciInfo (
  connection: Tendermint.Connection
) {}

export async function fetchAbciQuery (
  connection: Tendermint.Connection,
  path:       string,
  data:       Uint8Array,
  parameters: { height?: Height, prove?: boolean }
) {}

export async function fetchBlock (
  connection: Tendermint.Connection,
  parameters: { height?: Height }
) {}

export async function fetchBlockResults (
  connection: Tendermint.Connection,
  parameters: { height?: Height }
) {}

export async function fetchBlockSearch (
  connection: Tendermint.Connection,
  query:      string,
  parameters: { page?: number, perPage?: number, orderBy?: string }
) {}

export async function fetchBlockchain (
  connection: Tendermint.Connection,
  parameters: { min?: Height, max?: Height }
) {}

export async function fetchCommit (
  connection: Tendermint.Connection,
  height:     Height
) {}

export async function fetchGenesis (
  connection: Tendermint.Connection
) {}

export async function fetchHealth (
  connection: Tendermint.Connection
) {}

export async function fetchNumUnconfirmedTxs (
  connection: Tendermint.Connection
) {}

export async function fetchStatus (
  connection: Tendermint.Connection
) {}

export async function fetchTx (
  connection: Tendermint.Connection,
) {
}

export async function fetchTxSearch (
  connection: Tendermint.Connection,
) {
}

export async function fetchValidators (
  connection: Tendermint.Connection,
) {
}

export async function subscribe (
  connection: Tendermint.Connection,
  subscribeTo: 'block'|'header'|{query: string}
) {}

export async function broadcastTx (
  connection: Tendermint.Connection,
  method:     'sync'|'async'|'commit',
  tx:         Uint8Array
) {}
