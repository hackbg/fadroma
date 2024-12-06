import type * as Namada from './namadaTypes.ts'

/** Fetch staking parameters. */
export async function fetchStakingParameters (connection: Namada.ConnectionBase) {
  const binary = await connection.abciQuery("/vp/pos/pos_params")
  return connection.decode.pos_parameters(binary)
}
