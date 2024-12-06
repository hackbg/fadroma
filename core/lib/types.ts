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

/** A transaction message that can be sent to a contract. */
export type Message = string|Record<string, unknown>

/** A transaction hash, uniquely identifying an executed transaction on a chain. */
export type TxHash = string

/** A code ID, identifying uploaded code on a chain. */
export type CodeId = string

/** The hash of a contract's code. */
export type CodeHash = string

/** The name of a deployment unit. Used to generate contract label. */
export type Name = string

/** A contract's full unique on-chain label. */
export type Label = string

export type Height = number|bigint

export type Hash = string

export interface Identity {
  name?:      string
  publicKey?: Hash
}

export interface Agent extends Identity {
  chain:   Chain
  address: Address
}

export interface Chain {
  id: string
}

export interface ChainApi extends Chain {
  fetchHeight (): Promise<Height>
  fetchNextBlock (): Promise<Height>
  fetchBlock (): Promise<Block>
  fetchBlock ({ height }: { height: Height, raw?: boolean }): Promise<Block>
  fetchBlock ({ hash }: { hash: Hash, raw?: boolean }): Promise<Block>
}

export interface ChainBackend {
  id: string
  gasToken: string
}

export interface Block {
  id:     Hash
  height: Height
}

export interface Transaction {
  id:    Hash
  block: Height
}

export interface Connection {
  chain: Chain
  url:   string|URL
  alive: boolean
}

export interface SigningConnection {
  chain: Chain
  identity: Identity
}

export interface Batch {
}
