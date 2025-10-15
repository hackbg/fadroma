import type { Chain, Connection, Context, Height, Api, Impl } from '../types.ts';
import { bold } from '../deps.ts';

/** Describe a chain. */
export const chain = (state: Partial<Chain> = {}, api = impl): Chain => {
  const chain = state as unknown as Chain & Api || {}
  if (!chain.id) throw new Error('pass at least { id }')
  chain.live  = true
  chain.chain = () => ({ id: chain.id })
  chain.log ??= new Console(chain.name || chain.id || Console.unknownChain())
  chain.connect ??= (url: string|URL = state?.url!) => connection(chain, api, url)
  const bind = (name: string, method: (...args: any[])=>any) =>
    [name as keyof Api, (...args: any[]) => method(chain.connect(), ...args)]
  // The bound API:
  const bound = Object.entries(api).map(([name, method])=>bind(name, method))
  // Add the bound API methods to the chain object.
  Object.assign(chain, Object.fromEntries(bound))
  return chain
}

/** Describe a connection to a given `chain` by a given `url` */
export const connection = <C extends Connection>(chain: Chain, api = impl, url?: string|URL): C => {
  const log = new Console(chain.log.label + ' @ ' + url?.toString())
  const connection = { ...chain, url, log }
  const bind = (name: string, method: (...args: any[])=>any) =>
    [name as keyof Api, (...args: any[]) => method(connection, ...args)];
  // The bound API:
  const bound = Object.fromEntries(Object.entries(api).map(([name, method])=>bind(name, method)))
  Object.assign(connection, Object.fromEntries(bound))
  return connection as unknown as C
}

export const fetchHeight = (api: Api): Promise<Height> =>
  api.fetchBlock().then(({height})=>BigInt(height));

export const fetchNextHeight = (api: Api, interval: number = 1000): Promise<bigint> =>
  api.fetchNextBlock(interval).then(({height})=>BigInt(height));

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
  });

export const impl: Impl<Api, Context & Api> = {
  fetchBlock (_, __) { throw new Error('base fetchBlock is not implemented') },
  fetchNextBlock,
  fetchHeight,
  fetchNextHeight,
};
