import type { Address, Hash, Uint128, Height, ChainContext, ToApi,
  BaseApi, BaseBatch, BaseBlock, BaseChain, BaseConnection, BaseTransaction,
} from './deps.ts';

/** Dependencies of Tendermint API methods. */
export type Context        = ChainContext;
/** Methods available for interacting with Tendermint chains. */
export type Api            = BaseApi; // & ToApi<typeof impl>;
/** Chain global configuration pertinent to Tendermint-based chains only. */
export type ChainOptions   = { bech32Prefix?:   string
                             , coinType?:       string
                             , hdAccountIndex?: string };
/** A Tendermint chain. */
export type Chain          = BaseChain & Api & ChainOptions;
/** A Tendermint connection. */
export type Connection     = BaseConnection & Api & ChainOptions;
/** A Tendermint transaction. */
export type Transaction    = BaseTransaction;
/** A batch of Tendermint transactions. */
export type Batch          = BaseBatch;

/** A pair of equivalent things. */
export type Pair<T>        = [T, T];
/** Reverse a pair. */
export const reverse       = <T> (pair: Pair<T>): Pair<T> => [pair[1], pair[0]];

/** A Tendermint block. */
export type Block          = { /** Block header. */
                               header?:       BlockHeader
                             , /** Transaction in block. */
                               transactions?: Transaction[]
                             , /** Results of block. */
                               results?:      BlockResults
                             , /** The raw responses from /block and /block_results. */
                               responses?:    BlockResponses } & BaseBlock;

/** The results section of a Tendermint block. */
export type BlockResults   = { height:                string
                             , beginBlockEvents:      null|unknown[]
                             , endBlockEvents:        null|EndBlockEvent[]
                             , validatorUpdates:      null|unknown[]
                             , consensusParamUpdates: null|unknown[]
                             , txsResults:            null|Array<TxResult>
                             , raw?:                  BlockResultsResponse };

/** A Tendermint transaction result. */
export type TxResult       = { code:       number
                             , data:       unknown|null
                             , log:        string
                             , info:       string
                             , gas_wanted: string
                             , gas_used:   string
                             , events:     unknown[]
                             , codespace:  string };

/** Events that occur at ends of blocks. */
export type EndBlockEvent  = { type:       string
                             , attributes: Array<{ key:   string
                                                 , value: string
                                                 , index: boolean, }> };

/** A Tendermint block header. */
export type BlockHeader    = { version:            object
                             , chainId:            string
                             , height:             Height
                             , time:               string
                             , lastBlockId:        string
                             , lastCommitHash:     string
                             , dataHash:           string
                             , validatorsHash:     string
                             , nextValidatorsHash: string
                             , consensusHash:      string
                             , appHash:            string
                             , lastResultsHash:    string
                             , evidenceHash:       string
                             , proposerAddress:    string };

/** The raw responses from /block and /block_results. */
export type BlockResponses = { block?:   JsonRpcResponse
                             , results?: JsonRpcResponse };

/** A valid JSON-RPC v2 response, which may be a result or an error. */
export type JsonRpcResponse<R = unknown> =
                             { jsonrpc: string
                               , id:      number
                               , result?: R
                               , error?:  { data: string } };

/** The parsed response from the /block endpoint. */
export type BlockResponse  = JsonRpcResponse<
                             { block_id: BlockId
                             , block:
                               { header:      BlockHeader
                               , data:        { txs: Transaction[] }
                               , evidence:    { evidence: unknown[] }
                               , last_commit: { height: string
                                              , round: number
                                              , block_id: BlockId
                                              , signatures: unknown[] } } }>;

/** A Tendermint block ID. */
export type BlockId        = { hash: Hash, parts?: { total: number, hash: Hash } };

/** The parsed response from the /block_results endpoint. */
export type BlockResultsResponse = JsonRpcResponse<
                             { height:                  string
                             , txs_results:             unknown[]|null
                             , begin_block_events:      unknown[]|null
                             , end_block_events:        unknown[]|null
                             , validator_updated:       unknown[]|null
                             , consensus_param_updates: unknown[]|null }>;

export type BankApi = { fetchBalance: FetchBalance, send: Send }

/** Represents some amount of native token. */
export type Coin           = { amount: string, denom: string };
/** A gas fee, payable in native tokens. */
export type Fee            = { gas: Uint128, amount: Coin[] };
/** A mapping of transaction type to default fee in one or more tokens. */
export type FeeMap<T extends string> = { [key in T]: Fee };

/** A pair of tokens. */
export type TokenPair      = Pair<Token>;
export type Token          = { id: string };
export type NativeToken    = Token & { denom: string };
export type CustomToken    = Token & { address: Address, codeHash?: string };
export type Fungible       = Token & { fungible: true };
export type NonFungible    = Token & { fungible: false };
export type TokenApi       = { amount: (amount: Uint128) => TokenAmount
                             , fee:    (gas: Uint128)    => Fee };

/** A swap. */
export type Swap           = Pair<SwapSide>;
/** One side of a swap may contain one or more FT amounts or NFTs. */
export type SwapSide       = TokenAmount|NonFungible|Array<(TokenAmount|NonFungible)>;

/** An amount of a fungible token. */
export type TokenAmount    = { token:  Fungible
                             , amount: Uint128
                             , denom:  string|undefined
                             , asCoin: Coin
                             , asNativeBalance: Coin[]
                             , asFee (gas: Uint128): Fee
                             , toString (): string };

export type FetchBalance =
  & ((address: Address, token: string) => Promise<Uint128>)
  & ((address: Address, tokens?: string[]) => Promise<Record<string, Uint128>>)
  & ((addresses: Address[], token: string) => Promise<Record<Address, Uint128>>)
  & ((addresses: Address[], tokens?: string) => Promise<Record<Address, Record<string, Uint128>>>)

export type SendOptions    = { outputs:   Record<Address, Record<string, Uint128>>
                             , sendFee?:  Fee
                             , sendMemo?: string
                             , parallel?: boolean };

export type Send =
  & ((outputs: Record<Address, Record<string, Uint128>>, options?: SendOptions)=>Promise<unknown>)

/** The current state of a Tendermint governance proposal. */
export type Prop           = { id:     PropId
                             , votes:  Vote[]
                             , result: PropResult };
/** The number of a Tendermint governance proposal. */
export type PropId         = bigint;
/** The result of a Tendermint governance proposal. */
export type PropResult     = 'Pass'|'Fail';
/** The value of a Tendermint governance vote. */
export type VoteValue      = 'Yay'|'Nay'|'Abstain';
/** A Tendermint governance vote. */
export type Vote           = { proposal: PropId
                             , voter:    Address
                             , power:    bigint
                             , value:    VoteValue };

export type * from './deps.ts';
