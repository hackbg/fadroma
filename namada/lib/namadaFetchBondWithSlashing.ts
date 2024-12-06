import type * as Namada from './namadaTypes.ts'
import { decode, u256 } from '../deps.ts'

export async function fetchBondWithSlashing (
  connection: Namada.ConnectionBase,
  delegator:  Namada.Address,
  validator:  Namada.Address,
  epoch?:     Namada.Epoch,
) {
  let query = `/vp/pos/bond_with_slashing/${delegator}/${validator}`
  if (epoch) query += `/${epoch}`
  const totalStake = await connection.abciQuery(query)
  return decode(u256, totalStake)
}
