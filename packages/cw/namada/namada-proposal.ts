import * as Borsher from 'borsher'
import { BigNumberSerializer } from './namada-borsh'
import { Core } from '@fadroma/agent'
import BigNumber from "bignumber.js"
const Schema = Borsher.BorshSchema

export type ProposalType = "pgf_steward" | "pgf_payment" | "default"

export type ProposalStatus = "ongoing" | "finished" | "upcoming"

export type ProposalResult = "passed" | "rejected"

const addRemoveSchema = t => Schema.Enum({ Add: t, Remove: t })

const pgfTargetSchema = Schema.Enum({
  Internal:     Schema.Struct({
    target:     Schema.String,
    amount:     Schema.String,
  }),
  Ibc:          Schema.Struct({
    target:     Schema.String,
    amount:     Schema.String,
    port_id:    Schema.String,
    channel_id: Schema.String,
  })
})

const addressSchema = Schema.Enum({
  Established:     Schema.Array(Schema.u8, 20),
  Implicit:        Schema.Array(Schema.u8, 20),
  Internal:        Schema.Enum({
    PoS:           Schema.Unit,
    PosSlashPool:  Schema.Unit,
    Parameters:    Schema.Unit,
    Ibc:           Schema.Unit,
    IbcToken:      Schema.Array(Schema.u8, 20),
    Governance:    Schema.Unit,
    EthBridge:     Schema.Unit,
    EthBridgePool: Schema.Unit,
    Erc20:         Schema.Array(Schema.u8, 20),
    Nut:           Schema.Array(Schema.u8, 20),
    Multitoken:    Schema.Unit,
    Pgf:           Schema.Unit,
    Masp:          Schema.Unit,
  }),
})

const proposalSchemaFields = {
  id:                 Schema.u64,
  content:            Schema.HashMap(Schema.String, Schema.String),
  author:             Schema.String,
  type:               Schema.Enum({
    Default:          Schema.Option(Schema.String),
    PGFSteward:       Schema.HashSet(addRemoveSchema(Schema.String)),
    PGFPayment:       Schema.HashSet(Schema.Enum({
      Continuous:     addRemoveSchema(pgfTargetSchema),
      Retro:          pgfTargetSchema,
    }))
  }),
  voting_start_epoch: Schema.u64,
  voting_end_epoch:   Schema.u64,
  grace_epoch:        Schema.u64,
  //content_json:       Schema.String,
  //status:             Schema.String,
  //result:             Schema.String,
  //total_voting_power: Schema.String,
  //total_yay_power:    Schema.String,
  //total_nay_power:    Schema.String,
}

const ProposalSchema = Schema.Option(Schema.Struct(proposalSchemaFields))

class ProposalData {
  id!:               string
  content!:          string
  author!:           string
  type!:             ProposalType
  votingStartEpoch!: bigint
  votingEndEpoch!:   bigint
  graceEpoch!:       bigint
  //contentJSON!:      string
  //status!:           ProposalStatus
  //result!:           ProposalResult
  //totalVotingPower!: BigNumber
  //totalYayPower!:    BigNumber
  //totalNayPower!:    BigNumber
  constructor (data: ProposalData) {
    Core.assignCamelCase(this, data, Object.keys(proposalSchemaFields))
  }
}

export class Proposal extends ProposalData {
  static deserialize = binary => new this(Borsher.borshDeserialize(ProposalSchema, binary))
  async voteYay () { throw new Error("not implemented") }
  async voteNay () { throw new Error("not implemented") }
  async abstain () { throw new Error("not implemented") }
}
