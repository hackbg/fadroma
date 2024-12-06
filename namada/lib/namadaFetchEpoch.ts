import type * as Namada from './namadaTypes.ts'
import { decode, u64 } from '../deps.ts'

export async function fetchEpoch (
  connection: Namada.ConnectionBase,
  height?:    Namada.Height,
) {
  if (height !== undefined) {
    const binary = await connection.abciQuery(`/shell/epoch_at_height/${height}`)
    return binary[0] ? decode(u64, binary.slice(1)) : null
  } else {
    return decode(u64, await connection.abciQuery("/shell/epoch"))
  }
}
