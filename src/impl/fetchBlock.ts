import type { Chain, Block } from '../API'

/** Implementation of Connection#fetchBlock -> Connection#fetchBlockImpl */
export async function fetchBlock (
  chain: Chain, ...args: Parameters<Chain["fetchBlock"]>
): Promise<Block> {

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
