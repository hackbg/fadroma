import * as Borsher from 'borsher'
import type { Address } from '@fadroma/agent'
import { Core } from '@fadroma/agent'
import { addressSchema, InternalAddresses } from './namada-address'
import { u256Schema, decodeU256Fields } from './namada-u256'
import { schemaEnum } from './namada-enum'

const Schema = Borsher.BorshSchema

type Connection = { abciQuery: (path: string) => Promise<Uint8Array> };

export async function getStakingParameters (connection: Connection) {
  const binary = await connection.abciQuery("/vp/pos/pos_params")
  return PosParams.fromBorsh(binary)
}

export class PosParams {
  static fromBorsh = binary => new this(Borsher.borshDeserialize(posParamsSchema, binary))
  maxProposalPeriod: bigint
  owned:             OwnedPosParams
  constructor (data: Partial<PosParams> = {}) {
    Core.assignCamelCase(this, data, [ "max_proposal_period", "owned" ])
    if (!(this.owned instanceof OwnedPosParams)) {
      this.owned = new OwnedPosParams(this.owned)
    }
  }
}

class OwnedPosParams {
  maxValidatorSlots:             bigint
  pipelineLen:                   bigint
  unbondingLen:                  bigint
  tmVotesPerToken:               bigint
  blockProposerReward:           bigint
  blockVoteReward:               bigint
  maxInflationRate:              bigint
  targetStakedRatio:             bigint
  duplicateVoteMinSlashRate:     bigint
  lightClientAttackMinSlashRate: bigint
  cubicSlashingWindowLength:     bigint
  validatorStakeThreshold:       bigint
  livenessWindowCheck:           bigint
  livenessThreshold:             bigint
  rewardsGainP:                  bigint
  rewardsGainD:                  bigint
  constructor (data: Partial<OwnedPosParams> = {}) {
    Core.assignCamelCase(this, data, Object.keys(ownedPosParamsFields))
    decodeU256Fields(this, [
      "tmVotesPerToken",
      "blockProposerReward",
      "blockVoteReward",
      "maxInflationRate",
      "targetStakedRatio",
      "duplicateVoteMinSlashRate",
      "lightClientAttackMinSlashRate",
      "validatorStakeThreshold",
      "livenessWindowCheck",
      "livenessThreshold",
      "rewardsGainP",
      "rewardsGainD",
    ])
  }
}

const ownedPosParamsFields = {
  max_validator_slots:                Schema.u64,
  pipeline_len:                       Schema.u64,
  unbonding_len:                      Schema.u64,
  tm_votes_per_token:                 u256Schema,
  block_proposer_reward:              u256Schema,
  block_vote_reward:                  u256Schema,
  max_inflation_rate:                 u256Schema,
  target_staked_ratio:                u256Schema,
  duplicate_vote_min_slash_rate:      u256Schema,
  light_client_attack_min_slash_rate: u256Schema,
  cubic_slashing_window_length:       Schema.u64,
  validator_stake_threshold:          u256Schema,
  liveness_window_check:              Schema.u64,
  liveness_threshold:                 u256Schema,
  rewards_gain_p:                     u256Schema,
  rewards_gain_d:                     u256Schema,
}

const posParamsSchema = Schema.Struct({
  owned: Schema.Struct(ownedPosParamsFields),
  max_proposal_period: Schema.u64,
})

export async function getTotalStaked (connection: Connection) {
  const binary = await connection.abciQuery("/vp/pos/total_stake")
  return Borsher.borshDeserialize(totalStakeSchema, binary)
}

const totalStakeSchema = Schema.Struct({ totalStake: Schema.u64 })

export async function getValidatorMetadata (connection: Connection, address: Address) {
  const [ metadata, commission, state ] = await Promise.all([
    `/vp/pos/validator/metadata/${address}`,
    `/vp/pos/validator/commission/${address}`,
    `/vp/pos/validator/state/${address}`,
  ].map(path => connection.abciQuery(path)))
  return {
    metadata:   ValidatorMetaData.fromBorsh(metadata),
    commission: CommissionPair.fromBorsh(commission),
    state:      Borsher.borshDeserialize(stateSchema, state),
  }
}

export class ValidatorMetaData {
  static fromBorsh = binary => new this(Borsher.borshDeserialize(validatorMetaDataSchema, binary))
  email:         string
  description:   string|null
  website:       string|null
  discordHandle: string|null
  avatar:        string|null
  constructor (data: Partial<ValidatorMetaData> = {}) {
    Core.assignCamelCase(this, data, Object.keys(validatorMetaDataSchemaFields))
  }
}

const validatorMetaDataSchemaFields = {
  email:          Schema.String,
  description:    Schema.Option(Schema.String),
  website:        Schema.Option(Schema.String),
  discord_handle: Schema.Option(Schema.String),
  avatar:         Schema.Option(Schema.String),
}

const validatorMetaDataSchema = Schema.Option(Schema.Struct(
  validatorMetaDataSchemaFields
))

export class CommissionPair {
  static fromBorsh = binary => new this(Borsher.borshDeserialize(commissionPairSchema, binary))
  commissionRate:              bigint
  maxCommissionChangePerEpoch: bigint
  constructor (data: Partial<CommissionPair> = {}) {
    Core.assignCamelCase(this, data, Object.keys(commissionPairSchemaFields))
    decodeU256Fields(this, [
      'commissionRate',
      'maxCommissionChangePerEpoch',
    ])
  }
}

const commissionPairSchemaFields = {
  commission_rate:                 u256Schema,
  max_commission_change_per_epoch: u256Schema,
}

const commissionPairSchema = Schema.Struct(commissionPairSchemaFields)

const stateSchema = schemaEnum([
  ['Consensus',      Schema.Unit],
  ['BelowCapacity',  Schema.Unit],
  ['BelowThreshold', Schema.Unit],
  ['Inactive',       Schema.Unit],
  ['Jailed',         Schema.Unit],
])
