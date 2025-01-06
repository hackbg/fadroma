import type { LoggingEntity } from './coreEntity.ts'
import type { Connection } from './coreConnection.ts'
import type { Block, Height } from './coreBlock.ts'
import type { Hash } from './coreHash.ts'
import type { Agent, Signer } from './coreAgent.ts'

/** A chain's unique ID. */
export type ChainId = string

/** An address on a chain. */
export type Address = string

/** Represents a chain. */
export interface Chain extends LoggingEntity {
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

/** Represents the backend of a chain managed by this library (such as a devnet). */
export interface ChainBackend extends LoggingEntity {
  chain:    Chain
  gasToken: string

  connect   ():                 Promise<Chain>
  connect   (name: string):     Promise<Agent>
  connect   (identity: Signer): Promise<Agent>
  getSigner (name: string):     Promise<Signer>
}

export function makeChain ({ chain, methods }: {
  chain: Partial<Chain> & {
    getConnection (): Connection
    connections?:     Connection[]
  },
  methods: Record<string, Function>
}) {
  for (const [name, method] of Object.entries(methods)) {
    Object.assign(chain, {
      [name]: (...args: unknown[]) => {
        const connection = chain.getConnection()
        const m = connection[name as keyof typeof connection] as typeof method
        m(connection, ...args)
      }
    })
  }
  return chain
}

/** Represents a chain. */
export interface Chain extends LoggingEntity {
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
