import type { CosmWasmClient, SigningCosmWasmClient } from '@hackbg/cosmjs-esm'
import type { Address, Token, Chain } from '@fadroma/agent'
import { bold } from './cw-base'

type API = CosmWasmClient|Promise<CosmWasmClient>

export async function getBalance (
  api: API, token: string, address?: Address
) {
  api = await Promise.resolve(api)
  if (!address) {
    throw new Error('getBalance: pass (token, address)')
  }
  if (address === this.address) {
    this.log.debug('Querying', bold(token), 'balance')
  } else {
    this.log.debug('Querying', bold(token), 'balance of', bold(address))
  }
  const { amount } = await api.getBalance(address!, token!)
  return amount
}

type SigningAPI = SigningCosmWasmClient|Promise<SigningCosmWasmClient>

export async function send (
  api:       SigningAPI,
  recipient: Address,
  amounts:   Token.ICoin[],
  options?:  Parameters<Chain.Connection["doSend"]>[2]
) {
  api = await Promise.resolve(api)
  if (!(api?.sendTokens)) {
    throw new Error("can't send tokens with an unauthenticated agent")
  }
  return api.sendTokens(
    this.address!,
    recipient as string,
    amounts,
    options?.sendFee || 'auto',
    options?.sendMemo
  )
}
