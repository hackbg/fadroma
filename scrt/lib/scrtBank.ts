import { optionallyParallel } from '../deps.ts'
import type { Address, Coin, Fee } from '../deps.ts'
import type { Deps, AgentDeps } from './scrt.ts'

export async function fetchBalance ({ api, withIntoError }: Deps, args: {
  parallel?: boolean, addresses: Address[]
}) {
  const { parallel = false, addresses } = args
  const queries = []
  for (const [address, tokens] of Object.entries(addresses)) {
    for (const denom of tokens) {
      queries.push(()=>withIntoError(api.query.bank.balance({ address, denom }))
        .then(response=>({ address, token: denom, balance: response.balance })))
    }
  }
  const result: Record<Address, Record<string, string>> = {}
  type Response = {address: string, token: string, balance?: { amount?: string }}
  const responses: Array<Response> = await optionallyParallel(parallel, queries)
  for (const { address, token, balance } of responses) {
    result[address] ??= {}
    result[address][token] = balance?.amount!
  }
  return result
}

export async function send ({ address, api, withIntoError }: AgentDeps, args: {
  parallel?: boolean, outputs: Record<Address, Coin[]>, sendFee: Fee, sendMemo?: string
}) {
  const { parallel = false, outputs, sendFee, sendMemo } = args
  const sender = address
  const transactions = []
  for (const [recipient, amounts] of Object.entries(outputs)) {
    const amount = amounts.map(({amount, denom})=>({ amount: String(amount), denom }))
    const args = { from_address: sender, to_address: recipient, amount }
    const opts = { gasLimit: Number(sendFee?.gas) }
    const fmt  = (transaction: unknown)=>({sender, recipient, amounts: amount, transaction})
    const tx   = ()=>withIntoError(api.tx.bank.send(args, opts)).then(fmt)
    transactions.push(tx)
  }
  type Response = {
    sender: Address,
    recipient: Address,
    amounts: Coin[],
    transaction: unknown
  }
  const result: Record<Address, Response> = {}
  const responses: Array<Response> = await optionallyParallel(parallel, transactions)
  for (const response of responses) result[(response).recipient] = response
  return result
  //return withIntoError(api.tx.bank.send(
    //{ from_address: this.address!, to_address: recipient, amount: amounts },
    //{ gasLimit: Number(options?.sendFee?.gas) }
  //))
}
