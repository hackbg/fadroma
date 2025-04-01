import type { Context } from './namada.ts'
import type { Decoder } from './namadaDecode.ts'
import { decode, u64 } from '../deps.ts'
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
export const GOV_INTERNAL_ADDRESS = "tnam1q5qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqrw33g6"
export const fetchGovernanceParameters = async ({ fetchAbciQuery, decoder }: Context) =>
  decoder.gov_parameters((await fetchAbciQuery(`/vp/governance/parameters`)).value!)
export const fetchProposalCount = async ({ fetchAbciQuery }: Context) => decode(u64,
  (await fetchAbciQuery(`/shell/value/#${GOV_INTERNAL_ADDRESS}/counter`)).value!) as bigint
export const fetchProposalInfo = async (
  { fetchAbciQuery, decoder }: Context, id: number|bigint
): Promise<ReturnType<Decoder["gov_proposal"]>|null> => {
  const response = (await fetchAbciQuery(`/vp/governance/proposal/${id}`)).value!
  if (response[0] === 0) return null
  return decoder.gov_proposal(response.slice(1)) as ReturnType<Decoder["gov_proposal"]>
}
export const fetchProposalVotes = async (
  { fetchAbciQuery, decoder }: Context, id: number|bigint
): Promise<ReturnType<Decoder["gov_votes"]>> => {
  const binary = (await fetchAbciQuery(`/vp/governance/proposal/${id}/votes`)).value!
  return decoder.gov_votes(binary) as ReturnType<Decoder["gov_votes"]>
}
export const fetchProposalWasm = async (
  { fetchAbciQuery, decoder }: Context, id: number|bigint
): Promise<GovernanceProposalWasm|null> => {
  id = BigInt(id)
  const codeKey = decoder.gov_proposal_code_key(BigInt(id))
  let wasm
  const hasKey = (await fetchAbciQuery(`/shell/has_key/${codeKey}`)).value!
  if (hasKey[0] === 1) {
    wasm = (await fetchAbciQuery(`/shell/value/${codeKey}`)).value!
    wasm = wasm.slice(4) // trim length prefix
    return { id, codeKey, wasm }
  } else {
    return null
  }
}
export const fetchProposalResult = async (
  { fetchAbciQuery, decoder }: Context, id: number|bigint
): Promise<GovernanceProposalResult|null> => {
  const response = (await fetchAbciQuery(`/vp/governance/stored_proposal_result/${id}`)).value!
  if (response[0] === 0) return null
  const decoded = decoder.gov_result(response.slice(1))
  const results = decodeResultResponse(decoded as Required<typeof decoded>)
  return results as GovernanceProposalResult
}
export const decodeResultResponse = (
  decoded: {
    result:            "Passed"|"Rejected"
    tallyType:         "TwoThirds"|"OneHalfOverOneThird"|"LessOneHalfOverOneThirdNay"
    totalVotingPower:  bigint
    totalYayPower:     bigint
    totalNayPower:     bigint
    totalAbstainPower: bigint
  },
  turnout =
    BigInt(decoded.totalYayPower!) +
    BigInt(decoded.totalNayPower!) +
    BigInt(decoded.totalAbstainPower!)
): GovernanceProposalResult => ({
  ...decoded,
  turnout:        String(turnout),
  turnoutPercent: (decoded.totalVotingPower! > 0) ? percent2(turnout, decoded.totalVotingPower!) : '0',
  yayPercent:     (turnout > 0) ? percent(decoded.totalYayPower!, turnout) : '0',
  nayPercent:     (turnout > 0) ? percent(decoded.totalNayPower!, turnout) : '0',
  abstainPercent: (turnout > 0) ? percent(decoded.totalAbstainPower!, turnout) : '0',
})
const percent = (a: string|number|bigint, b: string|number|bigint) =>
  ((Number(BigInt(a) * 1000000n / BigInt(b)) / 10000).toFixed(2) + '%')
const percent2 = (a: string|number|bigint, b: string|number|bigint) =>
  ((Number(BigInt(a) * 1000000n / BigInt(b)) / 1000000).toFixed(2) + '%')
