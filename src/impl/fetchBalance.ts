import type { Chain, Address } from '../API'

export async function fetchBalance (chain: Chain, ...args: Parameters<Chain["fetchBalance"]>) {

  const requests: Record<Address, string[]> = {}

  if (args[0] && !(args[0] instanceof Array)) {
    args[0] = [args[0]]
  }

  if (args[0]) {
    for (const address of args[0] as Address[]) {
      requests[address] ??= []
      if (args[1] as any instanceof Array) {
        for (const token of args[1]!) {
          requests[address].push(token)
        }
      } else if (args[1]) {
        requests[address].push(args[1])
      }
    }
  }

  return chain.getConnection().fetchBalanceImpl({
    addresses: requests
  })

}
