import type * as Namada from './namadaTypes.ts'
import { decode, u64 } from '../deps.ts'

export const INTERNAL_ADDRESS = "tnam1q5qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqrw33g6"

export async function fetchProposalCount (connection: Namada.ConnectionBase) {
  const binary = await connection.abciQuery(`/shell/value/#${INTERNAL_ADDRESS}/counter`)
  return decode(u64, binary) as bigint
}

