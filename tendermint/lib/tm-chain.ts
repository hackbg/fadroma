import { fetchBalance } from './fetchBalance.ts'
import { send } from './send.ts'

export interface TendermintChainApi extends ChainApi {
  fetchBalance (address: Address, token: string): Promise<Uint128>
  fetchBalance (address: Address, tokens?: string[]): Promise<Record<string, Uint128>>
  fetchBalance (addresses: Address[], token: string): Promise<Record<Address, Uint128>>
  fetchBalance (addresses: Address[], tokens?: string): Promise<Record<Address, Record<string, Uint128>>>
}

export function makeTendermintChain (chain: ChainApi): TendermintChainApi {
  return {
    ...chain,
    fetchBalance (...args) { return fetchBalance(chain, ...args) },
  }
}

export interface TendermintAgentApi extends AgentApi {
  /** Chain-specific implementation of native token transfer. */
  send (parameters: {
    outputs:   Record<Address, Record<string, Uint128>>,
    sendFee?:  Token.IFee,
    sendMemo?: string,
    parallel?: boolean
  }): Promise<unknown>
}

export function makeTendermintAgent (agent: AgentApi): TendermintAgentApi {
  return {
    ...agent,
    send (...args) { return send(chain, ...args) }
  }
}
