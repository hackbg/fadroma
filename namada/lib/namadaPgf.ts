import type { ApiDeps } from './namada.ts'
export type PgfParameters = Partial<{
  stewards:              Set<string>
  pgfInflationRate:      bigint
  stewardsInflationRate: bigint
}>
export const fetchPgfParameters = async ({ decoder, abciQuery }: ApiDeps) =>
  decoder.pgf_parameters(await abciQuery(`/vp/pgf/parameters`))
