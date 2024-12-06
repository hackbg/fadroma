import type * as Namada from './namadaTypes.ts'

/** Fetch delegations at given address. */
export async function fetchDelegationsAt (
  connection: Namada.ConnectionBase,
  address:    Namada.Address,
  epoch?:     Namada.Epoch
): Promise<Record<string, bigint>> {
  let query = `/vp/pos/delegations_at/${address}`
  epoch = Number(epoch)
  if (!isNaN(epoch)) {
    query += `/${epoch}`
  }
  const binary = await connection.abciQuery(query)
  return connection.decode.address_to_amount(binary) as Record<string, bigint>
}
