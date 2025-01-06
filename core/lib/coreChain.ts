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
export type Chain = ChainRef & ChainLog & ChainApi & ChainConnect & ChainPoll
/** Reference to chain by id. */
export type ChainRef = { id: ChainId }
/** Chain as log event stream. */
export type ChainLog = ChainRef & LoggingEntity & { log: ChainLogger }
/** Connection provider method. */
export type ChainConnect = { connect: ()=>Connection }
/** Chain polling settings. */
export type ChainPoll = { blockInterval: number, alive: boolean }
/** Chain constructor arguments. */
export type ChainConfig = ChainRef & Partial<ChainLog> & Partial<ChainConnect> & Partial<ChainPoll>
/** Chain API methods. */
export type ChainApi = ChainLog & ChainPoll & {
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
export function chain <C extends Chain, A extends ChainApi> (
  from:    Partial<C> = {},
  methods: Partial<A> = {}
): C & { log: NonNullable<C["log"]> } {
  if (!from.id) throw new Error('pass at least { id }')
  from.log     ??= new ChainLogger(from.name || from.id || ChainLogger.unknownChain())
  from.connect ??= () => connection({ connection: {}, methods: {} })
  from.alive   ??= true
  const chain = from as unknown as (C & A)
  for (const m of Object.keys(methods)) {
    /** This dispatches from a chain's method to the identically named method
      * on the connection returned by `connect()`, enabling  load balancing,
      * parallel querying of multiple endpoints, and other similar strategies
      * to be implemented at the Chain object level (by hooking this logic). */
    chain[m as unknown as keyof A] = ((...args: unknown[]) => {
      if (!chain.connect) throw ChainLogger.noConnections()
      const connection = chain.connect()
      const method = connection[m as unknown as keyof Connection] as (...args: unknown[])=>unknown
      method(...args) }) as unknown as (C & A)[keyof A] }
  return chain
}
export function connection ({ connection, methods }: {
  connection: Partial<Connection>, methods: Record<string, (...args: unknown[])=>unknown>
}): Connection {
  for (const [name, method] of Object.entries(methods)) {
    Object.assign(connection, { [name]: (...args: unknown[]) => method(connection, ...args) })
  }
  return connection as Connection
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
