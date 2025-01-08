import type { ConnectionBase } from './namada.ts'
export type PGFParameters = Partial<{
  stewards:              Set<string>
  pgfInflationRate:      bigint
  stewardsInflationRate: bigint
}>
export const fetchPGFParameters = async ({ decoder, abciQuery }: ConnectionBase) =>
  decoder.pgf_parameters(await abciQuery(`/vp/pgf/parameters`))
