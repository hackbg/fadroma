import type * as Namada from './namadaTypes.ts'

export async function fetchProposalResult (
  connection: Namada.ConnectionBase,
  id: number|bigint
): Promise<Namada.GovernanceProposalResult|null> {
  const query    = `/vp/governance/stored_proposal_result/${id}`
  const response = await connection.abciQuery(query)
  if (response[0] === 0) return null
  const decoded = connection.decode.gov_result(response.slice(1))
  const results = decodeResultResponse(decoded as Required<typeof decoded>)
  return results as Namada.GovernanceProposalResult
}

function decodeResultResponse (
  decoded: {
    result:            "Passed"|"Rejected"
    tallyType:         "TwoThirds"|"OneHalfOverOneThird"|"LessOneHalfOverOneThirdNay"
    totalVotingPower:  bigint
    totalYayPower:     bigint
    totalNayPower:     bigint
    totalAbstainPower: bigint
  },
  turnout = decoded.totalYayPower! + decoded.totalNayPower! + decoded.totalAbstainPower!
): Namada.GovernanceProposalResult {
  return {
    ...decoded,
    turnout:        String(turnout),
    turnoutPercent: (decoded.totalVotingPower! > 0) ? percent2(turnout, decoded.totalVotingPower!) : '0',
    yayPercent:     (turnout > 0) ? percent(decoded.totalYayPower!, turnout) : '0',
    nayPercent:     (turnout > 0) ? percent(decoded.totalNayPower!, turnout) : '0',
    abstainPercent: (turnout > 0) ? percent(decoded.totalAbstainPower!, turnout) : '0',
  }
}

const percent = (a: string|number|bigint, b: string|number|bigint) =>
  ((Number(BigInt(a) * 1000000n / BigInt(b)) / 10000).toFixed(2) + '%')

const percent2 = (a: string|number|bigint, b: string|number|bigint) =>
  ((Number(BigInt(a) * 1000000n / BigInt(b)) / 1000000).toFixed(2) + '%')
