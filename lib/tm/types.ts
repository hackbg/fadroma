import type {
  Address, Hash, Uint128, Height,
  Context     as BaseContext,
  Connection  as BaseConnection,
  Chain       as BaseChain,
  Api         as BaseApi,
  Transaction as BaseTransaction,
  Batch       as BaseBatch,
} from './deps.ts';
export type { Address, Hash, Uint128, Height } from './deps.ts';
/** A valid JSON-RPC v2 response, which may be a result or an error. */
export type JsonRpcResponse<R> = { jsonrpc: string, id: number, result?: R, error?: { data: string } };
/** A pair of equivalent things. */
export type Pair<T> = [T, T];
/** Reverse a pair. */
export const reverse = <T> (pair: Pair<T>): Pair<T> => [pair[1], pair[0]];
/** A pair of tokens. */
export type TokenPair = Pair<Token>;
/** A swap. */
export type Swap = Pair<SwapSide>;
/** One side of a swap may contain one or more FT amounts or NFTs. */
export type SwapSide = TokenAmount|NonFungible|Array<(TokenAmount|NonFungible)>;
/** Dependencies of Tendermint API methods. */
export type Context = BaseContext;
/** Methods available for interacting with Tendermint chains. */
export type Api = BaseApi & BaseToApi<typeof impl>;
/** Chain global configuration pertinent to Tendermint-based chains only. */
export type ChainOptions = { bech32Prefix?: string, coinType?: string, hdAccountIndex?: string, };
/** A Tendermint chain. */
export type Chain       = BaseChain & Api & ChainOptions;
/** A Tendermint connection. */
export type Connection  = BaseConnection & Api & ChainOptions;
/** A Tendermint transaction. */
export type Transaction = BaseTransaction;
/** A batch of Tendermint transactions. */
export type Batch       = BaseBatch;
/** A Tendermint governance vote. */
export interface Vote { proposal: ProposalId, voter: Address, power: bigint, value: VoteValue };
/** The value of a Tendermint governance vote. */
export type VoteValue = 'Yay'|'Nay'|'Abstain';
/** The current state of a Tendermint governance proposal. */
export type Proposal = { id: ProposalId, votes: Vote[], result: ProposalResult };
/** The number of a Tendermint governance proposal. */
export type ProposalId = bigint;
/** The result of a Tendermint governance proposal. */
export type ProposalResult = 'Pass'|'Fail';
/** Represents some amount of native token. */
export type Coin = { readonly amount: string, readonly denom: string };
/** A gas fee, payable in native tokens. */
export type Fee = { readonly gas: Uint128, readonly amount: Coin[] };
/** A mapping of transaction type to default fee in one or more tokens. */
export type FeeMap<T extends string> = { [key in T]: Fee };

export type Token = { readonly id: string };

export type NativeToken = Token & { denom: string }

export type CustomToken = Token & { address: Address, codeHash?: string }

export type Fungible    = Token & { fungible: true }

export type NonFungible = Token & { fungible: false }

export type TokenApi = { amount: (amount: Uint128) => TokenAmount, fee: (gas: Uint128) => Fee }
/** An amount of a fungible token. */
export type TokenAmount = {
  readonly amount: Uint128,
  readonly token:  Fungible,
  readonly denom: string|undefined
  readonly asNativeBalance: Coin[]
  readonly asCoin: Coin
  asFee (gas: Uint128): Fee
  toString (): string
}
/** A Tendermint block ID. */
export type BlockId = { hash: Hash, parts?: { total: number, hash: Hash } }
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
export type Block = BaseBlock & {
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
  readonly block?:   BaseResponse
  readonly results?: BaseResponse
}
/** The parsed response from the /block endpoint. */
export type BlockResponse = JsonRpcResponse<{
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
export type BlockResultsResponse = JsonRpcResponse<{
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
