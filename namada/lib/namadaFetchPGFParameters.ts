import type * as Namada from './namadaTypes.ts'

export async function fetchPGFParameters (connection: Namada.ConnectionBase) {
  const binary = await connection.abciQuery(`/vp/pgf/parameters`)
  return connection.decode.pgf_parameters(binary)
}
