import { Core } from '../deps.ts'
import type { Address, Height, Uint128, Method } from '../deps.ts'
import type { Fee } from './tmToken.ts'
export type ChainOptions = {
  bech32Prefix?:   string,
  coinType?:       string,
  hdAccountIndex?: string,
}
/** A Tendermint chain. */
export type Chain = Core.Chain & TendermintApi & ChainOptions
/** A Tendermint connection. */
export type Connection  = Core.Connection & TendermintApi
/** A Tendermint transaction. */
export type Transaction = Core.Transaction
/** A Tendermint block. */
export type Block = Core.Block
/** Describe a Tendermint chain. */
export const chain = (state: Partial<Core.Chain> & ChainOptions, api = impl): Chain =>
  Core.chain(state, api)
/** Tendermint API methods. */
export const api = {
  ...Core.api,
  async fetchAbciInfo(chain: TendermintApi) {},
  async fetchAbciQuery(chain: TendermintApi, path: string, data: Uint8Array, parameters: { height?: Height, prove?: boolean }) {},
  async fetchBlock(chain: TendermintApi, parameters?: { height?: Height }): Promise<Block> { return {} },
  async fetchBlockResults(chain: TendermintApi, parameters: { height?: Height }) {},
  async fetchBlockSearch(chain: TendermintApi, query: string, parameters: { page?: number, perPage?: number, orderBy?: string }) {},
  async fetchBlockchain(chain: TendermintApi, parameters: { min?: Height, max?: Height }) {},
  async fetchCommit(chain: TendermintApi, height: Height) {},
  async fetchGenesis(chain: TendermintApi) {},
  async fetchHealth(chain: TendermintApi) {},
  async fetchNumUnconfirmedTxs(chain: TendermintApi) {},
  async fetchStatus(chain: TendermintApi) {},
  async fetchTx(chain: TendermintApi) {},
  async fetchTxSearch(chain: TendermintApi) {},
  async fetchValidators(chain: TendermintApi) {},
  async subscribe(chain: TendermintApi, subscribeTo: 'block'|'header'|{query: string}) {},
  async broadcastTx(chain: TendermintApi, method:     'sync'|'async'|'commit', tx: Uint8Array) {},
}
/** Describe a Tendermint connection. */
export function connection (chain: Chain, url?: string|URL) {
  return Core.connection(chain, api, url)
}
export interface TendermintApi extends Core.ChainApi {
  fetchAbciInfo:          Core.Method<typeof api["fetchAbciInfo"]>
  fetchAbciQuery:         Core.Method<typeof api["fetchAbciQuery"]>
  fetchBlock:             Core.Method<typeof api["fetchBlock"]>
  fetchBlockResults:      Core.Method<typeof api["fetchBlockResults"]>
  fetchBlockSearch:       Core.Method<typeof api["fetchBlockSearch"]>
  fetchBlockchain:        Core.Method<typeof api["fetchBlockchain"]>
  fetchCommit:            Core.Method<typeof api["fetchCommit"]>
  fetchGenesis:           Core.Method<typeof api["fetchGenesis"]>
  fetchHealth:            Core.Method<typeof api["fetchHealth"]>
  fetchNumUnconfirmedTxs: Core.Method<typeof api["fetchNumUnconfirmedTxs"]>
  fetchStatus:            Core.Method<typeof api["fetchStatus"]>
  fetchTx:                Core.Method<typeof api["fetchTx"]>
  fetchTxSearch:          Core.Method<typeof api["fetchTxSearch"]>
  fetchValidators:        Core.Method<typeof api["fetchValidators"]>
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
