import type { Context } from './namada.ts'
export type PgfParameters = Partial<{
  stewards:              Set<string>
  pgfInflationRate:      bigint
  stewardsInflationRate: bigint
}>
export const fetchPgfParameters = async ({ decoder, fetchAbciQuery }: Context) =>
  decoder.pgf_parameters((await fetchAbciQuery(`/vp/pgf/parameters`)).value!)
