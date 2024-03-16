import type { Address } from '@fadroma/agent'
import { Core } from '@fadroma/agent'
import { Staking } from '@fadroma/cw'
import { decode, u8, u64, u256, array, set } from '@hackbg/borshest'

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
  commission:    PoSCommissionPair
  state:         unknown
  stake:         bigint
  async fetchDetails (connection: Connection) {
    if (!this.namadaAddress) {
      const addressBinary = await connection.abciQuery(`/vp/pos/validator_by_tm_addr/${this.address}`)
      this.namadaAddress = connection.decode.address(addressBinary.slice(1))
    }
    const requests: Array<Promise<unknown>> = [
      connection.abciQuery(`/vp/pos/validator/metadata/${this.namadaAddress}`)
        .then(binary => this.metadata   = new PoSValidatorMetadata(connection.decode.pos_validator_metadata(binary))),
      connection.abciQuery(`/vp/pos/validator/commission/${this.namadaAddress}`)
        .then(binary => this.commission = new PoSCommissionPair(connection.decode.pos_commission_pair(binary))),
      connection.abciQuery(`/vp/pos/validator/state/${this.namadaAddress}`)
        .then(binary => this.state      = connection.decode.pos_validator_state(binary)),
      connection.abciQuery(`/vp/pos/validator/stake/${this.namadaAddress}`)
        .then(binary => this.stake      = decode(u256, binary)),
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

class PoSCommissionPair {
  commissionRate:              bigint
  maxCommissionChangePerEpoch: bigint
  constructor (properties: Partial<PoSCommissionPair> = {}) {
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
  PoSCommissionPair    as CommissionPair,
}

type Connection = {
  log: Core.Console,
  abciQuery: (path: string)=>Promise<Uint8Array>
  tendermintClient
  decode: {
    address                (binary: Uint8Array): string
    addresses              (binary: Uint8Array): string[]
    address_to_amount      (binary: Uint8Array): object
    pos_parameters         (binary: Uint8Array): Partial<PoSParameters>
    pos_validator_metadata (binary: Uint8Array): Partial<PoSValidatorMetadata>
    pos_commission_pair    (binary: Uint8Array): Partial<PoSCommissionPair>
    pos_validator_state    (binary: Uint8Array): string
    pos_validator_set      (binary: Uint8Array): Array<{
      address:     string,
      bondedStake: bigint,
    }>
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
  return connection.decode.addresses(binary)
}

const addrSetSchema = set(array(21, u8))

const byBondedStake = (a, b)=> (a.bondedStake > b.bondedStake) ? -1
  : (a.bondedStake < b.bondedStake) ?  1
  : 0

export async function getValidatorsConsensus (connection: Connection) {
  const binary = await connection.abciQuery("/vp/pos/validator_set/consensus")
  return connection.decode.pos_validator_set(binary).sort(byBondedStake)
}

export async function getValidatorsBelowCapacity (connection: Connection) {
  const binary = await connection.abciQuery("/vp/pos/validator_set/below_capacity")
  return connection.decode.pos_validator_set(binary).sort(byBondedStake)
}

export async function getValidator (connection: Connection, address: Address) {
  return await PoSValidator.fromNamadaAddress(address).fetchDetails(connection)
}

export async function getValidatorStake (connection: Connection, address: Address) {
  const totalStake = await connection.abciQuery(`/vp/pos/validator/stake/${address}`)
  return decode(u256, totalStake)
}

export async function getDelegations (connection: Connection, address: Address) {
  const binary = await connection.abciQuery(`/vp/pos/delegations/${address}`)
  return connection.decode.addresses(binary)
}

export async function getDelegationsAt (
  connection: Connection, address: Address, epoch?: number
): Promise<Record<string, bigint>> {
  let query = `/vp/pos/delegations_at/${address}`
  epoch = Number(epoch)
  if (!isNaN(epoch)) {
    query += `/${epoch}`
  }
  const binary = await connection.abciQuery(query)
  return connection.decode.address_to_amount(binary) as Record<string, bigint>
}
