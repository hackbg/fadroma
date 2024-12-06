import type * as Namada from './namadaTypes.ts'
import { decode, u256 } from '../deps.ts'

export async function fetchBalance (connection: Namada.ConnectionBase, parameters: {
  addresses: Record<string, string[]>,
  parallel?: false
}): Promise<Record<string, Record<string, string>>> {
  if (parameters.parallel) {
    connection.log.warn('Parallel balance fetching on Namada is not supported yet.')
  }
  const result: Record<string, Record<string, string>> = {}
  for (const [address, tokens] of Object.entries(parameters.addresses)) {
    result[address] = {}
    for (const token of tokens) {
      if (token.split('1')[1]?.length !== 40) {
        throw new Error(`Invalid token address: ${token}`)
      }
      const balanceKey  = connection.decode.balance_key(token, address)
      const balanceAbci = `/shell/value/${balanceKey}`
      const balance     = await connection.abciQuery(balanceAbci)
      if (balance.length > 0) {
        result[address][token] = String(decode(u256, balance))
      } else {
        result[address][token] = "0"
      }
    }
  }
  return result
}
