/** An address on a chain. */
export type Address = string

/** A chain's unique ID. */
export type ChainId = string

/** A 128-bit integer. */
export type Uint128 = string

/** A 256-bit integer. */
export type Uint256 = string

/** A 128-bit decimal fraction. */
export type Decimal128 = string

/** A 256-bit decimal fraction. */
export type Decimal256 = string

/** A transaction hash, uniquely identifying an executed transaction on a chain. */
export type TxHash = string

/** The name of a deployment unit. Used to generate contract label. */
export type Name = string

/** A contract's full unique on-chain label. */
export type Label = string

/** Block height. */
export type Height = number|bigint

/** Block hash. */
export type Hash = string

/** Represents a uniquely identifiable entity. */
export interface Identity {
  /** Unique identifier. */
  id: string
  /** Human-friendly name. */
  name?: string
  /** Identifying color. */
  color?: unknown
}

/** Represents a chain. */
export interface Chain extends Identity {
  alive?: boolean
}

/** Represents a chain with internal API methods and connection pool. */
export interface ChainBase<C> extends Chain {
  /** Connection pool. */
  connections: C[]
  /** Get a connection from the chain's connection pool. */
  getConnection (): C
}

/** Represents a chain with user-facing API methods over internal API and connection pool. */
export interface ChainApi<C> extends ChainBase<C> {
  /** Fetch defails about the latest block. */
  fetchBlock (): Promise<Block>
  /** Fetch defails about the block at the given height. */
  fetchBlock ({ height }: { height: Height }): Promise<Block>
  /** Fetch defails about the block with the given hash. */
  fetchBlock ({ hash }: { hash: Hash }): Promise<Block>
  /** Fetch the current block height. */
  fetchHeight (): Promise<Height>
  /** Fetch the block data after the height increments. */
  fetchNextBlock (): Promise<Block>
  /** Fetch the block after it increments. */
  fetchNextHeight (): Promise<Block>
}

/** Represents an individual remote API endpoint. */
export interface Connection extends Identity {
  chain: Chain
  url:   string|URL
  alive: boolean
}

/** A cryptographic identity. */
export interface Signer extends Identity {
  publicKey?: Hash
  sign (_: unknown): unknown
}

/** Binds an `Signer` to a `Chain`, enabling broadcasting of transactions. */
export interface Agent extends Signer {
  chain:   Chain
  address: Address
  //fees?:   Token.FeeMap<'send'|'upload'|'init'|'exec'>,

  batch        (): Batch
  fetchBalance (): Promise<Record<string, Uint128>>
}

/** Represents the backend of a chain managed by this library (such as a devnet). */
export interface ChainBackend extends Identity {
  chain:    Chain
  gasToken: string

  connect   ():                 Promise<Chain>
  connect   (name: string):     Promise<Agent>
  connect   (identity: Signer): Promise<Agent>
  getSigner (name: string):     Promise<Signer>
}

/** The building block of a blockchain,
  * containing zero or more transactions. */
export interface Block extends Identity {
  chain:        Chain
  height:       Height
  header:       unknown
  transactions: Transaction[]
}

/** A transaction in a block on a chain. */
export interface Transaction extends Identity {
  chain: Chain,
  block: Height,
  hash:  Hash,
  data:  unknown
}

export interface Batch {
  /** Add a transaction to the batch. */
  add (tx: unknown): this
  /** Submit the batch. */
  submit (agent: Agent): Promise<unknown>
}
