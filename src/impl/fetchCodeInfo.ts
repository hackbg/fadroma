import type { Chain, CodeId } from '../API'
import { bold, timed } from '../Util'

export async function fetchCodeInfo (
  chain: Chain, ...args: Parameters<Chain["fetchCodeInfo"]>|[]
) {
  const connection = chain.getConnection()
  if (args.length === 0) {
    chain.log.debug('Querying all codes...')
    return timed(
      connection.fetchCodeInfoImpl.bind(connection),
      ({ elapsed, result }) => chain.log.debug(
        `Queried in ${bold(elapsed)}: all codes`
      ))
  }
  if (args.length === 1) {
    if (args[0] instanceof Array) {
      const codeIds = args[0] as Array<CodeId>
      const { parallel } = args[1] as { parallel?: boolean }
      chain.log.debug(`Querying info about ${codeIds.length} code IDs...`)
      return timed(
        connection.fetchCodeInfoImpl.bind(connection, { codeIds, parallel }),
        ({ elapsed, result }) => chain.log.debug(
          `Queried in ${bold(elapsed)}: info about ${codeIds.length} code IDs`
        ))
    } else {
      const codeIds = [args[0] as CodeId]
      const { parallel } = args[1] as { parallel?: boolean }
      chain.log.debug(`Querying info about code id ${args[0]}...`)
      return timed(
        connection.fetchCodeInfoImpl.bind(connection, { codeIds, parallel }),
        ({ elapsed }) => chain.log.debug(
          `Queried in ${bold(elapsed)}: info about code id ${codeIds[0]}`
        ))
    }
  } else {
    throw new Error('fetchCodeInfo takes 0 or 1 arguments')
  }
}

