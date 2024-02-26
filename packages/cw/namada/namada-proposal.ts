import * as Borsher from 'borsher'
import { Core } from '@fadroma/agent'
import type { Address } from '@fadroma/agent'
import type { Address as NamadaAddress } from './namada-address'
import { addressSchema, InternalAddresses, decodeAddressFields } from './namada-address'
import { u256Schema, decodeU256Fields } from './namada-u256'
import BigNumber from "bignumber.js"

type Connection = { abciQuery: (path: string)=>Promise<Uint8Array> }

const Schema = Borsher.BorshSchema
const Error = Core.Error

export async function getGovernanceParameters (connection: Connection) {
  const binary = await connection.abciQuery(`/vp/governance/parameters`)
  return GovernanceParameters.fromBorsh(binary)
}

export class GovernanceParameters {
  static fromBorsh = binary => new this(Borsher.borshDeserialize(governanceParametersSchema, binary))
  minProposalFund:         bigint
  maxProposalCodeSize:     bigint
  minProposalVotingPeriod: bigint
  maxProposalPeriod:       bigint
  maxProposalContentSize:  bigint
  minProposalGraceEpochs:  bigint
  constructor (data: Partial<GovernanceParameters> = {}) {
    Core.assignCamelCase(this, data, Object.keys(governanceParametersSchemaFields))
    decodeU256Fields(this, ["minProposalFund"])
  }
}

const governanceParametersSchemaFields = {
  min_proposal_fund:          u256Schema,
  max_proposal_code_size:     Schema.u64,
  min_proposal_voting_period: Schema.u64,
  max_proposal_period:        Schema.u64,
  max_proposal_content_size:  Schema.u64,
  min_proposal_grace_epochs:  Schema.u64
}

const governanceParametersSchema = Schema.Struct(
  governanceParametersSchemaFields
)

export async function getProposalCount (connection: Connection) {
  const binary = await connection.abciQuery(`/shell/value/#${InternalAddresses.Governance}/counter`)
  return Borsher.borshDeserialize(Schema.u64, binary) as bigint
}

export async function getProposalInfo (connection: Connection, id: number) {
  const [ proposal, votes, result ] = await Promise.all([
    connection.abciQuery(`/vp/governance/proposal/${id}`),
    connection.abciQuery(`/vp/governance/proposal/${id}/votes`),
    connection.abciQuery(`/vp/governance/stored_proposal_result/${id}`),
  ])
  return {
    proposal: Proposal.fromBorsh(proposal),
    votes:    ProposalVotes.fromBorsh(votes),
    result:   (result.length === 1)
      ? null
      : ProposalResult.fromBorsh(result),
  }
}

export class Proposal {
  static fromBorsh = binary => new this(Borsher.borshDeserialize(proposalSchema, binary))
  id!:               string
  content!:          Map<string, string>
  author!:           string
  type!:             unknown
  votingStartEpoch!: bigint
  votingEndEpoch!:   bigint
  graceEpoch!:       bigint
  constructor (data: Partial<Proposal> = {}) {
    Core.assignCamelCase(this, data, Object.keys(proposalSchemaFields))
    decodeAddressFields(this, ["author"])
  }
}

const addRemoveSchema = t => Schema.Enum({
  Add:    t,
  Remove: t,
})

const pgfTargetSchema = Schema.Enum({
  Internal:     Schema.Struct({
    target:     addressSchema,
    amount:     u256Schema,
  }),
  Ibc:          Schema.Struct({
    target:     Schema.String,
    amount:     u256Schema,
    port_id:    Schema.String,
    channel_id: Schema.String,
  })
})

const proposalSchemaFields = {
  id:                 Schema.u64,
  content:            Schema.HashMap(Schema.String, Schema.String),
  author:             addressSchema,
  type:               Schema.Enum({
    Default:          Schema.Option(Schema.String),
    PGFSteward:       Schema.HashSet(addRemoveSchema(addressSchema)),
    PGFPayment:       Schema.HashSet(Schema.Enum({
      Continuous:     addRemoveSchema(pgfTargetSchema),
      Retro:          pgfTargetSchema,
    }))
  }),
  voting_start_epoch: Schema.u64,
  voting_end_epoch:   Schema.u64,
  grace_epoch:        Schema.u64,
}

const proposalSchema = Schema.Option(Schema.Struct(
  proposalSchemaFields
))

export class ProposalVotes extends Array<Vote> {
  static fromBorsh = binary => new this(
    ...(Borsher.borshDeserialize(Schema.Vec(voteSchema), binary) as Array<{
      validator: NamadaAddress
      delegator: NamadaAddress
      data:      { Yay: {} } | { Nay: {} } | { Abstain: {} }
    }>).map(vote => new Vote(vote))
  )
}

const votes = new Set(['Yay', 'Nay', 'Abstain'])

export class Vote {
  validator: Address
  delegator: Address
  data: { Yay: {} } | { Nay: {} } | { Abstain: {} }
  constructor ({ validator, delegator, data }) {
    if (Object.keys(data).length !== 1) {
      throw new Error("vote.data variant must have exactly 1 key")
    }
    if (!votes.has(Object.keys(data)[0])) {
      throw new Error("vote.data variant must be one of: Established, Implicit, Internal")
    }
    this.validator = validator
    this.delegator = delegator
    this.data = data
  }
  get value () {
    if (typeof this.data !== 'object' || Object.keys(this.data).length !== 1) {
      throw new Error("vote.data variant must be an object of exactly 1 key")
    }
    const value = Object.keys(this.data)[0]
    if (!votes.has(value)) {
      throw new Error("vote.data variant must be one of: Established, Implicit, Internal")
    }
    return value as 'Yay'|'Nay'|'Abstain'
  }
}

const voteSchema = Schema.Struct({
  validator: addressSchema,
  delegator: addressSchema,
  data:      Schema.Enum({
    Yay:     Schema.Unit,
    Nay:     Schema.Unit,
    Abstain: Schema.Unit
  }),
})

const proposalStatusSchema = Schema.Enum({
  Pending: Schema.Unit,
  OnGoing: Schema.Unit,
  Ended:   Schema.Unit,
})

const percent = (a: bigint, b: bigint) =>
  ((Number(a * 1000000n / b) / 10000).toFixed(2) + '%').padStart(7)

export class ProposalResult {
  static fromBorsh = binary => new this(Borsher.borshDeserialize(proposalResultSchema, binary))
  result:
    | { Passed:   {} }
    | { Rejected: {} }
  tallyType:
    | { TwoThirds:                  {} }
    | { OneHalfOverOneThird:        {} }
    | { LessOneHalfOverOneThirdNay: {} }
  totalVotingPower:  bigint
  totalYayPower:     bigint
  totalNayPower:     bigint
  totalAbstainPower: bigint

  constructor (data: Partial<ProposalResult> = {}) {
    Core.assignCamelCase(this, data, Object.keys(proposalResultSchemaFields))
    decodeU256Fields(this, [
      "totalVotingPower",
      "totalYayPower",
      "totalNayPower",
      "totalAbstainPower",
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

const proposalResultSchemaFields = {
  result:                       Schema.Enum({
    Passed:                     Schema.Unit,
    Rejected:                   Schema.Unit,
  }),
  tally_type:                   Schema.Enum({
    TwoThirds:                  Schema.Unit,
    OneHalfOverOneThird:        Schema.Unit,
    LessOneHalfOverOneThirdNay: Schema.Unit,
  }),
  total_voting_power:           u256Schema,
  total_yay_power:              u256Schema,
  total_nay_power:              u256Schema,
  total_abstain_power:          u256Schema,
}

const proposalResultSchema = Schema.Struct(proposalResultSchemaFields)
