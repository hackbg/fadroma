import { Core } from '@fadroma/agent'
import type { Address } from '@fadroma/agent'
import type { Address as NamadaAddress } from './namada-address'
import { addr, InternalAddresses, decodeAddressFields } from './namada-address'
import { decode, u64 } from '@hackbg/borshest'
//import {
  //decode, Struct,
  //map, set, vec, option, struct, variants, u256, u64, string, unit
//} from '@hackbg/borshest'

type Connection = { abciQuery: (path: string)=>Promise<Uint8Array> }

export async function getGovernanceParameters (connection: Connection) {
  const binary = await connection.abciQuery(`/vp/governance/parameters`)
  return GovernanceParameters.decode(binary) as GovernanceParameters
}

//export class GovernanceParameters extends Struct(
  //["minProposalFund",         u256],
  //["maxProposalCodeSize",     u64],
  //["minProposalVotingPeriod", u64],
  //["maxProposalPeriod",       u64],
  //["maxProposalContentSize",  u64],
  //["minProposalGraceEpochs",  u64],
//) {
  //declare minProposalFund:         bigint
  //declare maxProposalCodeSize:     bigint
  //declare minProposalVotingPeriod: bigint
  //declare maxProposalPeriod:       bigint
  //declare maxProposalContentSize:  bigint
  //declare minProposalGraceEpochs:  bigint
//}

export async function getProposalCount (connection: Connection) {
  const binary = await connection.abciQuery(`/shell/value/#${InternalAddresses.Governance}/counter`)
  return decode(u64, binary) as bigint
}

export async function getProposalInfo (connection: Connection, id: number) {
  const [ proposal, votes, result ] = await Promise.all([
    connection.abciQuery(`/vp/governance/proposal/${id}`),
    connection.abciQuery(`/vp/governance/proposal/${id}/votes`),
    connection.abciQuery(`/vp/governance/stored_proposal_result/${id}`),
  ])
  return {
    proposal: Proposal.decode(proposal) as Proposal,
    votes:    ProposalVotes.fromBorsh(votes) as ProposalVotes,
    result:   (result.length === 1)
      ? null
      : ProposalResult.decode(result) as ProposalResult,
  }
}

//const addRemove = t => variants(
  //["Add",    t],
  //["Remove", t]
//)

//const pgfTarget = variants(
  //["Internal",    struct(
    //["target",    addr],
    //["amount",    u256],
  //)],
  //["Ibc",         struct(
    //["target",    string],
    //["amount",    u256],
    //["portId",    string],
    //["channelId", string],
  //)]
//)

//export class Proposal extends Struct(
  //["id",               u64],
  //["content",          map(string, string)],
  //["author",           addr],
  //["type",             variants(
    //["Default",        option(string)],
    //["PGFSteward",     set(addRemove(addr))],
    //["PGFPayment",     set(variants(
      //["Continuous",   addRemove(pgfTarget)],
      //["Retro",        pgfTarget],
    //))]
  //)],
  //["votingStartEpoch", u64],
  //["votingEndEpoch",   u64],
  //["grace_epoch",      u64],
//) {
  //declare id:               string
  //declare content:          Map<string, string>
  //declare author:           string
  //declare type:             unknown
  //declare votingStartEpoch: bigint
  //declare votingEndEpoch:   bigint
  //declare graceEpoch:       bigint
//}

//export class ProposalVotes extends Array<Vote> {
  //static fromBorsh = binary => new this(
    //...(Borsher.borshDeserialize(Schema.Vec(voteSchema), binary) as Array<{
      //validator: NamadaAddress
      //delegator: NamadaAddress
      //data:      { Yay: {} } | { Nay: {} } | { Abstain: {} }
    //}>).map(vote => new Vote(vote))
  //)
//}

//const votes = new Set(['Yay', 'Nay', 'Abstain'])

//export class Vote {
  //validator: Address
  //delegator: Address
  //data: { Yay: {} } | { Nay: {} } | { Abstain: {} }
  //constructor ({ validator, delegator, data }) {
    //if (Object.keys(data).length !== 1) {
      //throw new Core.Error("vote.data variant must have exactly 1 key")
    //}
    //if (!votes.has(Object.keys(data)[0])) {
      //throw new Core.Error("vote.data variant must be one of: Established, Implicit, Internal")
    //}
    //this.data      = data
    //this.validator = validator
    //this.delegator = delegator
    //decodeAddressFields(this, ["validator", "delegator"])
  //}
  //get value () {
    //if (typeof this.data !== 'object' || Object.keys(this.data).length !== 1) {
      //throw new Core.Error("vote.data variant must be an object of exactly 1 key")
    //}
    //const value = Object.keys(this.data)[0]
    //if (!votes.has(value)) {
      //throw new Core.Error("vote.data variant must be one of: Established, Implicit, Internal")
    //}
    //return value as 'Yay'|'Nay'|'Abstain'
  //}
//}

//const voteValueSchema = variants(
  //['Yay',     unit],
  //['Nay',     unit],
  //['Abstain', unit],
//)

//const voteSchema = struct(
  //["validator", addr],
  //["delegator", addr],
  //["data",      voteValueSchema],
//)

//const proposalStatusSchema = variants(
  //["Pending", unit],
  //["OnGoing", unit],
  //["Ended",   unit],
//)

//const percent = (a: bigint, b: bigint) =>
  //((Number(a * 1000000n / b) / 10000).toFixed(2) + '%').padStart(7)

//export class ProposalResult extends Struct(
  //["result",                       variants(
    //["Passed",                     unit],
    //["Rejected",                   unit],
  //)],
  //["tallyType",                    variants(
    //["TwoThirds",                  unit],
    //["OneHalfOverOneThird",        unit],
    //["LessOneHalfOverOneThirdNay", unit],
  //)],
  //["totalVotingPower",             u256],
  //["totalYayPower",                u256],
  //["totalNayPower",                u256],
  //["totalAbstainPower",            u256],
//) {
  //declare result:
    //| { Passed:   {} }
    //| { Rejected: {} }
  //declare tallyType:
    //| { TwoThirds: {} }
    //| { OneHalfOverOneThird: {} }
    //| { LessOneHalfOverOneThirdNay: {} }
  //declare totalVotingPower:  bigint
  //declare totalYayPower:     bigint
  //declare totalNayPower:     bigint
  //declare totalAbstainPower: bigint

  //get turnout () {
    //return this.totalYayPower + this.totalNayPower + this.totalAbstainPower
  //}
  //get turnoutPercent () {
    //return percent(this.turnout, this.totalVotingPower)
  //}
  //get yayPercent () {
    //return percent(this.totalYayPower, this.turnout)
  //}
  //get nayPercent () {
    //return percent(this.totalNayPower, this.turnout)
  //}
  //get abstainPercent () {
    //return percent(this.totalAbstainPower, this.turnout)
  //}
//}

//export class InitProposal extends Struct() {
  //print (console) {
    //throw new Error('print InitProposal: not implemented')
  //}
//}

//export class VoteProposal extends Struct(
  //['id',          u64],
  //['vote',        voteValueSchema],
  //['voter',       addr],
  //['delegations', vec(addr)]
//) {
  //declare id: bigint
  //declare vote
  //declare voter
  //declare delegations: unknown[]
  //print (console) {
    //console.log(Core.bold('  Decoded VoteProposal:'))
      //.log('    Proposal ID:', Core.bold(this.id))
      //.log('    Vote:       ', Core.bold(JSON.stringify(this.vote)))
      //.log('    Voter:      ', Core.bold(JSON.stringify(this.voter)))
      //.log('    Delegations:', Core.bold(JSON.stringify(this.delegations)))
  //}
//}
