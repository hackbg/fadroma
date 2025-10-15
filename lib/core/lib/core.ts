import { Oops, bold } from '../deps.ts'
import type { Uint128 } from './number.ts'
import type { Impl } from './method.ts';
import { Logger } from './format.ts';
import { Colorful } from './color.ts';
/** A Fadroma error. */
export class Error extends Oops.Error {
  static TODO = (message: unknown) => {
    throw new Error(`TODO: ${message}`)
  }
  constructor (message?: string, args?: object) {
    super(message)
    if (args) Object.assign(this, args)
  }
}
/** An unique string-based identifier. */
export type Id = string|number|bigint
/** Represents a uniquely identifiable entity. */
export type Identified<I extends Id> = { id: I };
/** The name of a deployment unit. Used to generate contract label. */
export type Name = string
/** Human-friendly name. */
export type Named = { name: Name };

export type Entity<I extends Id> = Identified<I> & Partial<Named & Colorful>;
/** Block hash. */
export type Hash = string
/** Represents the backend of a managed chain (such as a devnet). */
export type ChainBackend = Logger<ChainId, Console> & {
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
export type Chain = ChainRef & Context & Api & { connect: (url?: string|URL)=>Connection };
/** Represents an individual remote API endpoint. */
export type Connection = ChainRef & Context & Api & { url?: string|URL }
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
export const chain = (state: Partial<Chain> = {}, api = impl): Chain => {
  const chain = state as unknown as Chain & Api || {}
  if (!chain.id) throw new Error('pass at least { id }')
  chain.live  = true
  chain.chain = () => ({ id: chain.id })
  chain.log ??= new Console(chain.name || chain.id || Console.unknownChain())
  chain.connect ??= (url: string|URL = state?.url!) => connection(chain, api, url)
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
export const connection = <C extends Connection>(chain: Chain, api = impl, url?: string|URL): C => {
  const log = new Console(chain.log.label + ' @ ' + url?.toString())
  const connection = { ...chain, url, log }
  const bind = (name: string, method: (...args: any[])=>any) => [
    name as keyof Api, (...args: any[]) => method(connection, ...args)
  ];
  // The bound API:
  const bound = Object.fromEntries(Object.entries(api).map(([name, method])=>bind(name, method)))
  Object.assign(connection, bound)
  return connection as unknown as C
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
export const fetchHeight = (api: Api): Promise<Height> =>
  api.fetchBlock().then(({height})=>BigInt(height))
export const fetchNextHeight = (api: Api, interval: number = 1000): Promise<bigint> =>
  api.fetchNextBlock(interval).then(({height})=>BigInt(height))
export const fetchNextBlock = (api: Api&Context, interval: number = 1000): Promise<Block> =>
  api.fetchHeight().then(startingHeight => {
    api.log.waitingForNextBlock(startingHeight, interval)
    const t0 = performance.now()
    return new Promise(async (resolve, reject)=>{ try {
      const connection = api
      while (connection.live) {
        const block = await api.fetchBlock()
        if (block.height > startingHeight) {
          const t1 = performance.now()
          api.log.waitingForNextBlock(startingHeight, interval,
            `@${(t1-t0)}ms: ${bold(String(block.height))}, proceeding`)
          return resolve(block)
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
export const impl: Impl<Api, Context & Api> = {
  fetchBlock (_, __) { throw new Error('base fetchBlock is not implemented') },
  fetchNextBlock,
  fetchHeight,
  fetchNextHeight,
}
/** A cryptographic identity. */
export type Signer = { publicKey?: Hash, sign (_: unknown): unknown };
/** Binds an `Signer` to a `Chain`, enabling broadcasting of transactions. */
export type Agent = Signer & AgentApi & Logger<Hash, Console> &
  { chain: () => ChainRef, batch: () => Batch, address: Address, };
export type AgentApi =
  { fetchBalance (): Promise<Record<string, Uint128>> };
