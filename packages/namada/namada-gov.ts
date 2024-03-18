import { Core } from '@fadroma/agent'
import type { Address } from '@fadroma/agent'
import { decode, u64 } from '@hackbg/borshest'

class GovernanceParameters {
  minProposalFund!:         bigint
  maxProposalCodeSize!:     bigint
  minProposalVotingPeriod!: bigint
  maxProposalPeriod!:       bigint
  maxProposalContentSize!:  bigint
  minProposalGraceEpochs!:  bigint
  constructor (properties: Partial<GovernanceParameters> = {}) {
    Core.assign(this, properties, [
      'minProposalFund',
      'maxProposalCodeSize',
      'minProposalVotingPeriod',
      'maxProposalPeriod',
      'maxProposalContentSize',
      'minProposalGraceEpochs',
    ])
  }
}

class GovernanceProposal {
  id!:               string
  content!:          Map<string, string>
  author!:           string
  type!:             unknown
  votingStartEpoch!: bigint
  votingEndEpoch!:   bigint
  graceEpoch!:       bigint
  constructor (properties: Partial<GovernanceProposal> = {}) {
    Core.assign(this, properties, [
      'id',
      'content',
      'author',
      'type',
      'votingStartEpoch',
      'votingEndEpoch',
      'graceEpoch',
    ])
  }
}

class GovernanceProposalResult {
  result!:            "Passed"|"Rejected"
  tallyType!:         "TwoThirds"|"OneHalfOverOneThird"|"LessOneHalfOverOneThirdNay"
  totalVotingPower!:  bigint
  totalYayPower!:     bigint
  totalNayPower!:     bigint
  totalAbstainPower!: bigint
  constructor (properties: Partial<GovernanceProposalResult> = {}) {
    Core.assign(this, properties, [
      'result',
      'tallyType',
      'totalVotingPower',
      'totalYayPower',
      'totalNayPower',
      'totalAbstainPower',
    ])
  }
  get turnout () {
    return this.totalYayPower + this.totalNayPower + this.totalAbstainPower
  }
  get turnoutPercent () {
    return percent(this.turnout, this.totalVotingPower)
  }
  get yayPercent () {
    return percent(this.totalYayPower, this.turnout)
  }
  get nayPercent () {
    return percent(this.totalNayPower, this.turnout)
  }
  get abstainPercent () {
    return percent(this.totalAbstainPower, this.turnout)
  }
}

class GovernanceVote {
  validator!: Address
  delegator!: Address
  data!:      "Yay"|"Nay"|"Abstain"
  constructor (properties: Partial<GovernanceVote> = {}) {
    Core.assign(this, properties, [
      'validator',
      'delegator',
      'data',
    ])
  }
}

const percent = (a: bigint, b: bigint) =>
  ((Number(a * 1000000n / b) / 10000).toFixed(2) + '%').padStart(7)

export {
  GovernanceParameters     as Parameters,
  GovernanceProposal       as Proposal,
  GovernanceProposalResult as ProposalResult,
  GovernanceVote           as Vote,
}

export const INTERNAL_ADDRESS = "tnam1q5qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqrw33g6"

type Connection = {
  abciQuery: (path: string)=>Promise<Uint8Array>
  decode: {
    gov_parameters (binary: Uint8Array): Partial<GovernanceParameters>
    gov_proposal   (binary: Uint8Array): Partial<GovernanceProposal>
    gov_votes      (binary: Uint8Array): Array<Partial<GovernanceVote>>
    gov_result     (binary: Uint8Array): Partial<GovernanceProposalResult>
  }
}

export async function getGovernanceParameters (connection: Connection) {
  const binary = await connection.abciQuery(`/vp/governance/parameters`)
  return new GovernanceParameters(connection.decode.gov_parameters(binary))
}

export async function getProposalCount (connection: Connection) {
  const binary = await connection.abciQuery(`/shell/value/#${INTERNAL_ADDRESS}/counter`)
  return decode(u64, binary) as bigint
}

export async function getProposalInfo (connection: Connection, id: number) {
  const proposal = await connection.abciQuery(`/vp/governance/proposal/${id}`)
  if (proposal[0] === 0) {
    return null
  }
  const [ votes, result ] = await Promise.all([
    connection.abciQuery(`/vp/governance/proposal/${id}/votes`),
    connection.abciQuery(`/vp/governance/stored_proposal_result/${id}`),
  ])
  return {
    proposal: new GovernanceProposal(
      connection.decode.gov_proposal(proposal.slice(1))
    ),
    votes: connection.decode.gov_votes(votes).map(
      vote=>new GovernanceVote(vote)
    ),
    result: (result[0] === 0) ? null : new GovernanceProposalResult(
      connection.decode.gov_result(result.slice(1))
    )
  }
}
