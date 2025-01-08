import type { Hash, Entity, LoggingEntity } from './coreEntity.ts'
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
export type ChainRef = { id: ChainId }
/** A chain's full representation. */
export type Chain = ChainRef & ChainApi & { connect: (url?: string|URL)=>Connection };
/** Represents an individual remote API endpoint. */
export type Connection = ChainRef & ChainApi & { url?: string|URL }
/** Chain API methods. */
export type ChainApi = LoggingEntity<ChainId, CoreLogger> & {
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
  chain:  ChainRef
  height: Height
  header: unknown
  transactions: Transaction[]
}
/** A transaction hash, uniquely identifying an executed transaction on a chain. */
export type TxHash = Hash
/** A transaction in a block on a chain. */
export type Transaction = Entity<TxHash> & {
  chain: ChainRef,
  block: Height,
  hash:  Hash,
  data:  unknown
}
/** A batch of transactions. */
export interface Batch {
  /** Add a transaction to the batch. */
  add (tx: unknown): this
  /** Submit the batch. */
  submit (agent: Agent): Promise<unknown>
}
/** Describe a chain. */
export const chain = (state: Partial<Chain> = {}, api: ChainApi): Chain => {
  const chain = state as unknown as Chain & ChainApi || {}
  if (!chain.id) throw new Error('pass at least { id }')
  chain.live = true
  chain.log ??= new CoreLogger(chain.name || chain.id || CoreLogger.unknownChain())
  chain.connect ??= (url?: string|URL) => connection(chain, api, url)
  const bind = (name: string, method: (...args: unknown[])=>unknown) => [
    name as keyof ChainApi,
    (...args: unknown[]) => method(chain.connect(), ...args)
  ]
  // The bound API:
  const bound = Object.fromEntries(Object.entries(api).map(([name, method])=>bind(name, method)))
  // Add the bound API methods to the chain object.
  Object.assign(chain, bound)
  return chain
}
/** Describe a connection to a given `chain` by a given `url` */
export const connection = (chain: Chain, api: ChainApi, url?: string|URL): Connection => {
  const connection = {
    ...chain, 
    url,
    log: new CoreLogger(chain.log.label + ' @ ' + url?.toString())
  }
  const bind = (name: string, method: (...args: unknown[])=>unknown) => [
    name as keyof ChainApi,
    (...args: unknown[]) => method(connection, ...args)
  ];
  // The bound API:
  const bound = Object.fromEntries(Object.entries(api).map(([name, method])=>bind(name, method)))
  Object.assign(connection, bound)
  return connection
}
export const fetchHeight = (chain: ChainApi): Promise<Height> =>
  chain.fetchBlock().then(({ height })=>BigInt(height))
export const fetchNextHeight = (chain: ChainApi, interval: number = 1000): Promise<bigint> =>
  chain.fetchNextBlock(interval).then(({ height })=>BigInt(height))
export const fetchNextBlock = (chain: ChainApi, interval: number = 1000): Promise<bigint> =>
  chain.fetchHeight().then(startingHeight => {
    chain.log.waitingForNextBlock(startingHeight, interval)
    const t0 = performance.now()
    return new Promise(async (resolve, reject)=>{
      try {
        const connection = chain
        while (connection.live) {
          const height = await chain.fetchHeight()
          if (height > startingHeight) {
            chain.log.log(`Block height incremented to ${bold(String(height))}, proceeding`)
            return resolve(BigInt(height as unknown as number))
          } else {
            await new Promise(ok=>setTimeout(ok, interval))
            const t1 = performance.now()
            chain.log.waitingForNextBlock(startingHeight, interval, `+${(t1-t0)}ms`)
          }
        }
        throw new Error('endpoint dead, not waiting for next block')
      } catch (e) {
        reject(e)
      }
    })
  })
export const api = {
  fetchHeight,
  fetchNextHeight,
  fetchNextBlock,
}

//export function fetchBlock (chain: ChainApi, ...args: Parameters<Chain["fetchBlock"]>): Promise<Block> {
  //if (args[0]) {
    //if (typeof args[0] === 'object') {
      //if ('height' in args[0] && !!args[0].height) {
        //chain.log.fetchingBlockByHeight(args[0]?.height)
        //return chain.fetchBlock({
          ////raw:    args[0].raw,
          //height: BigInt(args[0].height as number)
        //})
      //} else if ('hash' in args[0] && !!args[0].hash) {
        //chain.log.fetchingBlockByHash(args[0]?.hash)
        //return chain.fetchBlock({
          ////raw:  args[0].raw,
          //hash: args[0].hash as string,
        //})
      //}
    //} else {
      //throw new Error('Invalid arguments, pass {height:number} or {hash:string}')
    //}
  //}
  //chain.log.debug(`Fetching latest block`)
  //return chain.fetchBlock()
//}
