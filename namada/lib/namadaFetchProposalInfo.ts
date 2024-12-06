import type * as Namada from './namadaTypes.ts'

export async function fetchProposalInfo (
  connection: Namada.ConnectionBase,
  id: number|bigint
): Promise<ReturnType<Namada.Decoder["gov_proposal"]>|null> {
  const query    = `/vp/governance/proposal/${id}`
  const response = await connection.abciQuery(query)
  if (response[0] === 0) return null
  const decoded = connection.decode.gov_proposal(response.slice(1))
  return decoded as ReturnType<Namada.Decoder["gov_proposal"]>
}
