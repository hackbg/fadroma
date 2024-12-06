import type * as Namada from './namadaTypes.ts'
import { decode, u64 } from '../deps.ts'

export async function fetchEpochFirstBlock (connection: Namada.ConnectionBase) {
  return Number(decode(u64, await connection.abciQuery(
    '/shell/first_block_height_of_current_epoch'
  )))
}
