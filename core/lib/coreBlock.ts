import type { Chain, Block } from './coreTypes.ts'

/** Implementation of Connection#fetchBlock -> Connection#fetchBlockImpl */
export async function fetchBlock (chain: Chain, ...args: Parameters<Chain["fetchBlock"]>):
  Promise<Block>
{
  if (args[0]) {
    if (typeof args[0] === 'object') {
      if ('height' in args[0] && !!args[0].height) {
        chain.log.debug(`Fetching block with height ${args[0].height}`)
        return chain.getConnection().fetchBlockImpl({
          raw:    args[0].raw,
          height: BigInt(args[0].height as number)
        })
      } else if ('hash' in args[0] && !!args[0].hash) {
        chain.log.debug(`Fetching block with hash ${args[0].hash}`)
        return chain.getConnection().fetchBlockImpl({
          raw:  args[0].raw,
          hash: args[0].hash as string,
        })
      }
    } else {
      throw new Error('Invalid arguments, pass {height:number} or {hash:string}')
    }
  }
  chain.log.debug(`Fetching latest block`)
  return chain.getConnection().fetchBlockImpl()
}

export async function fetchNextBlock (chain: Chain):
  Promise<bigint>
{
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

  //[>* Get the current block height. <]
  //fetchHeight (): Promise<bigint> {
    //this.log.debug('Querying block height')
    //return this.getConnection().fetchHeightImpl()
  //}

  //[>* Wait until the block height increments, or until `this.alive` is set to false. <]
  //fetchNextBlock (): Promise<bigint> {
    //this.log.debug('Querying block height')
    //return fetchNextBlock(this)
  //}

  //[>* Get info about the latest block. <]
  //fetchBlock ():
    //Promise<Block>
  //[>* Get info about the block with a specific height. <]
  //fetchBlock ({ height }: { height: number|bigint, raw?: boolean }):
    //Promise<Block>
  //[>* Get info about the block with a specific hash. <]
  //fetchBlock ({ hash }: { hash: string, raw?: boolean }):
    //Promise<Block>
  //fetchBlock (...args: unknown[]): Promise<Block> {
    //return fetchBlock(this, ...args as Parameters<Chain["fetchBlock"]>)
  //}
//
  //[>* Chain-specific implementation of fetchBlock. <]
  //abstract fetchBlockImpl (parameters?:
    //{ raw?: boolean } & ({ height: number|bigint }|{ hash: string })
  //): Promise<Block>
  //[>* Chain-specific implementation of fetchHeight. <]
  //abstract fetchHeightImpl ():
    //Promise<bigint>
  //[>* Chain-specific implementation of fetchBalance. <]
