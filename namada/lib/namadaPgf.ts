import type { ApiDeps } from './namada.ts'
export type PGFParameters = Partial<{
  stewards:              Set<string>
  pgfInflationRate:      bigint
  stewardsInflationRate: bigint
}>
export const fetchPGFParameters = async ({ decoder, abciQuery }: ApiDeps) =>
  decoder.pgf_parameters(await abciQuery(`/vp/pgf/parameters`))
