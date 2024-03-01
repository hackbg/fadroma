import type { CosmWasmClient, SigningCosmWasmClient } from '@hackbg/cosmjs-esm'
import type { Address, Token, Chain } from '@fadroma/agent'
import { Core } from '@fadroma/agent'

type Connection = {
  address: Address,
  log: Core.Console
  api: CosmWasmClient|Promise<CosmWasmClient>
}

export async function getBalance (
  { api, log, address }: Connection, token: string, queriedAddress: Address = address
) {
  api = await Promise.resolve(api)
  if (!queriedAddress) {
    throw new Error('getBalance: need address')
  }
  if (queriedAddress === address) {
    log.debug('Querying', Core.bold(token), 'balance')
  } else {
    log.debug('Querying', Core.bold(token), 'balance of', Core.bold(queriedAddress))
  }
  const { amount } = await api.getBalance(queriedAddress!, token!)
  return amount
}

type SigningConnection = {
  address: Address,
  log: Core.Console
  api: SigningCosmWasmClient|Promise<SigningCosmWasmClient>
}

export async function send (
  { api, address }: SigningConnection,
  recipient: Address,
  amounts:   Token.ICoin[],
  options?:  Parameters<Chain.Connection["doSend"]>[2]
) {
  api = await Promise.resolve(api)
  if (!(api?.sendTokens)) {
    throw new Error("can't send tokens with an unauthenticated agent")
  }
  return api.sendTokens(
    address!,
    recipient as string,
    amounts,
    options?.sendFee || 'auto',
    options?.sendMemo
  )
}
