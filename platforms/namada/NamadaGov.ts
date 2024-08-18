import { assign } from '@hackbg/fadroma'
import type { Address } from '@hackbg/fadroma'
import { decode, u64 } from '@hackbg/borshest'
import type Connection from './NamadaConnection'
import type { NamadaDecoder } from './NamadaDecode'

export type Params = Awaited<ReturnType<typeof fetchGovernanceParameters>>

export async function fetchGovernanceParameters (connection: Pick<Connection, 'abciQuery'|'decode'>) {
  const binary = await connection.abciQuery(`/vp/governance/parameters`)
  return connection.decode.gov_parameters(binary)
}

export async function fetchProposalCount (connection: Pick<Connection, 'abciQuery'>) {
  const binary = await connection.abciQuery(`/shell/value/#${INTERNAL_ADDRESS}/counter`)
  return decode(u64, binary) as bigint
}

export async function fetchProposalInfo (
  connection: Pick<Connection, 'abciQuery'|'decode'>, id: number|bigint
): Promise<NamadaGovernanceProposal|null> {
  const proposalResponse = await connection.abciQuery(`/vp/governance/proposal/${id}`)
  if (proposalResponse[0] === 0) return null
  const [ votesResponse, resultResponse  ] = await Promise.all([
    `/vp/governance/proposal/${id}/votes`,
    `/vp/governance/stored_proposal_result/${id}`,
  ].map(x=>connection.abciQuery(x)))
  const proposal = connection.decode.gov_proposal(proposalResponse.slice(1)) as
    ReturnType<NamadaDecoder["gov_proposal"]>
  const votes = connection.decode.gov_votes(votesResponse) as
    ReturnType<NamadaDecoder["gov_votes"]>
  const result = (resultResponse[0] === 0) ? null
    : decodeResultResponse(connection.decode.gov_result(resultResponse.slice(1)) as 
        Required<ReturnType<NamadaDecoder["gov_result"]>>)
  return { id: BigInt(id), proposal, votes, result }
}

const decodeResultResponse = (
  decoded: {
    result:            "Passed"|"Rejected"
    tallyType:         "TwoThirds"|"OneHalfOverOneThird"|"LessOneHalfOverOneThirdNay"
    totalVotingPower:  bigint
    totalYayPower:     bigint
    totalNayPower:     bigint
    totalAbstainPower: bigint
  },
  turnout = decoded.totalYayPower! + decoded.totalNayPower! + decoded.totalAbstainPower!
): NamadaGovernanceProposalResult => ({
  ...decoded,
  turnout:        String(turnout),
  turnoutPercent: (decoded.totalVotingPower! > 0) ? percent(turnout, decoded.totalVotingPower!) : '0',
  yayPercent:     (turnout > 0) ? percent(decoded.totalYayPower!, turnout) : '0',
  nayPercent:     (turnout > 0) ? percent(decoded.totalNayPower!, turnout) : '0',
  abstainPercent: (turnout > 0) ? percent(decoded.totalAbstainPower!, turnout) : '0',
})

export const INTERNAL_ADDRESS =
  "tnam1q5qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqrw33g6"

interface NamadaGovernanceProposal {
  readonly id:       bigint
  readonly proposal: ReturnType<NamadaDecoder["gov_proposal"]>
  readonly votes:    ReturnType<NamadaDecoder["gov_votes"]>
  readonly result:   NamadaGovernanceProposalResult|null
}

interface NamadaGovernanceProposalResult {
  readonly result:            "Passed"|"Rejected"
  readonly tallyType:         "TwoThirds"|"OneHalfOverOneThird"|"LessOneHalfOverOneThirdNay"
  readonly totalVotingPower:  bigint
  readonly totalYayPower:     bigint
  readonly totalNayPower:     bigint
  readonly totalAbstainPower: bigint
  readonly turnout:           string
  readonly turnoutPercent:    string
  readonly yayPercent:        string
  readonly nayPercent:        string
  readonly abstainPercent:    string
}

const percent = (a: string|number|bigint, b: string|number|bigint) =>
  ((Number(BigInt(a) * 1000000n / BigInt(b)) / 10000).toFixed(2) + '%').padStart(7)

export {
  NamadaGovernanceProposal       as Proposal,
  NamadaGovernanceProposalResult as ProposalResult,
}
