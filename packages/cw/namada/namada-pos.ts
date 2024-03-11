import * as Borsher from 'borsher'
import type { Address } from '@fadroma/agent'
import { Core } from '@fadroma/agent'
import { addressSchema, InternalAddresses, decodeAddress } from './namada-address'
import type { Address as NamadaAddress } from './namada-address'
import {
  Schema,
  i256Schema,
  decodeU256,
  decodeU256Fields
} from './namada-types'
import type { NamadaConnection } from './namada-connection'
import * as Staking from '../cw-staking'
import {
  decode, Struct, u8, u64, u128, u256, i256, option, struct, variants, unit, string, array, set
} from '@hackbg/borshest'
import type {
  AnyField
} from '@hackbg/borshest'

export async function getStakingParameters (connection: NamadaConnection) {
  const binary = await connection.abciQuery("/vp/pos/pos_params")
  return PosParams.decode(binary) as PosParams
}

const ownedPosParamsFields: Array<[string, AnyField]> = [
  ["maxValidatorSlots",             u64],
  ["pipelineLen",                   u64],
  ["unbondingLen",                  u64],
  ["tmVotesPerToken",               u256],
  ["blockProposerReward",           u256],
  ["blockVoteReward",               u256],
  ["maxInflationRate",              u256],
  ["targetStakedRatio",             u256],
  ["duplicateVoteMinSlashRate",     u256],
  ["lightClientAttackMinSlashRate", u256],
  ["cubicSlashingWindowLength",     u64],
  ["validatorStakeThreshold",       u256],
  ["livenessWindowCheck",           u64],
  ["livenessThreshold",             u256],
  ["rewardsGainP",                  u256],
  ["rewardsGainD",                  u256],
]

export class PosParams extends Struct([
  ["owned", struct(...ownedPosParamsFields)],
  ["maxProposalPeriod", u64],
]) {
  declare maxProposalPeriod: bigint
  declare owned:             OwnedPosParams
  constructor (data) {
    super(data)
    if (!(this.owned instanceof OwnedPosParams)) {
      this.owned = new OwnedPosParams(this.owned)
    }
  }
}

class OwnedPosParams extends Struct(ownedPosParamsFields) {
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
}

export async function getTotalStaked (connection: NamadaConnection) {
  const binary = await connection.abciQuery("/vp/pos/total_stake")
  return decode(totalStakeSchema, binary)
}

const totalStakeSchema = struct([ "totalStake", u64 ])

export async function getValidators (
  connection: NamadaConnection,
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
  async fetchDetails (connection: NamadaConnection) {
    if (!this.namadaAddress) {
      const addressBinary = await connection.abciQuery(`/vp/pos/validator_by_tm_addr/${this.address}`)
      this.namadaAddress = decodeAddress(addressBinary.slice(1))
    }
    const requests = [
      connection.abciQuery(`/vp/pos/validator/metadata/${this.namadaAddress}`)
        .then(binary => this.metadata   = ValidatorMetaData.decode(binary) as ValidatorMetaData),
      connection.abciQuery(`/vp/pos/validator/commission/${this.namadaAddress}`)
        .then(binary => this.commission = CommissionPair.decode(binary) as CommissionPair),
      connection.abciQuery(`/vp/pos/validator/state/${this.namadaAddress}`)
        .then(binary => this.state      = decode(stateSchema, binary)),
      connection.abciQuery(`/vp/pos/validator/stake/${this.namadaAddress}`)
        .then(binary => this.stake      = decodeU256(decode(stakeSchema, binary))),
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
      .log('  State:        ', Core.bold(Object.keys(this.state as object)[0]))
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

export async function getValidatorAddresses (connection: NamadaConnection): Promise<Address[]> {
  const binary = await connection.abciQuery("/vp/pos/validator/addresses")
  return [...decode(getValidatorsSchema, binary) as Set<Array<number>>]
    .map(bytes=>decodeAddress(bytes))
}

const getValidatorsSchema = set(addressSchema)

export async function getValidatorsConsensus (connection: NamadaConnection) {
  const binary = await connection.abciQuery("/vp/pos/validator_set/consensus")
  return [...decode(validatorSetSchema, binary) as Set<{
    bonded_stake: number[],
    address:      number[],
  }>].map(({bonded_stake, address})=>({
    address:     decodeAddress(address),
    bondedStake: decodeU256(bonded_stake)
  })).sort((a, b)=> (a.bondedStake > b.bondedStake) ? -1
                  : (a.bondedStake < b.bondedStake) ?  1
                  : 0)
}

export async function getValidatorsBelowCapacity (connection: NamadaConnection) {
  const binary = await connection.abciQuery("/vp/pos/validator_set/below_capacity")
  return [...decode(validatorSetSchema, binary) as Set<{
    bonded_stake: number[],
    address:      number[],
  }>].map(({bonded_stake, address})=>({
    address:     decodeAddress(address),
    bondedStake: decodeU256(bonded_stake)
  })).sort((a, b)=> (a.bondedStake > b.bondedStake) ? -1
                  : (a.bondedStake < b.bondedStake) ?  1
                  : 0)
}

const validatorSetMemberFields: Array<[string, AnyField]> = [
  ["bonded_stake", u256],
  ["address",      addressSchema],
]

const validatorSetSchema = set(struct(...validatorSetMemberFields))

export async function getValidator (connection: NamadaConnection, address: Address) {
  return await NamadaValidator.fromNamadaAddress(address).fetchDetails(connection)
}

export async function getValidatorStake(connection: NamadaConnection, address: Address) {
  const totalStake = await connection.abciQuery(`/vp/pos/validator/stake/${address}`)
  return decode(validatorStakeSchema, totalStake)
}

const validatorStakeSchema = option(struct([ "stake", u128 ]))

export class ValidatorMetaData extends Struct(
  ["email",          string],
  ["description",    option(string)],
  ["website",        option(string)],
  ["discord_handle", option(string)],
  ["avatar",         option(string)],
) {
  email!:         string
  description!:   string|null
  website!:       string|null
  discordHandle!: string|null
  avatar!:        string|null
}

export class CommissionPair extends Struct(
  ["commission_rate",                 u256],
  ["max_commission_change_per_epoch", u256],
) {
  commissionRate!:              bigint
  maxCommissionChangePerEpoch!: bigint
  constructor (data) {
    super(data)
    decodeU256Fields(this, [
      'commissionRate',
      'maxCommissionChangePerEpoch',
    ])
  }
}

const stateSchema = option(variants(
  ['Consensus',      unit],
  ['BelowCapacity',  unit],
  ['BelowThreshold', unit],
  ['Inactive',       unit],
  ['Jailed',         unit],
))

const stakeSchema = option(u256)

const publicKeySchema = option(variants(
  ['Ed25519',   array(32, u8)],
  ['Secp256k1', array(33, u8)],
))

export class BecomeValidator extends Struct(
  ["address",                    addressSchema],
  ["consensus_key",              publicKeySchema],
  ["eth_cold_key",               publicKeySchema],
  ["eth_hot_key",                publicKeySchema],
  ["protocol_key",               publicKeySchema],
  ["commission_rate",            u256],
  ["max_commission_rate_change", u256],
  ["email",                      string],
  ["description",                option(string)],
  ["website",                    option(string)],
  ["discord_handle",             option(string)],
  ["avatar",                     option(string)],
) {
  address
  consensusKey
  ethColdKey
  ethHotKey
  protocolKey
  commissionRate
  maxCommissionRateChange
  email
  description
  website
  discordHandle
  avatar
}

export class Bond extends Struct(
  ["validator", addressSchema],
  ["amount",    u256],
  ["source",    option(addressSchema)],
) {
  validator: Address
  amount:    bigint
  source:    null|Address
}

export class ClaimRewards extends Struct(
  ["validator", addressSchema],
  ["source",    option(addressSchema)],
) {
  validator: Address
  source:    null|Address
}

export class ConsensusKeyChange extends Struct(
  ["validator",     addressSchema],
  ["consensus_key", publicKeySchema],
) {
  validator:     Address
  consensusKey:  unknown
}

export class CommissionChange extends Struct(
  ["validator", addressSchema],
  ["new_rate",  i256Schema],
) {
  validator: Address
  newRate:   bigint
}

export class MetaDataChange extends Struct(
  ["validator",       addressSchema],
  ["email",           option(string)],
  ["description",     option(string)],
  ["website",         option(string)],
  ["discord_handle",  option(string)],
  ["avatar",          option(string)],
  ["commission_rate", option(i256)],
) {
  validator:      Address
  email:          null|string
  description:    null|string
  website:        null|string
  discordHandle:  null|string
  avatar:         null|string
  commissionRate: null|string
}

export class Redelegation extends Struct(
  ["src_validator",  addressSchema],
  ["dest_validator", addressSchema],
  ["owner",          addressSchema],
  ["amount",         i256Schema],
) {
  srcValidator:   Address
  destValidator:  Address
  owner:          Address
  amount:         bigint
}

export class Unbond extends Struct() {}

export class Withdraw extends Struct(
  ["validator", addressSchema],
  ["source",    option(addressSchema)],
) {
  validator: Address
  source:    null|Address
}

export class DeactivateValidator extends Struct() {}

export class ReactivateValidator extends Struct() {}

export class UnjailValidator extends Struct() {}
