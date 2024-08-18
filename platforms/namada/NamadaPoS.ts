import type { Address } from '@hackbg/fadroma'
import { Console, assign, base16, optionallyParallel} from '@hackbg/fadroma'
import { Staking } from '@fadroma/cw'
import { decode, u8, u64, u256, array, set } from '@hackbg/borshest'
import type {
  Chain as Namada,
  Connection as NamadaConnection
} from './Namada'

export type Params = Awaited<ReturnType<typeof fetchStakingParameters>>

export async function fetchStakingParameters (connection: NamadaConnection) {
  const binary = await connection.abciQuery("/vp/pos/pos_params")
  return connection.decode.pos_parameters(binary)
}

export async function fetchTotalStaked (connection: NamadaConnection) {
  const binary = await connection.abciQuery("/vp/pos/total_stake")
  return decode(u64, binary)
}

class NamadaValidator extends Staking.Validator {
  constructor (properties: Omit<ConstructorParameters<typeof Staking.Validator>[0], 'chain'> & {
    chain: Namada, namadaAddress?: string,
  }) {
    super(properties)
    this.namadaAddress = properties.namadaAddress
  }

  get chain (): Namada { return super.chain as unknown as Namada }

  namadaAddress?:                 Address
  metadata?: {
    name?:                        string
    email?:                       string
    description?:                 string|null
    website?:                     string|null
    discordHandle?:               string|null
    avatar?:                      string|null
  }
  commission?: {
    commissionRate?:              bigint
    maxCommissionChangePerEpoch?: bigint
  }
  state?: {
    state?:                       string,
    epoch?:                       bigint,
  }
  stake?:                         bigint
  bondedStake?:                   bigint|number

  async fetchDetails (options?: { parallel?: boolean }) {
    await fetchValidatorDetails(this.chain.getConnection(), {
      ...options, validator: this
    })
    return this
  }
}

export { NamadaValidator as Validator }

export async function fetchValidators (
  connection: NamadaConnection,
  options: Partial<Parameters<typeof Staking.getValidators>[1]> & {
    tendermintMetadata?: 'parallel'|'sequential'|boolean
    namadaMetadata?:     'parallel'|'sequential'|boolean
  } = {}
): Promise<NamadaValidator[]> {
  // This will be the return value: map of Namada address to validator details object.
  const validatorsByNamadaAddress: Record<string, NamadaValidator> = {}

  // This is the full list of validators known to the chain.
  // However, it contains no other data than the identifier.
  // The rest we will have to piece together ourselves.
  const namadaAddresses = await fetchValidatorAddresses(connection)
  for (const namadaAddress of namadaAddresses) {
    validatorsByNamadaAddress[namadaAddress] = new NamadaValidator({
      chain:     connection.chain,
      publicKey: null as any, // FIXME: explicitly state nullability
      address:   null as any, // FIXME: in the type definition
      namadaAddress
    })
  }

  // This is how we will store the public keys. This needs to be done only once,
  // either when fetching Tendermint metadata or when fetching Namada metadata.
  // The public keys corresponding to each Namada address have to be ABCI-queries,
  // one by one. Doing this in parallel can crash the nodes. There's an option to
  // avoid that, but IMHO it should be fixed upstream. On our side, an improvement
  // to this would constitute a rate limiter, allowing a precise number of parallel
  // requests to be specified.
  let publicKeys: Record<string, string>|null = null
  const fetchAndPopulatePublicKeys = async (parallel = false) => Object.fromEntries(
    await optionallyParallel(parallel, namadaAddresses.map(addr => async () => {
      const binary = await connection.abciQuery(`/vp/pos/validator/consensus_key/${addr}`)
      const publicKey = base16.encode(binary.slice(2))
      validatorsByNamadaAddress[addr].publicKey = publicKey
      return [addr, publicKey]
    })))

  // This will fetch the generic "list of all validators" metadata, which is provided by
  // Namada's Tendermint core, and is therefore not behind an ABCI query. It contains
  // consensus address, public key, voting power, and proposer priority. However,
  // it only contains those validators which are currently active (state = consensus).
  // Other validators don't have these values, and if you need to e.g. cross-reference
  // by past public key or consensus address, you will have to persist them yourself.
  // (https://github.com/hackbg/undexer does that)
  if (options?.tendermintMetadata ?? true) {
    publicKeys ??= await fetchAndPopulatePublicKeys(options.tendermintMetadata === 'parallel')
    const tendermintMetadata = (await Staking.getValidators(connection, { ...options||{} }))
      // `getValidators` returns an array, so we rekey it by public key.
      // (Identifier rebinding would have been really nice here.)
      .reduce((vs, v)=>Object.assign(vs, {[v.publicKey]: v}), {}) as Record<string, {
        address:          string,
        publicKey:        string,
        votingPower:      bigint,
        proposerPriority: bigint,
      }>
    // Now we can populate the validators with the Tendermint metadata corresponding to
    // each validator's public key.
    for (const [namadaAddress, validator] of Object.entries(validatorsByNamadaAddress)) {
      if (validator.publicKey) {
        const publicKey = validator.publicKey
        const validatorTendermintMetadata = tendermintMetadata[validator.publicKey]
        if (validatorTendermintMetadata) {
          validator.address          = tendermintMetadata[validator.publicKey].address
          validator.publicKey        = tendermintMetadata[validator.publicKey].publicKey
          validator.votingPower      = tendermintMetadata[validator.publicKey].votingPower
          validator.proposerPriority = tendermintMetadata[validator.publicKey].proposerPriority
        } else {
          connection.log.info(
            'Missing metadata for validator with public key',
            publicKey,
            ' - this is usually fine and means validator is outside consensus'
          )
        }
      } else {
        connection.log.warn(
          'Missing publicKey for validator with address',
          namadaAddress,
          ' - this should not happen and means something is failing.'
        )
      }
    }
  }

  // This will fetch the Namada-specific metadata. It persists for validators even when they
  // leave consensus. However, it's spread between multiple ABCI queries. Sending 4-5x queries
  // per validator, all at once, is a good way to crash underprovisioned nodes.
  if (options?.namadaMetadata ?? true) {
    publicKeys ??= await fetchAndPopulatePublicKeys(options.namadaMetadata === 'parallel')
    // This generates a warning handler for each request.
    const warn = (...args: Parameters<typeof connection["log"]["warn"]>) => (e: Error) =>
      connection.log.warn(...args, e.message)
    // This generates the requests for fetching each validator's metadata, as well as
    // state, stake, and commission values, but does not yet execute them.
    const requests = (validator: NamadaValidator) => [
      () => {
        throw new Error('TODO: fetch single validator')
      },
      () => connection.abciQuery(`/vp/pos/validator/commission/${validator.namadaAddress}`)
        .then(binary => validator.commission = connection.decode.pos_commission_pair(binary))
        .catch(warn(`Failed to provide validator commission pair for ${validator.namadaAddress}`)),
      () => connection.abciQuery(`/vp/pos/validator/state/${validator.namadaAddress}`)
        .then(binary => validator.state = connection.decode.pos_validator_state(binary))
        .catch(warn(`Failed to provide validator state for ${validator.namadaAddress}`)),
      () => connection.abciQuery(`/vp/pos/validator/stake/${validator.namadaAddress}`)
        .then(binary => binary[0] && (validator.stake = decode(u256, binary.slice(1))))
        .catch(warn(`Failed to provide validator stake for ${validator.namadaAddress}`)),
      () => connection.abciQuery(`/vp/pos/validator/metadata/${validator.namadaAddress}`)
        .then(binary =>binary[0] && (
          validator.metadata = connection.decode.pos_validator_metadata(binary.slice(1))
        ))
        .catch(warn(`Failed to provide validator metadata for ${validator.namadaAddress}`)),
    ] as Array<()=>Promise<unknown>>
    // Since this is a *lot* of requests, the parallel/sequential switch only determines
    // whether to do each validator's group of 4 requests simultaneously or sequentially;
    // iteration over all validators is always sequential.
    for (const validator of Object.values(validatorsByNamadaAddress)) {
      await optionallyParallel(options.namadaMetadata === 'parallel', requests(validator))
    }
  }

  return Object.values(validatorsByNamadaAddress)
}

/** Generator implementation of fetchValidators. */
export async function * fetchValidatorsIter (
  connection: NamadaConnection,
  options?: { parallel?: boolean }
) {
  const namadaAddresses = await fetchValidatorAddresses(connection)
  const tendermintMetadata = (await Staking.getValidators(connection)).reduce((vs, v)=>
    Object.assign(vs, {[v.publicKey]: v}), {}) as Record<string, {
      address:          string
      publicKey:        string
      votingPower:      bigint
      proposerPriority: bigint
    }>
  for (const addr of namadaAddresses) {
    const validator = new NamadaValidator({
      chain:         connection.chain,
      publicKey:     null as any, // FIXME: explicitly state nullability
      address:       null as any, // FIXME: in the type definition
      namadaAddress: addr
    })
    const warn = (...args: Parameters<typeof connection["log"]["warn"]>) =>
      (e: Error) => connection.log.warn(...args)
    const requests: Array<()=>Promise<unknown>> = [
      () => connection.abciQuery(`/vp/pos/validator/metadata/${addr}`)
        .then(binary =>binary[0] && (validator.metadata = connection.decode.pos_validator_metadata(binary.slice(1))))
        .catch(warn(`Failed to provide validator metadata for ${addr}`)),

      () => connection.abciQuery(`/vp/pos/validator/commission/${addr}`)
        .then(binary => validator.commission = connection.decode.pos_commission_pair(binary))
        .catch(warn(`Failed to provide validator commission pair for ${addr}`)),

      () => connection.abciQuery(`/vp/pos/validator/state/${addr}`)
        .then(binary => validator.state = connection.decode.pos_validator_state(binary))
        .catch(warn(`Failed to provide validator state for ${addr}`)),

      () => connection.abciQuery(`/vp/pos/validator/stake/${addr}`)
        .then(binary => binary[0] && (validator.stake = decode(u256, binary.slice(1))))
        .catch(warn(`Failed to provide validator stake for ${addr}`)),

      () => connection.abciQuery(`/vp/pos/validator/consensus_key/${addr}`)
        .then(binary => {
          validator.publicKey = base16.encode(binary.slice(2))
          Object.assign(validator, tendermintMetadata[validator.publicKey] || {})
        })
        .catch(
          warn(`Failed to decode validator public key for ${addr}`)
        )
      ]
    await optionallyParallel(options?.parallel, requests)
    yield validator
  }
}

export async function fetchValidatorAddresses (connection: NamadaConnection): Promise<Address[]> {
  const binary = await connection.abciQuery("/vp/pos/validator/addresses")
  return connection.decode.addresses(binary)
}

export async function fetchValidatorDetails (
  connection: NamadaConnection,
  options?:   { parallel?: boolean, validator?: Partial<NamadaValidator> }
) {
  const validator = options?.validator || {}

  if (!validator.namadaAddress) {
    if (!validator.address) {
      throw new Error('missing tendermint or namada address for validator')
    }
    const addressBinary = await connection.abciQuery(`/vp/pos/validator_by_tm_addr/${validator.address}`)
    validator.namadaAddress = connection.decode.address(addressBinary.slice(1))
    connection.log.info(validator.address, 'is', validator.namadaAddress)
  }
  const v = validator.namadaAddress
  const warn = (...args: Parameters<typeof connection["log"]["warn"]>) =>
    (e: Error) => connection.log.warn(...args)
  const requests: Array<()=>Promise<unknown>> = [
    () => connection.abciQuery(`/vp/pos/validator/metadata/${v}`)
      .then(binary =>binary[0] && (validator.metadata = connection.decode.pos_validator_metadata(binary.slice(1))))
      .catch(warn(`Failed to provide validator metadata for ${v}`)),
    () => connection.abciQuery(`/vp/pos/validator/commission/${v}`)
      .then(binary => validator.commission = connection.decode.pos_commission_pair(binary))
      .catch(warn(`Failed to provide validator commission pair for ${v}`)),
    () => connection.abciQuery(`/vp/pos/validator/state/${v}`)
      .then(binary => validator.state = connection.decode.pos_validator_state(binary))
      .catch(warn(`Failed to provide validator state for ${v}`)),
    () => connection.abciQuery(`/vp/pos/validator/stake/${v}`)
      .then(binary => binary[0] && (validator.stake = decode(u256, binary.slice(1))))
      .catch(warn(`Failed to provide validator stake for ${v}`)),
    () => connection.abciQuery(`/vp/pos/validator/consensus_key/${v}`)
      .then(binary => {
        const publicKey = base16.encode(binary.slice(2))
        if (validator.publicKey && (validator.publicKey !== publicKey)) {
          throw Object.assign(new Error(`Fetched different public key for ${v}`), {
            oldPublicKey: validator.publicKey,
            newPublicKey: publicKey
          })
        }
        validator.publicKey = publicKey
      })
      .catch(warn(`Failed to decode validator public key for ${v}`))
  ]
  const prefix = `validator ${v} details: ${requests.length} request(s)`
  if (options?.parallel) {
    connection.log.debug(prefix, `in parallel`)
  } else {
    connection.log.debug(prefix, `in sequence`)
  }
  await optionallyParallel(options?.parallel, requests)
  return validator
}

export async function fetchValidatorsConsensus (connection: NamadaConnection) {
  const binary = await connection.abciQuery("/vp/pos/validator_set/consensus")
  return connection.decode.pos_validator_set(binary).sort(byBondedStake)
}

export async function fetchValidatorsBelowCapacity (connection: NamadaConnection) {
  const binary = await connection.abciQuery("/vp/pos/validator_set/below_capacity")
  return connection.decode.pos_validator_set(binary).sort(byBondedStake)
}

const byBondedStake = (
  a: { bondedStake: number|bigint },
  b: { bondedStake: number|bigint },
)=> (a.bondedStake > b.bondedStake) ? -1
  : (a.bondedStake < b.bondedStake) ?  1
  : 0

export async function fetchValidator (connection: NamadaConnection, namadaAddress: Address) {
  return await new NamadaValidator({
    chain:   connection.chain,
    address: null as any, // FIXME
    namadaAddress
  }).fetchDetails()
}

export async function fetchValidatorStake (connection: NamadaConnection, address: Address) {
  const totalStake = await connection.abciQuery(`/vp/pos/validator/stake/${address}`)
  return decode(u256, totalStake)
}

export async function fetchDelegations (connection: NamadaConnection, address: Address) {
  const binary = await connection.abciQuery(`/vp/pos/delegations/${address}`)
  return connection.decode.addresses(binary)
}

export async function fetchDelegationsAt (
  connection: NamadaConnection, address: Address, epoch?: number
): Promise<Record<string, bigint>> {
  let query = `/vp/pos/delegations_at/${address}`
  epoch = Number(epoch)
  if (!isNaN(epoch)) {
    query += `/${epoch}`
  }
  const binary = await connection.abciQuery(query)
  return connection.decode.address_to_amount(binary) as Record<string, bigint>
}
