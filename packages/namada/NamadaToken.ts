import { decode, u64 } from '@hackbg/borshest'
import type { NamadaConnection as Connection } from './NamadaConnection'

export async function fetchDenomination (connection: Connection, token: string) {
  const binary = await connection.abciQuery(`/vp/token/denomination/${token}`)
  return decode(u8, binary)
}
export async function fetchTotalSupply (connection: Connection, token: string) {
  const binary = await connection.abciQuery(`/vp/token/total_supply/${token}`)
  return decode(u64, binary)
}
export async function fetchEffectiveNativeSupply (connection: Connection) {
  const binary = await connection.abciQuery(`/vp/token/effective_native_supply`)
  return decode(u64, binary)
}
export async function fetchStakingRewardsRate (connection: Connection) {
  const binary = await connection.abciQuery(`/vp/token/staking_rewards_rate`)
  return connection.decode.pos_rewards_rates(binary)
}
