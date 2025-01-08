import type { Hash, Entity, LoggingEntity, Method } from './coreEntity.ts'
import type { Agent, Signer } from './coreAgent.ts'
import { CoreLogger } from './coreLogger.ts'
import { bold } from '../deps.ts'
/** Represents the backend of a managed chain (such as a devnet). */
export type ChainBackend = LoggingEntity<ChainId, CoreLogger> & {
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
/** Reference to chain by id. */
export type ChainRef = Entity<ChainId>
/** A chain's full representation. */
export type Chain = ChainRef & Api & { connect: (url?: string|URL)=>Connection };
/** Represents an individual remote API endpoint. */
export type Connection = ChainRef & Api & { url?: string|URL }
/** Chain API methods. */
export type Api = LoggingEntity<ChainId, CoreLogger> & {
  /** Whether the connection is active. */
  live: boolean
  /** Fetch defails about the latest block. */
  fetchBlock (): Promise<Block>
  /** Fetch defails about the block at the given height. */
  fetchBlock ({ height }: { height: Height }): Promise<Block>
  /** Fetch defails about the block with the given hash. */
  fetchBlock ({ hash }: { hash: Hash }): Promise<Block>
  /** Fetch the current block height. */
  fetchHeight (): Promise<Height>
  /** Fetch the block data after the height increments. */
  fetchNextBlock (interval?: number): Promise<Block>
  /** Fetch the block after it increments. */
  fetchNextHeight (interval?: number): Promise<Height>
}
/** Block height. */
export type Height = number|bigint
/** Global unit of event time. Contains zero or more transactions. */
export type Block = Entity<string> & {
  chain: ChainRef, height: Height, header: unknown, transactions: Transaction[]
}
/** A transaction hash, uniquely identifying an executed transaction on a chain. */
export type TxHash = Hash
/** A transaction in a block on a chain. */
export type Transaction = Entity<TxHash> & {
  chain: ChainRef, block: Height, hash: Hash, data: unknown
}
/** A batch of transactions. */
export interface Batch {
  /** Add a transaction to the batch. */
  add (tx: unknown): this
  /** Submit the batch. */
  submit (agent: Agent): Promise<unknown>
}
/** Describe a chain. */
export const chain = (state: Partial<Chain> = {}, api: Api): Chain => {
  const chain = state as unknown as Chain & Api || {}
  if (!chain.id) throw new Error('pass at least { id }')
  chain.live = true
  chain.log ??= new CoreLogger(chain.name || chain.id || CoreLogger.unknownChain())
  chain.connect ??= (url?: string|URL) => connection(chain, api, url)
  const bind = (name: string, method: (...args: unknown[])=>unknown) => [
    name as keyof Api,
    (...args: unknown[]) => method(chain.connect(), ...args)
  ]
  // The bound API:
  const bound = Object.fromEntries(Object.entries(api).map(([name, method])=>bind(name, method)))
  // Add the bound API methods to the chain object.
  Object.assign(chain, bound)
  return chain
}
/** Describe a connection to a given `chain` by a given `url` */
export const connection = (chain: Chain, api: Api, url?: string|URL): Connection => {
  const log = new CoreLogger(chain.log.label + ' @ ' + url?.toString())
  const connection = { ...chain, url, log }
  const bind = (name: string, method: (...args: unknown[])=>unknown) => [
    name as keyof Api, (...args: unknown[]) => method(connection, ...args)
  ];
  // The bound API:
  const bound = Object.fromEntries(Object.entries(api).map(([name, method])=>bind(name, method)))
  Object.assign(connection, bound)
  return connection
}
export const fetchHeight = (chain: Api): Promise<Height> =>
  chain.fetchBlock().then(({ height })=>BigInt(height))
export const fetchNextHeight = (chain: Api, interval: number = 1000): Promise<bigint> =>
  chain.fetchNextBlock(interval).then(({ height })=>BigInt(height))
export const fetchNextBlock = (chain: Api, interval: number = 1000): Promise<bigint> =>
  chain.fetchHeight().then(startingHeight => {
    chain.log.waitingForNextBlock(startingHeight, interval)
    const t0 = performance.now()
    return new Promise(async (resolve, reject)=>{ try {
      const connection = chain
      while (connection.live) {
        const height = await chain.fetchHeight()
        if (height > startingHeight) {
          const t1 = performance.now()
          chain.log.waitingForNextBlock(startingHeight, interval, `@${(t1-t0)}ms: ${bold(String(height))}, proceeding`)
          return resolve(BigInt(height as unknown as number))
        } else {
          await new Promise(ok=>setTimeout(ok, interval))
          const t2 = performance.now()
          chain.log.waitingForNextBlock(startingHeight, interval, `+${(t2-t0)}ms`)
        }
      }
      throw new Error('endpoint dead, not waiting for next block')
    } catch (e) {
      reject(e)
    } })
  })
export const impl = {
  fetchHeight,
  fetchNextHeight,
  fetchNextBlock,
}
