import { optionallyParallel } from '@hackbg/fadroma'
import { withIntoError } from './scrt-base'
import type { Address, Token, Chain, Connection, SigningConnection } from '@hackbg/fadroma'
import type { ScrtConnection } from './scrt-chain'
import type { ScrtSigningConnection } from './scrt-identity'

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

export async function send (agent: ScrtSigningConnection, {
  parallel = false,
  outputs,
  sendFee,
  sendMemo,
}: Parameters<SigningConnection["sendImpl"]>[0]) {
  const { api } = agent
  const sender = agent.address
  const transactions = []
  for (const [recipient, amounts] of Object.entries(outputs)) {
    transactions.push(()=>withIntoError(api.tx.bank.send(
      { from_address: sender, to_address: recipient, amount: amounts },
      { gasLimit: Number(sendFee?.gas) }
    )).then(transaction=>({
      sender, recipient, amounts, transaction
    })))
  }
  const result: Record<Address, {
    sender:      Address,
    recipient:   Address,
    amounts:     Record<string, string>
    transaction: unknown
  }> = {}
  const responses = await optionallyParallel(parallel, transactions)
  for (const response of responses) {
    result[response.recipient] = response
  }
  return result

  //return withIntoError(api.tx.bank.send(
    //{ from_address: this.address!, to_address: recipient, amount: amounts },
    //{ gasLimit: Number(options?.sendFee?.gas) }
  //))
}
