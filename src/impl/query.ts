import type { Chain } from '../API'
import { bold, timed } from '../Util'

export async function query (chain: Chain, ...args: Parameters<Chain["query"]>) {

  const [contract, message] = args

  return timed(doQuery, function afterQuery ({ elapsed, result }) {
    chain.log.debug(`Queried in ${bold(elapsed)}s: `, JSON.stringify(result))
  })

  function doQuery () {
    return chain.getConnection().queryImpl({
      ...(typeof contract === 'string') ? { address: contract } : contract,
      message
    })
  }

}
