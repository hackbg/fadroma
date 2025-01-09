import type { Uint128 } from './coreNumber.ts'
import { Oops, Logs, bold, randomColor } from '../deps.ts'
/** A Fadroma error. */
export class Error extends Oops.Error {}
/** A Fadroma logger. */
export class Console extends Logs.Console {
  static unknownChains = 0
  static unknownChain  = () => `Unknown chain #${++this.unknownChains}`
  static noConnections = () => new Error('no connections')
  fetchingBlockByHeight = (h: unknown, ...args: unknown[]) =>
    this.debug(`fetching block by height ${h}`, ...args)
  fetchingBlockByHash = (h: unknown, ...args: unknown[]) =>
    this.debug(`fetching block by hash ${h}`, ...args)
  waitingForNextBlock = (h: unknown, t: unknown, ...args: unknown[]) =>
    this.debug(`checking for block >${h} every ${t}ms`, ...args)
}
/** An unique string-based identifier. */
export type Id = string|number|bigint
/** A color. */
export type Color = unknown;
/** The name of a deployment unit. Used to generate contract label. */
export type Name = string
/** Represents a uniquely identifiable entity. */
export interface Entity<I extends Id> {
  /** Unique identifier. */
  id:     I
  /** Human-friendly name. */
  name?:  Name
  /** Identifying color. */
  color?: Color
}
export function assignColor <I extends Id> (identity: Entity<I>): Entity<I> & { color: unknown } {
  identity.color = randomColor({ luminosity: 'dark', seed: String(identity.id) })
  return identity as Entity<I> & { color: unknown }
}
export interface LoggingEntity<I extends Id, L extends Console> extends Entity<I> {
  log: L
}
/** Block hash. */
export type Hash = string
/** Slices first argument of implementation signature
  * (see https://stackoverflow.com/a/67605309) */
export type Method<F> = F extends (arg0: never, ...rest: infer R) =>
  infer T ? ((...args: R) => T) : never
/** Represents the backend of a managed chain (such as a devnet). */
export type ChainBackend = LoggingEntity<ChainId, Console> & {
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
export type Chain = ChainRef & ApiDeps & Api & { connect: (url?: string|URL)=>Connection };
/** Represents an individual remote API endpoint. */
export type Connection = ChainRef & ApiDeps & Api & { url?: string|URL }
/** Dependencies of chain API methods. */
export type ApiDeps = LoggingEntity<ChainId, Console> & {
  /** Whether the connection is active. */
  live: boolean
}
/** Chain API methods. */
export type Api = {
  /** Fetch defails about a block. */
  fetchBlock (options?: { height?: Height, hash?: Hash, results?: boolean }): Promise<Block>
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
  chain.log ??= new Console(chain.name || chain.id || Console.unknownChain())
  chain.connect ??= (url?: string|URL) => connection(chain, api, url)
  const bind = (name: string, method: (...args: any[])=>any) => [
    name as keyof Api, (...args: any[]) => method(chain.connect(), ...args)
  ]
  // The bound API:
  const bound = Object.fromEntries(Object.entries(api).map(([name, method])=>bind(name, method)))
  // Add the bound API methods to the chain object.
  Object.assign(chain, bound)
  return chain
}
/** Describe a connection to a given `chain` by a given `url` */
export const connection = (chain: Chain, api: Api, url?:  string|URL): Connection => {
  const log = new Console(chain.log.label + ' @ ' + url?.toString())
  const connection = { ...chain, url, log }
  const bind = (name: string, method: (...args: any[])=>any) => [
    name as keyof Api, (...args: any[]) => method(connection, ...args)
  ];
  // The bound API:
  const bound = Object.fromEntries(Object.entries(api).map(([name, method])=>bind(name, method)))
  Object.assign(connection, bound)
  return connection
}
export const fetchHeight = (api: Api): Promise<Height> =>
  api.fetchBlock().then(({ height })=>BigInt(height))
export const fetchNextHeight = (api: Api, interval: number = 1000): Promise<bigint> =>
  api.fetchNextBlock(interval).then(({ height })=>BigInt(height))
export const fetchNextBlock = (api: ApiDeps&Api, interval: number = 1000): Promise<bigint> =>
  api.fetchHeight().then(startingHeight => {
    api.log.waitingForNextBlock(startingHeight, interval)
    const t0 = performance.now()
    return new Promise(async (resolve, reject)=>{ try {
      const connection = api
      while (connection.live) {
        const height = await api.fetchHeight()
        if (height > startingHeight) {
          const t1 = performance.now()
          api.log.waitingForNextBlock(startingHeight, interval, `@${(t1-t0)}ms: ${bold(String(height))}, proceeding`)
          return resolve(BigInt(height as unknown as number))
        } else {
          await new Promise(ok=>setTimeout(ok, interval))
          const t2 = performance.now()
          api.log.waitingForNextBlock(startingHeight, interval, `+${(t2-t0)}ms`)
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
/** A cryptographic identity. */
export type Signer = {
  publicKey?: Hash, sign (_: unknown): unknown
}
/** Binds an `Signer` to a `Chain`, enabling broadcasting of transactions. */
export type Agent = Signer & AgentApi & LoggingEntity<Hash, Console> & {
  chain: Chain,
  address: Address,
  batch(): Batch
}
export type AgentApi = {
  fetchBalance (): Promise<Record<string, Uint128>>
}
