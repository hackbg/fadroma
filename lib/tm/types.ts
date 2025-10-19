/** Dependencies of Tendermint API methods. */
export type Context = Core.Context
/** Methods available for interacting with Tendermint chains. */
export type Api = Core.Api & Core.ToApi<typeof impl>
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
export type BankApi = { fetchBalance: FetchBalance, send: Send }
export type FetchBalance =
  & ((address: Address, token: string) => Promise<Uint128>)
  & ((address: Address, tokens?: string[]) => Promise<Record<string, Uint128>>)
  & ((addresses: Address[], token: string) => Promise<Record<Address, Uint128>>)
  & ((addresses: Address[], tokens?: string) => Promise<Record<Address, Record<string, Uint128>>>)
export type Send =
  & ((outputs: Record<Address, Record<string, Uint128>>, options?: SendOptions)=>Promise<unknown>)
export type SendOptions = {
  outputs:   Record<Address, Record<string, Uint128>>,
  sendFee?:  Fee,
  sendMemo?: string,
  parallel?: boolean
}
/** A Tendermint governance vote. */
export interface Vote { proposal: ProposalId, voter: Core.Address, power: bigint, value: VoteValue }
/** The value of a Tendermint governance vote. */
export type VoteValue = 'Yay'|'Nay'|'Abstain'
/** The current state of a Tendermint governance proposal. */
export interface Proposal { id: ProposalId, votes: Vote[], result: ProposalResult }
/** The number of a Tendermint governance proposal. */
export type ProposalId = bigint
/** The result of a Tendermint governance proposal. */
export type ProposalResult = 'Pass'|'Fail'

export type * from './deps.ts';
