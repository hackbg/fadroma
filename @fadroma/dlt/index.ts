import type { Id, Identified, Named } from './deps.ts';
/** An address on a chain. */
export type Address = string;
/** A chain's unique ID. */
export type ChainId = string;
/** Reference to chain by id. */
export type ChainRef = Identified<ChainId>;
/** A chain's full representation. */
export type Chain = ChainRef & Context & Api &
  { connect: (url?: string|URL)=>Connection };
/** Represents the backend of a managed chain (such as a devnet). */
export type ChainBackend = Logger<ChainId, Console> & {
  connect   ():                 Promise<Chain>
  connect   (name: string):     Promise<Agent>
  connect   (identity: Signer): Promise<Agent>
  getSigner (name: string):     Promise<Signer>
  /** For providing initial balances. */
  gasToken: string
};
/** Represents an individual remote API endpoint. */
export type Connection = ChainRef & Context & Api & { url?: string|URL };
/** Block height. */
export type Height = number|bigint;
/** Global unit of event time. Contains zero or more transactions. */
export type Block = Identified<string> &
  { chain: ChainRef, height: Height, header: unknown, transactions: Transaction[] };
/** A transaction in a block on a chain. */
export type Transaction = Identified<Hash> & { chain: ChainRef, block: Height, data: unknown };
/** A batch of transactions. */
export interface Batch {
  /** Add a transaction to the batch. */
  add (tx: unknown): this
  /** Submit the batch. */
  submit (agent: Agent): Promise<unknown>
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
/** A cryptographic identity. */
export type Signer = { publicKey?: Hash, sign (_: unknown): unknown };
/** Binds a `Signer` to a `Chain`, enabling broadcasting of transactions. */
export type Agent = Signer & AgentApi & Logger<Hash, Console> &
  { chain: () => ChainRef, batch: () => Batch, address: Address, };
export type AgentApi =
  { fetchBalance (): Promise<Record<string, Uint128>> };
export type Context = unknown;
type ChainApiOptions = { interval?: number, log?: Console }// = 1000, log = api.log ?? logger() }

/** Describe a chain. */
export const chain = (id: string, url: string|URL, {
  live = true,
  name = id || 'chain',
  log  = logger({ name }),
  api  = impl,
}): Chain => bindMethods(api)({
  id, live, name, log, api,
  connect: (to: string|URL = url) => connection(chain, api, to)
});
/** Describe a connection to a given `chain` by a given `url` */
export const connection = <C extends Connection> (
  chain: Chain, api = impl, url?: string|URL
): C => bindMethods(api)({
  ...chain, url, log: logger({ name: `${chain.name}[${url?.toString()||'(disconnected)'}]` })
});
//export const impl: Impl<Api, Context & Api> = {
  //fetchBlock (_, __) { throw new Error('base fetchBlock is not implemented') },
  //fetchNextBlock,
  //fetchHeight,
  //fetchNextHeight,
//};
const fetch = (api: Api, options?: ChainApiOptions) => ({
  height:     () => fetch(api).block().then(({height})=>BigInt(height)),
  nextHeight: () => fetch(api).nextBlock(options?.interval).then(({height})=>BigInt(height)),
  nextBlock:  () => fetch(api).height().then((start: number) => {
    //options?.log?.log.waitingForNextBlock(start, options.interval)
    //const t0 = performance.now()
    return new Promise(async (resolve, reject)=>{ try {
      const connection = api
      while (connection.live) {
        const block = await api.fetchBlock()
        if (block.height > start) {
          //const t1 = performance.now();
          //options?.log?.log.waitingForNextBlock(start, options?.interval,
            //`@${(t1-t0)}ms: ${bold(String(block.height))}, proceeding`)
          return resolve(block)
        } else {
          await new Promise(ok=>setTimeout(ok, options?.interval))
          //const t2 = performance.now();
          //options?.log?.log.waitingForNextBlock(start, options?.interval, `+${(t2-t0)}ms`)
        }
      }
      throw new Error('endpoint dead, not waiting for next block')
    } catch (e) {
      reject(e)
    } })
  }),
});
