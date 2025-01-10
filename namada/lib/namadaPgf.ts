import type { Deps } from './namada.ts'
export type PgfParameters = Partial<{
  stewards:              Set<string>
  pgfInflationRate:      bigint
  stewardsInflationRate: bigint
}>
export const fetchPgfParameters = async ({ decoder, fetchAbciQuery }: Deps) =>
  decoder.pgf_parameters(await fetchAbciQuery(`/vp/pgf/parameters`))
