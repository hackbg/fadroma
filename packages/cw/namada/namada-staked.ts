import * as Borsher from 'borsher'
import type { Address } from '@fadroma/agent'
import { Core } from '@fadroma/agent'
import { addressSchema, InternalAddresses, decodeAddress } from './namada-address'
import type { Address as NamadaAddress } from './namada-address'
import { u256Schema, decodeU256, decodeU256Fields } from './namada-u256'
import { schemaEnum } from './namada-enum'
import * as Staking from '../cw-staking'

const Schema = Borsher.BorshSchema

type Connection = {
  log: Core.Console,
  abciQuery: (path: string, args?: Uint8Array) => Promise<Uint8Array>
  tendermintClient: Promise<{ validators, validatorsAll }>
};

export async function getStakingParameters (connection: Connection) {
  const binary = await connection.abciQuery("/vp/pos/pos_params")
  return PosParams.fromBorsh(binary)
}

export class PosParams {
  static fromBorsh = binary => new this(Borsher.borshDeserialize(posParamsSchema, binary))
  maxProposalPeriod: bigint
  owned:             OwnedPosParams
  constructor (data: Partial<PosParams> = {}) {
    Core.assignCamelCase(this, data, [
      "max_proposal_period",
      "owned"
    ])
    if (!(this.owned instanceof OwnedPosParams)) {
      this.owned = new OwnedPosParams(this.owned)
    }
  }
}

class OwnedPosParams {
  maxValidatorSlots!:             bigint
  pipelineLen!:                   bigint
  unbondingLen!:                  bigint
  tmVotesPerToken!:               bigint
  blockProposerReward!:           bigint
  blockVoteReward!:               bigint
  maxInflationRate!:              bigint
  targetStakedRatio!:             bigint
  duplicateVoteMinSlashRate!:     bigint
  lightClientAttackMinSlashRate!: bigint
  cubicSlashingWindowLength!:     bigint
  validatorStakeThreshold!:       bigint
  livenessWindowCheck!:           bigint
  livenessThreshold!:             bigint
  rewardsGainP!:                  bigint
  rewardsGainD!:                  bigint
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

export async function getValidators (
  connection: Connection,
  options: Partial<Parameters<typeof Staking.getValidators>[1]> & {
    addresses?: string[],
    allStates?: boolean
  } = {}
) {
  if (options.allStates) {
    let { addresses } = options
    addresses ??= await getValidatorAddresses(connection)
    if (options.pagination && (options.pagination as Array<number>).length !== 0) {
      if (options.pagination.length !== 2) {
        throw new Error("pagination format: [page, per_page]")
      }
      const [page, perPage] = options.pagination
      addresses = addresses.slice((page - 1)*perPage, page*perPage)
    }
    const validators = addresses.map(address=>NamadaValidator.fromNamadaAddress(address))
    if (options.details) {
      if (!options.pagination) {
        throw new Error("set pagination to not bombard the node")
      }
      await Promise.all(validators.map(validator=>validator.fetchDetails(connection)))
    }
    return validators
  } else {
    if (options.addresses) {
      throw new Error("addresses option is only for caching with allStates")
    }
    return Staking.getValidators(connection, {
      ...options, Validator: NamadaValidator
    }) as unknown as Promise<NamadaValidator[]>
  }
}

export class NamadaValidator extends Staking.Validator {
  static fromNamadaAddress = (namadaAddress: string) => Object.assign(new this({}), { namadaAddress })
  namadaAddress!: Address
  metadata!:      ValidatorMetaData
  commission!:    CommissionPair
  state!:         unknown
  stake!:         bigint
  async fetchDetails (connection: Connection) {
    if (!this.namadaAddress) {
      const addressBinary = await connection.abciQuery(`/vp/pos/validator_by_tm_addr/${this.address}`)
      this.namadaAddress = decodeAddress(addressBinary.slice(1))
    }
    const requests = [
      connection.abciQuery(`/vp/pos/validator/metadata/${this.namadaAddress}`)
        .then(binary => this.metadata   = ValidatorMetaData.fromBorsh(binary)),
      connection.abciQuery(`/vp/pos/validator/commission/${this.namadaAddress}`)
        .then(binary => this.commission = CommissionPair.fromBorsh(binary)),
      connection.abciQuery(`/vp/pos/validator/state/${this.namadaAddress}`)
        .then(binary => this.state      = Borsher.borshDeserialize(stateSchema, binary)),
      connection.abciQuery(`/vp/pos/validator/stake/${this.namadaAddress}`)
        .then(binary => this.stake      = decodeU256(Borsher.borshDeserialize(stakeSchema, binary))),
    ]
    if (this.namadaAddress && !this.publicKey) {
      requests.push(connection.abciQuery(`/vp/pos/validator/consensus_key/${this.namadaAddress}`)
        .then(binary => this.publicKey  = Core.base16.encode(binary.slice(1))))
    }
    if (this.namadaAddress && !this.address) {
      connection.log.warn("consensus address when fetching all validators: not implemented")
    }
    await Promise.all(requests)
    return this
  }
  print (console = new Core.Console()) {
    console
      .log('Validator:      ', Core.bold(this.namadaAddress))
      .log('  Address:      ', Core.bold(this.address))
      .log('  Public key:   ', Core.bold(this.publicKey))
      .log('  State:        ', Core.bold(Object.keys(this.state)[0]))
      .log('  Stake:        ', Core.bold(this.stake))
      .log('  Voting power: ', Core.bold(this.votingPower))
      .log('  Priority:     ', Core.bold(this.proposerPriority))
      .log('  Commission:   ', Core.bold(this.commission.commissionRate))
      .log('    Max change: ', Core.bold(this.commission.maxCommissionChangePerEpoch), 'per epoch')
      .log('Email:          ', Core.bold(this.metadata?.email||''))
      .log('Website:        ', Core.bold(this.metadata?.website||''))
      .log('Discord:        ', Core.bold(this.metadata?.discordHandle||''))
      .log('Avatar:         ', Core.bold(this.metadata?.avatar||''))
      .log('Description:    ', Core.bold(this.metadata?.description||''))
  }
}

export async function getValidatorAddresses (connection: Connection): Promise<Address[]> {
  const binary = await connection.abciQuery("/vp/pos/validator/addresses")
  return [...Borsher.borshDeserialize(getValidatorsSchema, binary) as Set<Array<number>>]
    .map(bytes=>decodeAddress(bytes))
}

const getValidatorsSchema = Schema.HashSet(addressSchema)

export async function getValidatorsConsensus (connection: Connection) {
  const binary = await connection.abciQuery("/vp/pos/validator_set/consensus")
  return [...Borsher.borshDeserialize(validatorSetSchema, binary) as Set<{
    bonded_stake: number[],
    address:      number[],
  }>].map(({bonded_stake, address})=>({
    address:     decodeAddress(address),
    bondedStake: decodeU256(bonded_stake)
  })).sort((a, b)=> (a.bondedStake > b.bondedStake) ? -1
                  : (a.bondedStake < b.bondedStake) ?  1
                  : 0)
}

export async function getValidatorsBelowCapacity (connection: Connection) {
  const binary = await connection.abciQuery("/vp/pos/validator_set/below_capacity")
  return [...Borsher.borshDeserialize(validatorSetSchema, binary) as Set<{
    bonded_stake: number[],
    address:      number[],
  }>].map(({bonded_stake, address})=>({
    address:     decodeAddress(address),
    bondedStake: decodeU256(bonded_stake)
  })).sort((a, b)=> (a.bondedStake > b.bondedStake) ? -1
                  : (a.bondedStake < b.bondedStake) ?  1
                  : 0)
}

const validatorSetMemberFields = {
  bonded_stake: u256Schema,
  address:      addressSchema,
}

const validatorSetSchema = Schema.HashSet(Schema.Struct(validatorSetMemberFields))

export async function getValidator (connection: Connection, address: Address) {
  return await NamadaValidator.fromNamadaAddress(address).fetchDetails(connection)
}

export async function getValidatorStake(connection: Connection, address: Address) {
  const totalStake = await connection.abciQuery(`/vp/pos/validator/stake/${address}`)
  return Borsher.borshDeserialize(validatorStakeSchema, totalStake)
}

const validatorStakeSchema = Schema.Option(Schema.Struct({ stake: Schema.u128 }))

export class ValidatorMetaData {
  static fromBorsh = binary => new this(Borsher.borshDeserialize(validatorMetaDataSchema, binary))
  email:         string
  description:   string|null
  website:       string|null
  discordHandle: string|null
  avatar:        string|null
  constructor (data: Partial<ValidatorMetaData> = {}) {
    if (data) {
      Core.assignCamelCase(this, data, Object.keys(validatorMetaDataSchemaFields))
    }
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

const stateSchema = Schema.Option(schemaEnum([
  ['Consensus',      Schema.Unit],
  ['BelowCapacity',  Schema.Unit],
  ['BelowThreshold', Schema.Unit],
  ['Inactive',       Schema.Unit],
  ['Jailed',         Schema.Unit],
]))

const stakeSchema = Schema.Option(u256Schema)

const consensusKeySchema = Schema.Option(schemaEnum([
  ['Ed25519',   Schema.Array(Schema.u8, 32)],
  ['Secp256k1', Schema.Array(Schema.u8, 33)],
]))
