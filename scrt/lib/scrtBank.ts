import { optionallyParallel } from '../deps.ts'
import type { Tendermint, Address, Token, Chain, Connection, Coin, Fee } from '../deps.ts'
import type { Deps } from './scrt.ts'

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
  type Response = {address: string, token: string, balance: { amount: string }}
  const responses: Array<Response> = await optionallyParallel(parallel, queries)
  for (const { address, token, balance } of responses) {
    result[address] ??= {}
    result[address][token] = balance?.amount!
  }
  return result
}

export async function send ({ address, api, withIntoError }: Deps, args: {
  parallel?: boolean, outputs: Coin[], sendFee: Fee, sendMemo?: string
}) {
  const { parallel = false, outputs, sendFee, sendMemo } = args
  const sender = address
  const transactions = []
  for (const [recipient, amounts] of Object.entries(outputs)) {
    transactions.push(()=>withIntoError(api.tx.bank.send(
      { from_address: sender, to_address: recipient, amount: amounts },
      { gasLimit: Number(sendFee?.gas) }
    )).then(transaction=>({
      sender, recipient, amounts, transaction
    })))
  }
  type Response = {
    sender: Address, recipient: Address, amounts: Record<string, string>, transaction: unknown
  }
  const result: Record<Address, Response> = {}
  const responses: Array<Response> = await optionallyParallel(parallel, transactions)
  for (const response of responses) {
    result[(response).recipient] = response
  }
  return result
  //return withIntoError(api.tx.bank.send(
    //{ from_address: this.address!, to_address: recipient, amount: amounts },
    //{ gasLimit: Number(options?.sendFee?.gas) }
  //))
}
