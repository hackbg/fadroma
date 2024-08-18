import { optionallyParallel } from '@hackbg/fadroma'
import type { CosmWasmClient, SigningCosmWasmClient } from '@hackbg/cosmjs-esm'
import type { Address, Token, Chain, Connection, SigningConnection } from '@hackbg/fadroma'
import type { CWChain, CWConnection } from './CWConnection'
import type { CWAgent, CWSigningConnection } from './CWIdentity'

export async function fetchBalance (chain: CWConnection, {
  parallel = false,
  addresses,
}: Parameters<Connection["fetchBalanceImpl"]>[0]) {
  const queries = []
  for (const [address, tokens] of Object.entries(addresses)) {
    for (const token of tokens) {
      queries.push(()=>chain.api.getBalance(address, token).then(balance=>({
        address, token, balance
      })))
    }
  }
  const result: Record<Address, Record<string, string>> = {}
  const responses = await optionallyParallel(parallel, queries)
  for (const { address, token, balance } of responses) {
    result[address] ??= {}
    result[address][token] = balance.amount
  }
  return result
}

export async function send (agent: CWSigningConnection, {
  parallel = false,
  outputs,
  sendFee,
  sendMemo,
}: Parameters<SigningConnection["sendImpl"]>[0]) {
  const sender = agent.address
  const transactions = []
  for (const [recipient, amounts] of Object.entries(outputs)) {
    transactions.push(()=>agent.api.sendTokens(
      sender,
      recipient,
      Object.entries(amounts).map(([denom, amount])=>({amount, denom})),
      sendFee || 'auto',
      sendMemo
    ).then(transaction=>({
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
}
