import { Core, base16, base64, camelize } from '../deps.ts'
import { Error, Console } from './tmLog.ts'
import * as Bank from './tmBank.ts'
import { fetchValidators } from './tmPos.ts'
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
/** A Tendermint block ID. */
export type BlockId = { hash: Core.Hash, parts?: { total: number, hash: Core.Hash } }
/** A Tendermint block header. */
export type BlockHeader = {
  readonly version:            object
  readonly chainId:            string
  readonly height:             Height
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
/** A Tendermint block. */
export type Block = Core.Block & {
  /** Block header. */
  readonly header?: BlockHeader
  /** Transaction in block. */
  readonly transactions?: Transaction[]
  /** Results of block. */
  readonly results?: BlockResults
  /** The raw responses from /block and /block_results. */
  readonly responses?: BlockResponses
}
/** The raw responses from /block and /block_results. */
export type BlockResponses = {
  readonly block?:   Core.Response
  readonly results?: Core.Response
}
/** The parsed response from the /block endpoint. */
export type BlockResponse = Core.JsonRpcResponse<{
  readonly block_id: BlockId,
  readonly block: {
    readonly header: BlockHeader,
    readonly data: { readonly txs: Transaction[] },
    readonly evidence: { readonly evidence: unknown[] },
    readonly last_commit: {
      readonly height: string,
      readonly round: number,
      readonly block_id: BlockId,
      readonly signatures: unknown[]
    }
  }
}>
/** The parsed response from the /block_results endpoint. */
export type BlockResultsResponse = Core.JsonRpcResponse<{
  readonly height:                  string
  readonly txs_results:             unknown[]|null
  readonly begin_block_events:      unknown[]|null
  readonly end_block_events:        unknown[]|null
  readonly validator_updated:       unknown[]|null
  readonly consensus_param_updates: unknown[]|null
}>
/** The results section of a Tendermint block. */
export type BlockResults = {
  readonly height:                string
  readonly beginBlockEvents:      null|unknown[]
  readonly endBlockEvents:        null|EndBlockEvent[]
  readonly validatorUpdates:      null|unknown[]
  readonly consensusParamUpdates: null|unknown[]
  readonly txsResults:            null|Array<TxResult>
  readonly raw?: BlockResultsResponse
}
/** A Tendermint transaction result. */
export type TxResult = {
  readonly code:       number
  readonly data:       unknown|null
  readonly log:        string
  readonly info:       string
  readonly gas_wanted: string
  readonly gas_used:   string
  readonly events:     unknown[]
  readonly codespace:  string
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
export type Context = Core.Context
/** Methods available for interacting with Tendermint chains. */
export type Api = Core.Api & Core.ToApi<typeof impl>
/** Fetch a block from a Tendermint chain, optionally with block results. */
export const fetchBlock =
  async (api: Context, options?: { height?: Height, hash?: string, results?: boolean, raw?: boolean }):
    Promise<Block> => {
      const [
        [blockUrl,   [blockText,   block,   blockError  ]],
        [resultsUrl, [resultsText, results, resultsError]]=[undefined, []]
      ] = await Promise.all((options?.results)
        ?[fetchAndTryToParseBlockResponse(api, options), fetchAndTryToParseResultsResponse(api, options)]
        :[fetchAndTryToParseBlockResponse(api, options)])
      if (blockError) {
        api.log.error('failed to decode block:', blockError)
        if (!options?.raw) throw new Error('failed to decode block', { reason: blockError })
      }
      if ('error' in block!) {
        api.log.error('block error:', blockError)
        if (!options?.raw) throw new Error('fetched block error', { reason: block.error })
      }
      if (options?.results) {
        if (resultsError) {
          api.log.error('failed to decode block results:', resultsError)
          if (!options?.raw) throw new Error('failed to decode block results', { reason: resultsError })
        }
        if ('error' in results!) {
          api.log.error('results error:', resultsError)
          if (!options?.raw) throw new Error('fetched results error', { reason: results.error })
        }
      }
      return {
        chain:        api.chain(),
        id:           block!.result!.block_id.hash,
        height:       block!.result!.block.header.height,
        header:       block!.result!.block.header,
        transactions: block!.result!.block.data.txs,
        results:      options?.results ? camelize(results!.result!) : undefined,
        responses:    options?.raw     ? {
          block:   { url: blockUrl,   data: blockText   },
          results: { url: resultsUrl, data: resultsText },
        } : undefined
      } as Block
    }
const fetchAndTryToParseBlockResponse =
  async (api: Context, options?: { height?: Height, hash?: string }):
    Promise<[string, Core.TryToParse<string, BlockResponse>]> => {
      if (!api.url) throw new Error("missing connection URL: can't fetch block")
      const { height, hash } = options || {}
      if (hash) throw new Error("can't fetch block by hash yet")
      if (height && isNaN(Number(height))) throw new Error(`invalid height requested: ${height}`)
      const url = `${api.url}/block?height=${height??''}`
      const response = await fetch(url).then(r=>r.text())
      return [url, Core.tryToParse(response)]
    }
/** Fetch just the results of a Tendermint block. */
export const fetchBlockResults =
  async (api: Context, options?: { height?: Height, raw?: boolean }):
    Promise<BlockResults> => {
      const [_, [resultsText, results, resultsError]] =
        await fetchAndTryToParseResultsResponse(api, options)
      if (resultsError) {
        api.log.error('failed to decode block results:', resultsError)
        if (!options?.raw) throw new Error('failed to decode block results', { reason: resultsError })
      }
      if ('error' in results!) {
        api.log.error('results error:', resultsError)
        if (!options?.raw) throw new Error('results error', { reason: results.error })
      }
      return Object.assign(camelize(results!.result!) as unknown as BlockResults, {
        raw: options?.raw ? resultsText : undefined
      })
    }
const fetchAndTryToParseResultsResponse =
  async (api: Context, options?: { height?: Height }):
    Promise<[string, Core.TryToParse<string, BlockResultsResponse>]> => {
      if (!api.url) throw new Error("missing connection URL: can't fetch block results")
      const { height } = options || {}
      const url = `${api.url}/block_results?height=${height??''}`
      const response = await fetch(url).then(r=>r.text())
      return [url, Core.tryToParse(response)]
    }
export const fetchAbciInfo  = async (_api: Context) =>
  Error.TODO('fetchAbciInfo')
export const fetchAbciQuery = async (api: Context, path: string, options?: {
  data?: Uint8Array, height?: Height, prove?: boolean
}): Promise<{
  readonly key:       Uint8Array|null
  readonly value:     Uint8Array|null
  readonly codespace: string
  readonly info:      string
  readonly proof?:    Array<{ type: string, key: Uint8Array, data: Uint8Array }>
  readonly height?:   number
  readonly index?:    number
  readonly code?:     number // non-falsy for errors
  readonly log?:      string
}> => {
  if (!api.url) throw new Error('fetchAbciQuery: no api url')
  if (!path) throw new Error('fetchAbciQuery: no path')
  const data     = options?.data || new Uint8Array()
  const params   = {path, data: base16.encode(data), prove: options?.prove ?? false, height: options?.height}
  const message  = {jsonrpc: '2.0', id: Console.randomId(), method: 'abci_query', params}
  const headers  = {'Content-Type': 'application/json'}
  const body     = JSON.stringify(message)
  api.log.debug('fetchAbciQuery:', body)
  const request  = await fetch(api.url, {method: 'POST', body, headers})
  const json     = await request.json()
  const { result: { response }, error } = json
  if (error) {
    api.log.error('fetchAbciQuery error:', error)
    throw new Error('fetchAbciQueryError', { error })
  }
  if (typeof response.key   === 'string') response.key   = base64.decode(response.key)
  if (typeof response.value === 'string') response.value = base64.decode(response.value)
  return response
}
export const fetchBlockSearch = async (_api: Context, _query: string, _parameters: { page?: number, perPage?: number, orderBy?: string }) =>
  Error.TODO('fetchBlockSearch')
export const fetchBlockchain = async (_api: Context, _parameters: { min?: Height, max?: Height }) =>
  Error.TODO('fetchBlockchain')
export const fetchCommit = async (_api: Context, _height: Height) =>
  Error.TODO('fetchCommit')
export const fetchGenesis = async (_api: Context) =>
  Error.TODO('fetchGenesis')
export const fetchHealth = async (_api: Context) =>
  Error.TODO('fetchHealth')
export const fetchNumUnconfirmedTxs = async (_api: Context) =>
  Error.TODO('fetchNumUnconfirmedTxs')
export const fetchStatus = async (_api: Context) =>
  Error.TODO('fetchStatus')
export const fetchTx = async (_api: Context) =>
  Error.TODO('fetchTx')
export const fetchTxSearch = async (_api: Context) =>
  Error.TODO('fetchTxSearch')
export const subscribe = async (_api: Context, _subscribeTo: 'block'|'header'|{query: string}) =>
  Error.TODO('subscribe')
export const broadcastTx = async (_api: Context, _method: 'sync'|'async'|'commit', _tx: Uint8Array) =>
  Error.TODO('broadcastTx')

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
