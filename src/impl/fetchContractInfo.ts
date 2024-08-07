import type { Chain } from '../API'

export async function fetchContractInfo (
  chain: Chain, ...args: Parameters<Chain["fetchContractInfo"]>
) {

  let $C = Contract
  let custom = false
  if (typeof args[0] === 'function') {
    $C = args.shift() as typeof Contract
    custom = true
  }

  if (!args[0]) {
    throw new Error('Invalid arguments')
  }

  const { parallel = false } = (args[1] || {}) as { parallel?: boolean }

  // Fetch single contract
  if (typeof args[0] === 'string') {
    chain.log.debug(`Fetching contract ${args[0]}`)
    const contracts = await timed(function doFetchContractInfo () {
      return chain.getConnection().fetchContractInfoImpl({
        contracts: { [args[0] as unknown as Address]: $C }
      })
    }, function afterFetchContractInfo ({ elapsed }) {
      chain.log.debug(`Fetched in ${bold(elapsed)}: contract ${args[0]}`)
    })
    if (custom) {
      return new $C(contracts[args[0]])
    } else {
      return contracts[args[0]]
    }
  }

  // Fetch array of contracts
  if ((args[0] as any)[Symbol.iterator]) {
    const addresses = args[0] as unknown as Address[]
    chain.log.debug(`Fetching ${addresses.length} contracts`)
    const contracts: Record<Address, typeof $C> = {}
    for (const address of addresses) {
      contracts[address] = $C
    }
    const results = await timed(function doFetchContractInfo () {
      return chain.getConnection().fetchContractInfoImpl({ contracts, parallel })
    }, function afterFetchContractInfo ({ elapsed }) {
      chain.log.debug(`Fetched in ${bold(elapsed)}: ${addresses.length} contracts`)
    })
    if (custom) {
      return addresses.map(address=>new $C(results[address]))
    } else {
      return addresses.map(address=>results[address])
    }
  }

  // Fetch map of contracts with different classes
  if (typeof args[0] === 'object') {
    if (custom) {
      // Can't specify class as first argument
      throw new Error('Invalid arguments')
    }
    const addresses = Object.keys(args[0]) as Address[]
    chain.log.debug(`Querying info about ${addresses.length} contracts`)
    const contracts = await timed(function doFetchcontractInfo () {
      return chain.getConnection().fetchContractInfoImpl({
        contracts: args[0] as { [address: Address]: typeof Contract },
        parallel 
      })
    }, function afterFetchContractInfo ({ elapsed }) {
      chain.log.debug(`Queried in ${bold(elapsed)}: info about ${addresses.length} contracts`)
    })
    const result: Record<Address, unknown> = {}
    for (const address of addresses) {
      result[address] = new args[0][address](contracts[address])
    }
    return result
  }

  throw new Error('Invalid arguments')
}
