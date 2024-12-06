import type * as Namada from './namadaTypes.ts'

/** Fetch addresses of all known validators. */
export async function fetchValidatorAddresses (
  connection: Namada.ConnectionBase, epoch?: Namada.Epoch
): Promise<Namada.Address[]> {
  let query = "/vp/pos/validator/addresses"
  if (epoch!==undefined) query += `/${epoch}`
  const binary = await connection.abciQuery(query)
  return connection.decode.addresses(binary)
}
