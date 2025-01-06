import type { Hash, LoggingEntity } from './coreEntity.ts'
import type { Block, Height } from './coreBlock.ts'
import type { Agent, Signer } from './coreAgent.ts'
import { Console } from '../deps.ts'
/** Represents the backend of a managed chain (such as a devnet). */
export type ChainBackend = LoggingEntity<ChainId, ChainLogger> & {
  chain:    Chain
  connect   ():                 Promise<Chain>
  connect   (name: string):     Promise<Agent>
  connect   (identity: Signer): Promise<Agent>
  getSigner (name: string):     Promise<Signer>
  /** For providing initial balances. */
  gasToken: string
}
/** An address on a chain. */
export type Address = string
/** A chain's unique ID. */
export type ChainId = string
/** A chain's full representation. */
export type Chain = ChainRef & ChainLog & ChainApi & ChainConnect & ChainPoll
/** Reference to chain by id. */
export type ChainRef = { id: ChainId }
/** Chain as log event stream. */
export type ChainLog = LoggingEntity<ChainId, ChainLogger>
/** Connection provider method. */
export type ChainConnect = { connect: (url?: string|URL)=>Connection }
/** Chain polling settings. */
export type ChainPoll = { blockInterval: number, alive: boolean }
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
  config: Partial<C> = {}, api: A
): C & { log: NonNullable<C["log"]> } {
  const chain = config as unknown as (C & A)
  if (!chain.id) throw new Error('pass at least { id }')
  chain.log     ??= new ChainLogger(chain.name || chain.id || ChainLogger.unknownChain())
  chain.connect ??= (url?: string|URL) => connection(chain as C, api as A, url)
  chain.alive   ??= true
  for (const m of Object.keys(api)) {
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
export function connection <C extends Chain, A extends ChainApi> (
  chain: C,
  api:   A,
  url?:  string|URL
): Connection {
  const c: Partial<Connection> = {
    chain,
    url,
    id: `${chain.id} @ ${url||'not connected'}`,
    log: chain.log,
  }
  for (const [name, method] of Object.entries(api)) {
    c[name as keyof typeof c] = ((...args: unknown[]) =>
      method(connection, ...args)) as unknown as any//typeof c[keyof typeof c]
  }
  return c as Connection
}
