import { Core, Case } from '../deps.ts'
import type { Height, Method } from '../deps.ts'
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
  readonly attributes: Array<{
    readonly key:      string
    readonly value:    string
    readonly index:    boolean
  }>
}
/** Describe a Tendermint chain. */
export const chain = (state: Partial<Core.Chain> & ChainOptions, api = impl): Chain =>
  Core.chain(state, api)
/** Describe a Tendermint connection. */
export const connection = (chain: Chain, url?: string|URL) =>
  Core.connection(chain, impl, url)
export type Api = Core.Api & {
  fetchAbciInfo:          Core.Method<typeof impl["fetchAbciInfo"]>
  fetchAbciQuery:         Core.Method<typeof impl["fetchAbciQuery"]>
  fetchBlock:             Core.Method<typeof impl["fetchBlock"]>
  fetchBlockResults:      Core.Method<typeof impl["fetchBlockResults"]>
  fetchBlockSearch:       Core.Method<typeof impl["fetchBlockSearch"]>
  fetchBlockchain:        Core.Method<typeof impl["fetchBlockchain"]>
  fetchCommit:            Core.Method<typeof impl["fetchCommit"]>
  fetchGenesis:           Core.Method<typeof impl["fetchGenesis"]>
  fetchHealth:            Core.Method<typeof impl["fetchHealth"]>
  fetchNumUnconfirmedTxs: Core.Method<typeof impl["fetchNumUnconfirmedTxs"]>
  fetchStatus:            Core.Method<typeof impl["fetchStatus"]>
  fetchTx:                Core.Method<typeof impl["fetchTx"]>
  fetchTxSearch:          Core.Method<typeof impl["fetchTxSearch"]>
  fetchValidators:        Core.Method<typeof impl["fetchValidators"]>
  //subscribe:   Method<typeof subscribe>
  //broadcastTx: Method<typeof broadcastTx>
}
export const fetchBlock = (
  api: Connection, q?: { height: bigint|number }|{ hash: string }
): Promise<Block> => {
  q ||= {} as any
  if ('height' in q!) { return fetchBlockByHeight(api, q) }
  else if ('hash' in q!) { throw new Error('NamadaBlock.fetchByHash: not implemented') }
  else { return fetchBlockByHeight(api, {}) }
}
export const fetchBlockByHeight = async (
  { url, decoder, chain }: Connection,
  { height }: { height?: number|string|bigint, }
): Promise<Block> => {
  if (!url)throw new Error("Can't fetch block: missing connection URL")
  // Fetch block and results as undecoded JSON
  const blockUrl = `${url}/block?height=${height??''}`
  //const resultsUrl = `${url}/block_results?height=${height??''}`
  const [block/*, results*/] = await Promise.all([
    fetch(blockUrl).then(response=>response.text()),
    //fetch(resultsUrl).then(response=>response.text()),
  ])
  return blockFromResponses({
    block: { url: blockUrl, response: block, },
    //results: { url: resultsUrl, response: results, },
  }, { chain, decoder, height })
}
type BlockDecoder = {
  block(response: string, _: null): {
    hash:   Core.Hash,
    header: Block["header"],
    transactions: unknown[]
  }
}
export const blockFromResponses = (
  responses: NonNullable<Block["responses"]>,
  options: { decoder: BlockDecoder, chain?: Chain, height?: string|number|bigint }
): Block => {
  const decoder = options.decoder
  const { chain, height } = options
  const blockResponse = responses.block.response
  const { hash, header, transactions: decodedTransactions } = decoder.block(
    blockResponse, null /*responses.results?.response*/
  ) as {
    hash: string, header: Block["header"], transactions: Array<Partial<Transaction> & {id: string}>
  }
  const c = chain!;
  const h = (height ? BigInt(height) : undefined)!;
  const block: Block = { id: hash, chain: c, header, responses, height: h, transactions: [], }
  const transactions = decodedTransactions.map(tx=>({hash: tx?.id, ...tx, block: height} as Transaction))
  return Object.assign(block, { transactions })
}
export const fetchBlockResults = (
  api: Connection, args?: { height: bigint|number } | { hash: string }
) => {
  if (!args || ('height' in args)) {
    return fetchBlockResultsByHeight(api, args?.height)
  } else if ('hash' in args) {
    throw new Error('fetchBlockResultsByHash: todo')
  } else {
    throw new Error('2nd arg must be { height } or falsy')
  }
}
export const fetchBlockResultsByHeight = async (
  { url }: Connection, height?: bigint|number
): Promise<BlockResults> => {
  const response = await fetch(`${url}/block_results?height=${height??''}`)
  const { error, result } = await response.json() as {
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
  if (error) {
    throw new Error(error.data)
  }
  const returned: Partial<BlockResults> = {}
  for (const [key, value] of Object.entries(result)) {
    Object.assign(returned, { [Case.camel(key) as keyof BlockResults]: value as any })
  }
  return returned as BlockResults
}

/** Tendermint API methods. */
export const impl = {
  ...Core.impl,
  fetchBlock,
  fetchBlockResults,
  async fetchAbciInfo (api: Api) {},
  async fetchAbciQuery (api: Api, path: string, data: Uint8Array, parameters: { height?: Height, prove?: boolean }) {},
  async fetchBlockSearch (api: Api, query: string, parameters: { page?: number, perPage?: number, orderBy?: string }) {},
  async fetchBlockchain (api: Api, parameters: { min?: Height, max?: Height }) {},
  async fetchCommit (api: Api, height: Height) {},
  async fetchGenesis (api: Api) {},
  async fetchHealth (api: Api) {},
  async fetchNumUnconfirmedTxs (api: Api) {},
  async fetchStatus (api: Api) {},
  async fetchTx (api: Api) {},
  async fetchTxSearch (api: Api) {},
  async fetchValidators (api: Api) {},
  async subscribe (api: Api, subscribeTo: 'block'|'header'|{query: string}) {},
  async broadcastTx (api: Api, method:     'sync'|'async'|'commit', tx: Uint8Array) {},
}
