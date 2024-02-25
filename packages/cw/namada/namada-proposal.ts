import * as Borsher from 'borsher'
import { addressSchema, InternalAddresses } from './namada-address'
import { Core } from '@fadroma/agent'
import BigNumber from "bignumber.js"

type Connection = { abciQuery: (path: string)=>Promise<Uint8Array> }

const Schema = Borsher.BorshSchema

export async function getGovernanceParameters (connection: Connection) {
  const binary = await connection.abciQuery(`/vp/governance/parameters`)
  return GovernanceParameters.fromBorsh(binary)
}

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
    votes:    votes,
    result:   result,
  }
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
  }
}

const governanceParametersSchemaFields = {
  min_proposal_fund:          Schema.u128,
  max_proposal_code_size:     Schema.u64,
  min_proposal_voting_period: Schema.u64,
  max_proposal_period:        Schema.u64,
  max_proposal_content_size:  Schema.u64,
  min_proposal_grace_epochs:  Schema.u64
}

const governanceParametersSchema = Schema.Struct(
  governanceParametersSchemaFields
)

export class Proposal {
  static fromBorsh = binary => new this(Borsher.borshDeserialize(proposalSchema, binary))
  id!:               string
  content!:          Map<string, string>
  author!:           unknown
  type!:             unknown
  votingStartEpoch!: bigint
  votingEndEpoch!:   bigint
  graceEpoch!:       bigint
  //status!:           ProposalStatus
  //result!:           ProposalResult
  //totalVotingPower!: BigNumber
  //totalYayPower!:    BigNumber
  //totalNayPower!:    BigNumber
  constructor (data: Partial<Proposal> = {}) {
    Core.assignCamelCase(this, data, Object.keys(proposalSchemaFields))
  }
  async voteYay () { throw new Error("not implemented") }
  async voteNay () { throw new Error("not implemented") }
  async abstain () { throw new Error("not implemented") }
}

const addRemoveSchema = t => Schema.Enum({
  Add:    t,
  Remove: t,
})

const pgfTargetSchema = Schema.Enum({
  Internal:     Schema.Struct({
    target:     addressSchema,
    amount:     Schema.String,
  }),
  Ibc:          Schema.Struct({
    target:     Schema.String,
    amount:     Schema.String,
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

export class ProposalVotes extends Array {
  static fromBorsh = binary => new this(Borsher.borshDeserialize(Schema.Vec(voteSchema), binary))
}

const proposalStatusSchema = Schema.Enum({
  Pending: Schema.Unit,
  OnGoing: Schema.Unit,
  Ended:   Schema.Unit,
})

const proposalResultSchema = Schema.Struct({
  result:                       Schema.Enum({
    Passed:                     Schema.Unit,
    Rejected:                   Schema.Unit,
  }),
  tally_type:                   Schema.Enum({
    TwoThirds:                  Schema.Unit,
    OneHalfOverOneThis:         Schema.Unit,
    LessOneHalfOverOneThirdNay: Schema.Unit,
  }),
  total_voting_power:           Schema.String,
  total_yay_power:              Schema.String,
  total_nay_power:              Schema.String,
  total_abstain_power:          Schema.String
})

const voteSchema = Schema.Struct({
  validator: addressSchema,
  delegator: addressSchema,
  data:      Schema.Enum({
    Yay:     Schema.Unit,
    Nay:     Schema.Unit,
    Abstain: Schema.Unit
  }),
})
