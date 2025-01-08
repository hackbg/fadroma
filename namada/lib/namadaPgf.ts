export type PGFParameters = Partial<{
  stewards:              Set<string>
  pgfInflationRate:      bigint
  stewardsInflationRate: bigint
}>

export async function fetchPGFParameters (connection: Namada.ConnectionBase) {
  const binary = await connection.abciQuery(`/vp/pgf/parameters`)
  return connection.decode.pgf_parameters(binary)
}
