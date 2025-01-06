import type { LoggingEntity } from './coreEntity.ts'
import type { Block, Height } from './coreBlock.ts'
import type { Hash } from './coreHash.ts'
import type { Agent, Signer } from './coreAgent.ts'
import { Console } from '../deps.ts'

/** An address on a chain. */
export type Address = string

/** Represents the backend of a chain managed by this library (such as a devnet). */
export interface ChainBackend extends LoggingEntity {
  chain:    Chain
  gasToken: string

  connect   ():                 Promise<Chain>
  connect   (name: string):     Promise<Agent>
  connect   (identity: Signer): Promise<Agent>
  getSigner (name: string):     Promise<Signer>
}

/** A chain's unique ID. */
export type ChainId = string

/** A chain's second simplest representation. */
export type Chain = { id: ChainId }

/** A chain's log stream. */
export type ChainLog = LoggingEntity & Chain & { log: ChainLogger }

/** A chain's log messages. */
export class ChainLogger extends Console {
  static unknownChains = 0
}

/** A chain connection provider. */
export interface ChainConnect extends ChainLog {
  /** Get a connection from the chain's connection pool. */
  getConnection (): Connection<this>
  /** Connection pool. */
  connections: Connection<this>[]
}

/** A chain's user-facing methods. */
export interface ChainApi {
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

/** Construct a chain from parameters. */
export function chain <C extends Chain> (
  from: ChainConnect & { log?: ChainLogger }
): C {
  if (!from) throw new Error('pass at least { id, connections, getConnection }')
  if (!from.log) from.log = new ChainLogger(
    from.name || from.id || `Unknown chain #${++ChainLogger.unknownChains}`
  )
  return bindChainMethods(from, [])
}

/** This provides dispatch from a chain's method to a connection's identically named methods,
  * enabling load balancing, parallel querying of multiple endpoints, etc. */
function bindChainMethods <C extends Chain> (
  from:    ChainConnect & { log?: ChainLogger },
  methods: Array<keyof C>
): C {
  const chain = from as unknown as C
  for (const m of methods) {
    chain[m] = ((...args: unknown[]) => {
      const connection = from.getConnection()
      const method     = connection[m]
      return method(connection, ...args)
    }) as C[typeof m]
  }
  return chain
}

/** Represents an individual remote API endpoint. */
export interface Connection<C extends Chain> extends LoggingEntity {
  chain: C
  url:   string|URL
  alive: boolean
}

export function connection <C extends Chain> ({ connection, methods }: {
  connection: Partial<Connection<C>>,
  methods:    Record<string, Function>
}) {
  for (const [name, method] of Object.entries(methods)) {
    Object.assign(connection, {
      [name]: (...args: unknown[]) => method(connection, ...args)
    })
  }
  return connection
}
