import type { ConnectionBase } from './namada.ts'
import type { Decoder } from './namadaDecode.ts'
import { decode, u64 } from '../deps.ts'

export const GOV_INTERNAL_ADDRESS = "tnam1q5qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqrw33g6"

export type GovernanceParameters = Partial<{
  minProposalFund:         bigint
  maxProposalCodeSize:     bigint
  minProposalVotingPeriod: bigint
  maxProposalPeriod:       bigint
  maxProposalContentSize:  bigint
  minProposalGraceEpochs:  bigint
}>

export type GovernanceProposal = {
  readonly id:       bigint
  readonly proposal: ReturnType<Decoder["gov_proposal"]>
  readonly votes:    ReturnType<Decoder["gov_votes"]>
  readonly result:   GovernanceProposalResult|null
}

export type GovernanceProposalResult = {
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

export type GovernanceProposalWasm = {
  readonly id:      bigint
  readonly codeKey: string
  readonly wasm?:   Uint8Array
}

export async function fetchGovernanceParameters (connection: ConnectionBase) {
  const binary = await connection.abciQuery(`/vp/governance/parameters`)
  return connection.decode.gov_parameters(binary)
}

export async function fetchProposalCount (connection: ConnectionBase) {
  const binary = await connection.abciQuery(`/shell/value/#${GOV_INTERNAL_ADDRESS}/counter`)
  return decode(u64, binary) as bigint
}

export async function fetchProposalInfo (
  connection: ConnectionBase,
  id: number|bigint
): Promise<ReturnType<Decoder["gov_proposal"]>|null> {
  const query    = `/vp/governance/proposal/${id}`
  const response = await connection.abciQuery(query)
  if (response[0] === 0) return null
  const decoded = connection.decode.gov_proposal(response.slice(1))
  return decoded as ReturnType<Decoder["gov_proposal"]>
}

export async function fetchProposalResult (
  connection: ConnectionBase,
  id: number|bigint
): Promise<GovernanceProposalResult|null> {
  const query    = `/vp/governance/stored_proposal_result/${id}`
  const response = await connection.abciQuery(query)
  if (response[0] === 0) return null
  const decoded = connection.decode.gov_result(response.slice(1))
  const results = decodeResultResponse(decoded as Required<typeof decoded>)
  return results as GovernanceProposalResult
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
): GovernanceProposalResult {
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

export async function fetchProposalVotes (
  connection: ConnectionBase, id: number|bigint
): Promise<ReturnType<Decoder["gov_votes"]>> {
  const query    = `/vp/governance/proposal/${id}/votes`
  const response = await connection.abciQuery(query)
  const decoded  = connection.decode.gov_votes(response)
  return decoded as ReturnType<Decoder["gov_votes"]>
}

export async function fetchProposalWasm (
  connection: ConnectionBase, id: number|bigint
): Promise<GovernanceProposalWasm|null> {
  id = BigInt(id)
  const codeKey = connection.decode.gov_proposal_code_key(BigInt(id))
  let wasm
  const hasKey = await connection.abciQuery(`/shell/has_key/${codeKey}`)
  if (hasKey[0] === 1) {
    wasm = await connection.abciQuery(`/shell/value/${codeKey}`)
    wasm = wasm.slice(4) // trim length prefix
    return { id, codeKey, wasm }
  } else {
    return null
  }
}
