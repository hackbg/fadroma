import type { Deps } from './namada.ts'
import { decode, u256 } from '../deps.ts'

export const fetchBalance = async ({ decoder, fetchAbciQuery }: Deps, parameters: {
  addresses: Record<string, string[]>,
}): Promise<Record<string, Record<string, string>>> => {
  const result: Record<string, Record<string, string>> = {}
  for (const [address, tokens] of Object.entries(parameters.addresses)) {
    result[address] = {}
    for (const token of tokens) {
      if (token.split('1')[1]?.length !== 40) {
        throw new Error(`Invalid token address: ${token}`)
      }
      const balanceKey  = decoder.balance_key(token, address)
      const balanceAbci = `/shell/value/${balanceKey}`
      const balance     = await fetchAbciQuery(balanceAbci)
      if (balance.length > 0) {
        result[address][token] = String(decode(u256, balance))
      } else {
        result[address][token] = "0"
      }
    }
  }
  return result
}

