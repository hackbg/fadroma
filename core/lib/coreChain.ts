import type { LoggingEntity } from './coreEntity.ts'
import type { Block, Height } from './coreBlock.ts'
import type { Hash } from './coreHash.ts'
import type { Agent, Signer } from './coreAgent.ts'
import { Console } from '../deps.ts'
/** An address on a chain. */
export type Address = string
/** A chain's unique ID. */
export type ChainId = string
/** A chain's full representation. */
export type Chain = ChainRef & ChainLog & ChainApi & ChainConnect
/** Reference to chain by id. */
export type ChainRef = { id: ChainId }
/** Chain as log event stream. */
export type ChainLog = ChainRef & LoggingEntity & { log: ChainLogger }
/** Connection provider method. */
export type ChainConnect = { connect: ()=>Connection }
/** Chain constructor arguments. */
export type ChainConfig = ChainRef & Partial<ChainLog> & Partial<ChainConnect>
/** Chain API methods. */
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
/** Represents an individual remote API endpoint. */
export type Connection = ChainApi & { chain: Chain, url: string|URL, alive: boolean }
/** A chain's log and error handler. */
export class ChainLogger extends Console {
  static unknownChains = 0
  static unknownChain  = () => `Unknown chain #${++this.unknownChains}`
  static noConnections = () => new Error('no connections')
}
/** Construct a chain from parameters. */
export function chain <C extends Chain> (from: Partial<C>): C & { log: NonNullable<C["log"]> } {
  if (!from.id || !from.connect) throw new Error('pass at least { id, connect }')
  if (!from.log) from.log = new ChainLogger(from.name || from.id || ChainLogger.unknownChain())
  return bindChainMethods(from as C, [])
}
/** This provides dispatch from a chain's method to a connection's identically named methods,
  * enabling load balancing, parallel querying of multiple endpoints, etc. */
function bindChainMethods <C extends Chain> (from: C, methods: Array<keyof C>): C {
  const chain = from as unknown as (C & ChainApi)
  for (const m of methods) {
    chain[m as unknown as keyof C] = ((...args: any[]) => {
      if (!chain.connect) throw ChainLogger.noConnections()
      const connection = chain.connect()
      const method = connection[m as unknown as keyof Connection] as any
      method(connection, ...args)
    }) as unknown as (C & ChainApi)[keyof ChainApi]
  }
  return chain
}
export function connection ({ connection, methods }: {
  connection: Partial<Connection>,
  methods:    Record<string, Function>
}) {
  for (const [name, method] of Object.entries(methods)) {
    Object.assign(connection, {
      [name]: (...args: unknown[]) => method(connection, ...args)
    })
  }
  return connection
}

/** Represents the backend of a managed chain (such as a devnet). */
export type ChainBackend = LoggingEntity & {
  chain:    Chain
  connect   ():                 Promise<Chain>
  connect   (name: string):     Promise<Agent>
  connect   (identity: Signer): Promise<Agent>
  getSigner (name: string):     Promise<Signer>
  /** For providing initial balances. */
  gasToken: string
}
