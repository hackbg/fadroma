import type * as Namada from './namadaTypes.ts'

export async function fetchProposalVotes (
  connection: Namada.ConnectionBase, id: number|bigint
): Promise<ReturnType<Namada.Decoder["gov_votes"]>> {
  const query    = `/vp/governance/proposal/${id}/votes`
  const response = await connection.abciQuery(query)
  const decoded  = connection.decode.gov_votes(response)
  return decoded as ReturnType<Namada.Decoder["gov_votes"]>
}
