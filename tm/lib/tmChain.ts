import { Core } from '../deps.ts'
import type { Address, Height, Uint128, Method } from '../deps.ts'
import type { Fee } from './tmToken.ts'
export interface TendermintApi extends Core.ChainApi {
  fetchAbciInfo:          Method<typeof impl["fetchAbciInfo"]>
  fetchAbciQuery:         Method<typeof impl["fetchAbciQuery"]>
  fetchBlock:             Method<typeof impl["fetchBlock"]>
  fetchBlockResults:      Method<typeof impl["fetchBlockResults"]>
  fetchBlockSearch:       Method<typeof impl["fetchBlockSearch"]>
  fetchBlockchain:        Method<typeof impl["fetchBlockchain"]>
  fetchCommit:            Method<typeof impl["fetchCommit"]>
  fetchGenesis:           Method<typeof impl["fetchGenesis"]>
  fetchHealth:            Method<typeof impl["fetchHealth"]>
  fetchNumUnconfirmedTxs: Method<typeof impl["fetchNumUnconfirmedTxs"]>
  fetchStatus:            Method<typeof impl["fetchStatus"]>
  fetchTx:                Method<typeof impl["fetchTx"]>
  fetchTxSearch:          Method<typeof impl["fetchTxSearch"]>
  fetchValidators:        Method<typeof impl["fetchValidators"]>
  //subscribe:   Method<typeof subscribe>
  //broadcastTx: Method<typeof broadcastTx>

  fetchBalance (connection: Connection, address: Address, token: string):
    Promise<Uint128>
  fetchBalance (connection: Connection, address: Address, tokens?: string[]):
    Promise<Record<string, Uint128>>
  fetchBalance (connection: Connection, addresses: Address[], token: string):
    Promise<Record<Address, Uint128>>
  fetchBalance (connection: Connection, addresses: Address[], tokens?: string):
    Promise<Record<Address, Record<string, Uint128>>>
  /** Chain-specific implementation of native token transfer. */
  send (connection: Connection, parameters: {
    outputs:   Record<Address, Record<string, Uint128>>,
    sendFee?:  Fee,
    sendMemo?: string,
    parallel?: boolean
  }): Promise<unknown>
}
/** A Tendermint chain. */
export type Chain = Core.Chain & TendermintApi & {
  bech32Prefix?:   string,
  coinType?:       string,
  hdAccountIndex?: string,
}
/** Construct a Tendermint chain. */
export function chain (options: Partial<Core.Chain> & {
  bech32Prefix?:   string,
  coinType?:       string,
  hdAccountIndex?: string,
}, api = impl): Chain {
  const { bech32Prefix, coinType, hdAccountIndex } = options || {}
  const config: Partial<Chain> = { bech32Prefix, coinType, hdAccountIndex };
  const chain = Core.chain(config, api)
  //chain.connect = (url?: string|URL) => connection(chain, impl, url)
  return chain
}
/** A Tendermint connection. */
export type Connection  = Core.Connection & { chain: Chain }
/** A Tendermint transaction. */
export type Transaction = Core.Transaction & { chain: Chain }
/** A Tendermint block. */
export type Block       = Core.Block & { chain: Chain }
//export function connection (chain: Chain, url: string|URL): Connection {
  //return Core.connection(chain, impl, url) as Connection
//}
/** Tendermint API methods. */
export const impl = {
  async fetchAbciInfo(connection: Connection) {},
  async fetchAbciQuery(connection: Connection, path: string, data: Uint8Array, parameters: { height?: Height, prove?: boolean }) {},
  async fetchBlock(connection: Connection, parameters: { height?: Height }) {},
  async fetchBlockResults(connection: Connection, parameters: { height?: Height }) {},
  async fetchBlockSearch(connection: Connection, query: string, parameters: { page?: number, perPage?: number, orderBy?: string }) {},
  async fetchBlockchain(connection: Connection, parameters: { min?: Height, max?: Height }) {},
  async fetchCommit(connection: Connection, height: Height) {},
  async fetchGenesis(connection: Connection) {},
  async fetchHealth(connection: Connection) {},
  async fetchNumUnconfirmedTxs(connection: Connection) {},
  async fetchStatus(connection: Connection) {},
  async fetchTx(connection: Connection) {},
  async fetchTxSearch(connection: Connection) {},
  async fetchValidators(connection: Connection) {},
  async subscribe(connection: Connection, subscribeTo: 'block'|'header'|{query: string}) {},
  async broadcastTx(connection: Connection, method:     'sync'|'async'|'commit', tx: Uint8Array) {},
}
