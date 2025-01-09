import { Core, camelize } from '../deps.ts'
import * as Bank from './tmBank.ts'
/** A Tendermint error .*/
export class Error extends Core.Error {}
/** A Tendermint logger .*/
export class Console extends Core.Console {}
/** Chain global configuration pertinent to Tendermint-based chains only. */
export type ChainOptions = {
  bech32Prefix?:   string,
  coinType?:       string,
  hdAccountIndex?: string,
}
/** A Tendermint chain. */
export type Chain       = Core.Chain & Api & ChainOptions
/** A Tendermint connection. */
export type Connection  = Core.Connection & Api & ChainOptions
/** A Tendermint transaction. */
export type Transaction = Core.Transaction
/** A batch of Tendermint transactions. */
export type Batch       = Core.Batch
/** The height of a Tendermint block. */
export type Height      = Core.Height
/** A Tendermint block. */
export type Block       = Core.Block & {
  /** The raw responses from /block and /block_results. */
  readonly responses?: {
    readonly block:    { url: string, response: string }
    readonly results?: { url: string, response: string }
  }
  /** Block header. */
  readonly header?: {
    readonly version:            object
    readonly chainId:            string
    readonly height:             bigint
    readonly time:               string
    readonly lastBlockId:        string
    readonly lastCommitHash:     string
    readonly dataHash:           string
    readonly validatorsHash:     string
    readonly nextValidatorsHash: string
    readonly consensusHash:      string
    readonly appHash:            string
    readonly lastResultsHash:    string
    readonly evidenceHash:       string
    readonly proposerAddress:    string
  }
  /** Transaction in block. */
  readonly transactions: Transaction[]
}
/** The results section of a Tendermint block. */
export type BlockResults = {
  readonly height:                string
  readonly beginBlockEvents:      null|unknown[]
  readonly endBlockEvents:        null|EndBlockEvent[]
  readonly validatorUpdates:      null|unknown[]
  readonly consensusParamUpdates: null|unknown[]
  readonly txsResults:            null|Array<{
    readonly code:       number
    readonly data:       unknown|null
    readonly log:        string
    readonly info:       string
    readonly gas_wanted: string
    readonly gas_used:   string
    readonly events:     unknown[]
    readonly codespace:  string
  }>
}
/** Events that occur at ends of blocks. */
export type EndBlockEvent = {
  readonly type:       string
  readonly attributes: Array<{ key: string, value: string, index: boolean, }>
}
/** Describe a Tendermint chain. */
export const chain = (state: Partial<Core.Chain> & ChainOptions, api = impl): Chain =>
  Core.chain(state, api as any) as Chain
/** Dependencies of Tendermint API methods. */
export type Deps = Core.Deps
/** Methods available for interacting with Tendermint chains. */
export type Api = Core.Api & Core.ToApi<typeof impl>
export const fetchBlock = async (
  api: Deps, options?: { height?: Height, hash?: string, results?: boolean }
): Promise<Block> => {
  const { url } = api || {}
  const { height, hash, results = false } = options || {}
  if (!url) throw new Error("can't fetch block: missing connection URL")
  if (hash) throw new Error("can't fetch block by hash yet")
  if (height && isNaN(Number(height))) throw new Error(`invalid height: ${height}`)
  const [block, blockResults] = await Promise.all([
    fetch(`${url}/block?height=${height??''}`).then(r=>r.json()),
    ...results?[fetchBlockResults(api, { height, hash })]:[]
  ])
  return { ...block, results: blockResults }
}
export const fetchBlockResults = async (
  { url }: Deps, options?: { height?: Height, hash?: string }
): Promise<BlockResults> => {
  const { height, hash } = options || {}
  if (!url) throw new Error("can't fetch block results: missing connection URL")
  if (hash) throw new Error("can't fetch block results by hash yet")
  if (height && isNaN(Number(height))) throw new Error(`invalid height: ${height}`)
  const response = await (await fetch(`${url}/block_results?height=${height??''}`)).json() as {
    error: { data: string },
    result: {
      height:                  string
      txs_results:             unknown[]|null
      begin_block_events:      unknown[]|null
      end_block_events:        unknown[]|null
      validator_updated:       unknown[]|null
      consensus_param_updates: unknown[]|null
    },
  }
  if (response.error) throw new Error(response.error.data)
  return camelize(response.result) as unknown as BlockResults
}

export const fetchAbciInfo  = async (_api: Deps) =>
  { throw new Error('not implemented') }

export const fetchAbciQuery = async (_api: Deps, _path: string, _data: Uint8Array, _parameters: { height?: Height, prove?: boolean }) =>
  { throw new Error('not implemented') }

export const fetchBlockSearch = async (_api: Deps, _query: string, _parameters: { page?: number, perPage?: number, orderBy?: string }) =>
  { throw new Error('not implemented') }

export const fetchBlockchain = async (_api: Deps, _parameters: { min?: Height, max?: Height }) =>
  { throw new Error('not implemented') }

export const fetchCommit = async (_api: Deps, _height: Height) =>
  { throw new Error('not implemented') }

export const fetchGenesis = async (_api: Deps) =>
  { throw new Error('not implemented') }

export const fetchHealth = async (_api: Deps) =>
  { throw new Error('not implemented') }

export const fetchNumUnconfirmedTxs = async (_api: Deps) =>
  { throw new Error('not implemented') }

export const fetchStatus = async (_api: Deps) =>
  { throw new Error('not implemented') }

export const fetchTx = async (_api: Deps) =>
  { throw new Error('not implemented') }

export const fetchTxSearch = async (_api: Deps) =>
  { throw new Error('not implemented') }

export const fetchValidators = async (_api: Deps) =>
  { throw new Error('not implemented') }

export const subscribe = async (_api: Deps, _subscribeTo: 'block'|'header'|{query: string}) =>
  { throw new Error('not implemented') }

export const broadcastTx = async (_api: Deps, _method: 'sync'|'async'|'commit', _tx: Uint8Array) =>
  { throw new Error('not implemented') }

/** Default implementation of Tendermint client API. */
export const impl = {
  ...Core.impl,
  ...Bank,
  fetchBlock,
  fetchBlockResults,
  fetchAbciInfo,
  fetchAbciQuery,
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
