import type * as Namada from './namadaTypes.ts'

export async function fetchGovernanceParameters (connection: Namada.ConnectionBase) {
  const binary = await connection.abciQuery(`/vp/governance/parameters`)
  return connection.decode.gov_parameters(binary)
}
