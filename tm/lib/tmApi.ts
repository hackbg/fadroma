import type { Height } from '../deps.ts'
import type { Connection } from './tmTypes.ts'

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
  broadcastTx:       Method<typeof broadcastTx>
  commit:            Method<typeof fetchCommit>
  genesis:           Method<typeof fetchGenesis>
  health:            Method<typeof fetchHealth>
  numUnconfirmedTxs: Method<typeof fetchNumUnconfirmedTxs>
  status:            Method<typeof fetchStatus>

  subscribeNewBlock ():       Promise<void>
  subscribeNewBlockHeader (): Promise<void>
  subscribeTx (options: { query: never }): Promise<void>

  tx          (params: never): Promise<void>
  txSearch    (params: never): Promise<void>
  txSearchAll (params: never): Promise<void>

  validators    (params: never): Promise<void>
  validatorsAll (options: { height: Height }): Promise<void>
}

export async function fetchAbciInfo (
  connection: Connection
) {}

export async function fetchAbciQuery (
  connection: Connection,
  path:       string,
  data:       Uint8Array,
  parameters: { height?: Height, prove?: boolean }
) {}

export async function fetchBlock (
  connection: Connection,
  parameters: { height?: Height }
) {}

export async function fetchBlockResults (
  connection: Connection,
  parameters: { height?: Height }
) {}

export async function fetchBlockSearch (
  connection: Connection,
  query:      string,
  parameters: { page?: number, perPage?: number, orderBy?: string }
) {}

export async function fetchBlockchain (
  connection: Connection,
  parameters: { min?: Height, max?: Height }
) {}

export async function broadcastTx (
  connection: Connection,
  method:     'sync'|'async'|'commit',
  tx:         Uint8Array
) {}

export async function fetchCommit (
  connection: Connection,
  height:     Height
) {}

export async function fetchGenesis (
  connection: Connection
) {}

export async function fetchHealth (
  connection: Connection
) {}

export async function fetchNumUnconfirmedTxs (
  connection: Connection
) {}

export async function fetchStatus (
  connection: Connection
) {}
