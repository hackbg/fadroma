import type { Chain } from '../API'

export async function query (chain: Chain, ...args: Parameters<Chain["query"]>) {

  const [contract, message] = args

  return timed(function doQuery () {
    return chain.getConnection().queryImpl({
      ...(typeof contract === 'string') ? { address: contract } : contract,
      message
    })
  }, function afterQuery ({ elapsed, result }) {
    chain.log.debug(`Queried in ${bold(elapsed)}s: `, JSON.stringify(result))
  })

}

