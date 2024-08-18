export async function fetchBalance ({ api }: ScrtConnection, {
  parallel = false,
  addresses
}: Parameters<Connection["fetchBalanceImpl"]>[0]) {
  const queries = []
  for (const [address, tokens] of Object.entries(addresses)) {
    for (const token of tokens) {
      queries.push(()=>withIntoError(api.query.bank.balance({
        address,
        denom: token
      })).then(response=>({
        address,
        token,
        balance: response.balance
      })))
    }
  }
  const result: Record<Address, Record<string, string>> = {}
  const responses = await optionallyParallel(parallel, queries)
  for (const { address, token, balance } of responses) {
    result[address] ??= {}
    result[address][token] = balance?.amount!
  }
  return result
}

