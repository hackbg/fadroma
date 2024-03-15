import type { Address } from '@fadroma/agent'
import { Core } from '@fadroma/agent'
import { addr, InternalAddresses, decodeAddress } from './namada-address'
import type { Address as NamadaAddress } from './namada-address'
import { Staking } from '@fadroma/cw'
import { decode, u64 } from '@hackbg/borshest'
  //decode, Struct, u8, u64, u128, u256, i256, option, struct, variants, unit, string, array, set
//} from '@hackbg/borshest'
//import type {
  //AnyField
//} from '@hackbg/borshest'

class PoSParameters {
  maxProposalPeriod:             bigint
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
  constructor (properties: Partial<PoSParameters> = {}) {
    Core.assign(this, properties, [
      'maxProposalPeriod',
      'maxValidatorSlots',
      'pipelineLen',
      'unbondingLen',
      'tmVotesPerToken',
      'blockProposerReward',
      'blockVoteReward',
      'maxInflationRate',
      'targetStakedRatio',
      'duplicateVoteMinSlashRate',
      'lightClientAttackMinSlashRate',
      'cubicSlashingWindowLength',
      'validatorStakeThreshold',
      'livenessWindowCheck',
      'livenessThreshold',
      'rewardsGainP',
      'rewardsGainD',
    ])
  }
}

class PoSValidatorMetadata {
  email:         string
  description:   string|null
  website:       string|null
  discordHandle: string|null
  avatar:        string|null
  constructor (properties: Partial<PoSValidatorMetadata>) {
    Core.assign(this, properties, [
      'email',
      'description',
      'website',
      'discordHandle',
      'avatar',
    ])
  }
}

class PoSValidator extends Staking.Validator {
  static fromNamadaAddress = (namadaAddress: string) => Object.assign(new this({}), { namadaAddress })
  namadaAddress: Address
  metadata:      PoSValidatorMetadata
  commission:    CommissionPair
  state:         unknown
  stake:         bigint
  async fetchDetails (connection: Connection) {
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
        .then(binary => this.stake      = decode(stakeSchema, binary)),
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
}

export class CommissionPair {
  commissionRate:              bigint
  maxCommissionChangePerEpoch: bigint
  constructor (properties: Partial<CommissionPair> = {}) {
    Core.assign(this, properties, [
      'commissionRate',
      'maxCommissionChangePerEpoch',
    ])
  }
}

export {
  PoSParameters        as Parameters,
  PoSValidatorMetadata as ValidatorMetadata,
  PoSValidator         as Validator,
}

type Connection = {
  log: Core.Console,
  abciQuery: (path: string)=>Promise<Uint8Array>
  decode: {
    pos_parameters         (binary: Uint8Array): Partial<PoSParameters>,
    pos_validator_metadata (binary: Uint8Array): Partial<PoSValidatorMetadata>
  }
}

export async function getStakingParameters (connection: Connection) {
  const binary = await connection.abciQuery("/vp/pos/pos_params")
  return new PoSParameters(connection.decode.pos_parameters(binary))
}

export async function getTotalStaked (connection: Connection) {
  const binary = await connection.abciQuery("/vp/pos/total_stake")
  return decode(u64, binary)
}

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
    const validators = addresses.map(address=>PoSValidator.fromNamadaAddress(address))
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
      ...options, Validator: PoSValidator
    }) as unknown as Promise<PoSValidator[]>
  }
}

export async function getValidatorAddresses (connection: Connection): Promise<Address[]> {
  const binary = await connection.abciQuery("/vp/pos/validator/addresses")
  return [...decode(getValidatorsSchema, binary) as Set<Array<number>>]
    .map(bytes=>decodeAddress(bytes))
}

//const getValidatorsSchema = set(addr)

export async function getValidatorsConsensus (connection: Connection) {
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

export async function getValidatorsBelowCapacity (connection: Connection) {
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

export async function getValidator (connection: Connection, address: Address) {
  return await PoSValidator.fromNamadaAddress(address).fetchDetails(connection)
}

export async function getValidatorStake(connection: Connection, address: Address) {
  const totalStake = await connection.abciQuery(`/vp/pos/validator/stake/${address}`)
  return decode(validatorStakeSchema, totalStake)
}
