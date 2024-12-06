import type * as Namada from './namadaTypes.ts'
import { decode, u256 } from '../deps.ts'

/** Fetch the stake of a given validator. */
export async function fetchValidatorStake (
  connection: Namada.ConnectionBase,
  address:    Namada.Address,
  epoch?:     Namada.Epoch,
) {
  let query = `/vp/pos/validator/stake/${address}`
  if (epoch) query += `/${epoch}`
  const totalStake = await connection.abciQuery(query)
  if (totalStake[0] === 0) return 0
  return decode(u256, totalStake.slice(1))
}
