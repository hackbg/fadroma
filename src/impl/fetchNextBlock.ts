import type { Chain } from '../API'

/** Implementation of Chain#fetchNextBlock -> Connection#fetchNextBlockImpl */
export async function fetchNextBlock (chain: Chain): Promise<bigint> {

  return chain.fetchHeight().then(async startingHeight=>{
    startingHeight = BigInt(startingHeight)
    chain.log.log(
      `Waiting for block > ${bold(String(startingHeight))}`,
      `(polling every ${chain.blockInterval}ms)`
    )
    const t = + new Date()
    return new Promise(async (resolve, reject)=>{
      try {
        while (chain.getConnection().alive) {
          await new Promise(ok=>setTimeout(ok, chain.blockInterval))
          chain.log(
            `Waiting for block > ${bold(String(startingHeight))} ` +
            `(${((+ new Date() - t)/1000).toFixed(3)}s elapsed)`
          )
          const height = await chain.fetchHeight()
          if (height > startingHeight) {
            chain.log.log(`Block height incremented to ${bold(String(height))}, proceeding`)
            return resolve(BigInt(height as unknown as number))
          }
        }
        throw new Error('endpoint dead, not waiting for next block')
      } catch (e) {
        reject(e)
      }
    })
  })

}

