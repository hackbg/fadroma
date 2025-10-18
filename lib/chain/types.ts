/** An address on a chain. */
export type Address = string;
/** A chain's unique ID. */
export type ChainId = string;
/** Reference to chain by id. */
export type ChainRef = Entity<ChainId>;
/** A chain's full representation. */
export type Chain = ChainRef & Context & Api &
  { connect: (url?: string|URL)=>Connection };
/** Represents the backend of a managed chain (such as a devnet). */
export type ChainBackend = Logger<ChainId, Console> & {
  connect   ():                 Promise<Chain>
  connect   (name: string):     Promise<Agent>
  connect   (identity: Signer): Promise<Agent>
  getSigner (name: string):     Promise<Signer>
  /** For providing initial balances. */
  gasToken: string
};
/** Represents an individual remote API endpoint. */
export type Connection = ChainRef & Context & Api & { url?: string|URL };
/** Block height. */
export type Height = number|bigint;
/** Global unit of event time. Contains zero or more transactions. */
export type Block = Entity<string> &
  { chain: ChainRef, height: Height, header: unknown, transactions: Transaction[] };
/** A transaction in a block on a chain. */
export type Transaction = Entity<Hash> & { chain: ChainRef, block: Height, data: unknown };
/** A batch of transactions. */
export interface Batch {
  /** Add a transaction to the batch. */
  add (tx: unknown): this
  /** Submit the batch. */
  submit (agent: Agent): Promise<unknown>
}
/** Dependencies of chain API methods. */
export type Context = Logger<ChainId, Console> & {
  /** The connection URL. */
  url?: URL|string
  /** Whether the connection is active. */
  live: boolean
  /** Return a descriptior for this chain. */
  chain (): ChainRef
}
/** Chain API methods. */
export type Api = {
  /** Fetch defails about a block. */
  fetchBlock (options?: {
    /** Fetch by height. Otherwise fetches latest. */
    height?:  Height,
    /** Fetch by hash or confirm hash when fetching by height. */
    hash?:    Hash,
    /** Fetch block results, too? */
    results?: boolean
    /** Keep the raw responses? */
    raw?: boolean
  }): Promise<Block>
  /** Fetch the block data after the height increments. */
  fetchNextBlock (interval?: number): Promise<Block>
  /** Fetch the current block height. */
  fetchHeight (): Promise<Height>
  /** Fetch the block after it increments. */
  fetchNextHeight (interval?: number): Promise<Height>
}
/** A cryptographic identity. */
export type Signer = { publicKey?: Hash, sign (_: unknown): unknown };
/** Binds a `Signer` to a `Chain`, enabling broadcasting of transactions. */
export type Agent = Signer & AgentApi & Logger<Hash, Console> &
  { chain: () => ChainRef, batch: () => Batch, address: Address, };
export type AgentApi =
  { fetchBalance (): Promise<Record<string, Uint128>> };

