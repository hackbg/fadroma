import type * as Namada from './namadaTypes.ts'

/** Fetch all delegations. */
export async function fetchDelegations (
  connection: Namada.ConnectionBase,
  address:    Namada.Address,
) {
  const binary = await connection.abciQuery(`/vp/pos/delegations/${address}`)
  return connection.decode.addresses(binary)
}
