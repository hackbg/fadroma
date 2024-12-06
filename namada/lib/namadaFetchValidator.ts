import type * as Namada from './namadaTypes.ts'
import { fetchValidatorDetails } from './namadaFetchValidatorDetails.ts'

/** Fetch details about one validator. */
export async function fetchValidator (
  connection: Namada.ConnectionBase,
  namadaAddress: Namada.Address,
  options?: { epoch?: Namada.Epoch }
) {
  return await fetchValidatorDetails(connection, {
    ...options,
    validator: { chain: connection.chain, address: null as any, namadaAddress }
  })
}
