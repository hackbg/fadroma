import { Core, Case } from '../deps.ts'
/** A Tendermint error .*/
export class Error extends Core.Error {}
/** A Tendermint logger .*/
export class Console extends Core.Console {}
/** Methods available for interacting with Tendermint chains. */
export type Api = Core.Api & {
  fetchAbciInfo:          Core.Method<typeof impl["fetchAbciInfo"]>
  fetchAbciQuery:         Core.Method<typeof impl["fetchAbciQuery"]>
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
  readonly attributes: Array<{ key: string, value: string, index: boolean, }>
}
/** Describe a Tendermint chain. */
export const chain = (state: Partial<Core.Chain> & ChainOptions, api = impl): Chain =>
  Core.chain(state, api)
export const fetchBlock = async (
  api: Connection, options?: { height?: Height, hash?: string, results?: boolean }
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
  { url }: Connection, options?: { height?: Height, hash?: string }
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
  return camelize(response.result)
}
const camelize = (object: object) => {
  const returned: Partial<BlockResults> = {}
  for (const [key, value] of Object.entries(object)) {
    Object.assign(returned, { [Case.camel(key) as keyof BlockResults]: value as any })
  }
  return returned as BlockResults
}
/** Default implementation of Tendermint client API. */
export const impl = {
  ...Core.impl,
  fetchBlock,
  fetchBlockResults,
  async fetchAbciInfo (_api: Api) {},
  async fetchAbciQuery (_api: Api, _path: string, _data: Uint8Array, _parameters: { height?: Height, prove?: boolean }) {},
  async fetchBlockSearch (_api: Api, _query: string, _parameters: { page?: number, perPage?: number, orderBy?: string }) {},
  async fetchBlockchain (_api: Api, _parameters: { min?: Height, max?: Height }) {},
  async fetchCommit (_api: Api, _height: Height) {},
  async fetchGenesis (_api: Api) {},
  async fetchHealth (_api: Api) {},
  async fetchNumUnconfirmedTxs (_api: Api) {},
  async fetchStatus (_api: Api) {},
  async fetchTx (_api: Api) {},
  async fetchTxSearch (_api: Api) {},
  async fetchValidators (_api: Api) {},
  async subscribe (_api: Api, _subscribeTo: 'block'|'header'|{query: string}) {},
  async broadcastTx (_api: Api, _method: 'sync'|'async'|'commit', _tx: Uint8Array) {},
}
