import type { Chain, Connection, Context, Api, Impl } from './types.ts';
import { logger, bindMethods } from './deps.ts';

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

type ChainApiOptions = { interval?: number, log?: Console }// = 1000, log = api.log ?? logger() }
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

export * from './types.ts';
