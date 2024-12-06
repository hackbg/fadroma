import type * as Namada from './namadaTypes.ts'
import { decode, u64 } from '../deps.ts'

/** Fetch total staked NAMNAM. */
export async function fetchTotalStaked (
  connection: Namada.ConnectionBase, epoch?: number|bigint|string
) {
  let query = "/vp/pos/total_stake"
  if (epoch!==undefined) query += `/${epoch}`
  const binary = await connection.abciQuery(query)
  return decode(u64, binary)
}
