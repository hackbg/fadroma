/** 128-bit integer. */
export type Uint128 = number|string|bigint

/** 256-bit integer. */
export type Uint256 = number|string|bigint

/** 128-bit decimal fraction. */
export type Decimal128 = number|string

/** 256-bit decimal fraction. */
export type Decimal256 = number|string

export type Write  = { write (...data: unknown[]): unknown };

export type Logger<I extends Id, L extends Console> = Identified<I> & { log: L };

export type Stringy = string|{toString():string}

/** Slices first argument of implementation signature
  * (see https://stackoverflow.com/a/67605309) */
export type Method<F> = F extends (arg0: never, ...rest: infer R) =>
  infer T ? ((...args: R) => T) : never;

/** Slice off the 1st arg of every function */
export type ToApi<I> = {
  [k in keyof I]: I[k] extends (...args: infer R) => infer T
    ? Method<I[k]>
    : I[k]
};

/** Type of chain API implementation. */
export type Impl<A extends Api, D extends Context> = {
  [k in keyof A]: A[k] extends (...args: infer R) => infer T
    ? ((deps: D, ...args: R) => T)
    : never
};

export type Id = string|number|bigint
export type Identified<I extends Id> = { id: I };

export type Name   = string
export type Named  = { name: Name };

export type Hash   = string;
export type Hashed = { hash: Hash };

/** A color. TODO specify representation */
export type Color = unknown;

/** A thing identifiable by color. */
export type Colorful = {
  /** The identifying color. */
  color: Color
};

export type Info = { summary (): string, details (): string };

export type Entity<I extends Id> = Identified<I> & Partial<Named & Colorful>;

/** Represents the backend of a managed chain (such as a devnet). */
export type ChainBackend = Logger<ChainId, Console> & {
  connect   ():                 Promise<Chain>
  connect   (name: string):     Promise<Agent>
  connect   (identity: Signer): Promise<Agent>
  getSigner (name: string):     Promise<Signer>
  /** For providing initial balances. */
  gasToken: string
};

/** An address on a chain. */
export type Address = string;

/** A chain's unique ID. */
export type ChainId = string;

/** Reference to chain by id. */
export type ChainRef = Entity<ChainId>;

/** A chain's full representation. */
export type Chain = ChainRef & Context & Api &
  { connect: (url?: string|URL)=>Connection };

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

export type TaskStep<T> = (()=>T)|(()=>Promise<T>);

/** A raw response from an endpoint. */
export type Response = {
  /** The query that was made. */
  url?:       string,
  /** The data that was returned, which may be invalid (e.g. a 502) */
  data?:      string
  /** The moment the query was made. */
  timestamp?: string,
};

/** A valid JSON-RPC v2 response, which may be a result or an error. */
export type JsonRpcResponse<R> = {
  jsonrpc: string, id: number, result?: R, error?: { data: string }
};

/** A parse that may fail but the source and error must still be preserved. */
export type TryToParse<T, U> =
  | [T, U,         undefined]
  | [T, undefined, unknown];
