import type { Tendermint, Address } from '../deps.ts'
import type { Deps } from './namada.ts'
import type { Epoch } from './namadaEpoch.ts'
import { Core, base16, decode, u256, getValidators } from '../deps.ts'
/** Describes a Namada validator. */
export type Validator = Tendermint.Validator & {
  readonly namadaAddress?: Address
  readonly metadata?:      ValidatorMetadata
  readonly commission?:    ValidatorCommission
  readonly state?:         ValidatorState
  readonly stake?:         bigint
  readonly bondedStake?:   bigint|number
}
/** Describes the metadata of a Namada validator. */
export type ValidatorMetadata = {
  readonly name?:          string
  readonly email?:         string
  readonly description?:   string|null
  readonly website?:       string|null
  readonly discordHandle?: string|null
  readonly avatar?:        string|null
}
/** Describes the commission rate of a Namada validator. */
export type ValidatorCommission = {
  readonly commissionRate?:              bigint
  readonly maxCommissionChangePerEpoch?: bigint
}
/** Describes the current state of a Namada validator. */
export type ValidatorState = {
  readonly state?: string,
  readonly epoch?: bigint,
}
/** Fetch details about one validator. */
export const fetchValidator = async (
  api: Deps, namadaAddress: Address, options?: { epoch?: Epoch }
) => {
  const validator = { chain: api.chain, address: null as any, namadaAddress }
  return await fetchValidatorDetails(api, {...options, validator})
}
/** Fetch the stake of a given validator. */
export const fetchValidatorStake = async (
  { abciQuery }: Deps, address: Address, epoch?: Epoch,
) => {
  let query = `/vp/pos/validator/stake/${address}`
  if (epoch) query += `/${epoch}`
  const totalStake = await abciQuery(query)
  if (totalStake[0] === 0) return 0
  return decode(u256, totalStake.slice(1))
}
/** Fetch addresses of all known validators. */
export const fetchValidatorAddresses = async (
  { abciQuery, decoder }: Deps, epoch?: Epoch
): Promise<Address[]> => {
  let query = "/vp/pos/validator/addresses"
  if (epoch!==undefined) query += `/${epoch}`
  return decoder.addresses(await abciQuery(query))
}
/** Fetch info about the set of validators currently participating in consensus. */
export async function fetchValidatorsConsensus (
  { abciQuery, decoder }: Deps, epoch?: Epoch
) {
  let query = "/vp/pos/validator_set/consensus"
  if (epoch!==undefined) query += `/${epoch}`
  return decoder.pos_validator_set(await abciQuery(query)).sort(byBondedStake)
}
/** Fetch info about the set of validators currently below capacity. */
export async function fetchValidatorsBelowCapacity (
  { abciQuery, decoder }: Deps, epoch?: Epoch
) {
  let query = "/vp/pos/validator_set/below_capacity"
  if (epoch!==undefined) query += `/${epoch}`
  return decoder.pos_validator_set(await abciQuery(query)).sort(byBondedStake)
}
/** Sorting function by the bondedStake parameter. */
const byBondedStake = (a: {bondedStake: number|bigint}, b: {bondedStake: number|bigint})=>
  (BigInt(a.bondedStake) > BigInt(b.bondedStake)) ? -1
    : (BigInt(a.bondedStake) < BigInt(b.bondedStake)) ?  1
    : 0
/** Fetch details for a Namada validator. */
export const fetchValidatorDetails = async (
  { abciQuery, decoder, log }: Deps,
  options?: { epoch?: Epoch, parallel?: boolean, validator?: Partial<Validator> }
) => {
  const { epoch, validator = {}, parallel = false } = options || {}
  if (!validator.namadaAddress) {
    if (!validator.address) {
      throw new Error('missing tendermint or namada address for validator')
    }
    const addressBinary = await abciQuery(`/vp/pos/validator_by_tm_addr/${validator.address}`)
    Object.assign(validator, { namadaAddress: decoder.address(addressBinary.slice(1)) })
    log.info(validator.address, 'is', validator.namadaAddress)
  }
  const v = validator.namadaAddress
  const warn = (...args: Parameters<typeof log["warn"]>) => (e: Error) => {
    log.warn(...args)
    return null
  }
  const requests: Array<()=>Promise<unknown>> = [
    () => abciQuery(`/vp/pos/validator/metadata/${v}`)
      .then((binary: Uint8Array) => binary[0] && ((validator as any).metadata = decoder.pos_validator_metadata(binary.slice(1))))
      .catch(warn(`Failed to provide validator metadata for ${v}`)),
    () => abciQuery(`/vp/pos/validator/commission/${v}`)
      .then((binary: Uint8Array) => (validator as any).commission = decoder.pos_commission_pair(binary))
      .catch(warn(`Failed to provide validator commission pair for ${v}`)),
    () => abciQuery(`/vp/pos/validator/state/${v}` + (epoch?`/${epoch}`:''))
      .then((binary: Uint8Array) => (validator as any).state = decoder.pos_validator_state(binary))
      .catch(warn(`Failed to provide validator state for ${v}`)),
    () => abciQuery(`/vp/pos/validator/stake/${v}` + (epoch?`/${epoch}`:''))
      .then((binary: Uint8Array) => binary[0] && ((validator as any).stake = decode(u256, binary.slice(1))))
      .catch(warn(`Failed to provide validator stake for ${v}`)),
    () => abciQuery(`/vp/pos/validator/consensus_key/${v}`)
      .then((binary: Uint8Array) => {
        const publicKey = base16.encode(binary.slice(2))
        if (validator.publicKey && (validator.publicKey !== publicKey)) {
          throw Object.assign(new Error(`Fetched different public key for ${v}`), {
            oldPublicKey: validator.publicKey,
            newPublicKey: publicKey
          })
        }
        validator.publicKey = publicKey
      }).catch(warn(`Failed to decode validator public key for ${v}`))
  ]
  const prefix = `validator ${v} details: ${requests.length} request(s)`
  if (options?.parallel) {log.debug(prefix, `in parallel`)} else {log.debug(prefix, `in sequence`)}
  await Core.optionallyParallel(options?.parallel, requests)
  return validator
}
type TendermintMetadata = Record<string, Tendermint.Validator>
export const fetchValidators = async (
  connection: Deps,
  options: Partial<Parameters<typeof getValidators>[1]> & {
    epoch?:              Epoch
    //details?:         boolean,
    //pagination?:      [number, number]
    //allStates?:       boolean,
    //addresses?:       string[],
    //parallel?:        boolean,
    //parallelDetails?: boolean,
    tendermintMetadata?: 'parallel'|'sequential'|boolean
    namadaMetadata?:     'parallel'|'sequential'|boolean
  } = {}
): Promise<Validator[]> => {
  // This will be the return value: map of Namada address to validator details object.
  const validatorsByNamadaAddress: Record<string, Validator> = {}
  // This is the full list of validators known to the chain.
  // However, it contains no other data than the identifier.
  // The rest we will have to piece together ourselves.
  const namadaAddresses = await fetchValidatorAddresses(connection, options?.epoch)
  for (const namadaAddress of namadaAddresses) {
    validatorsByNamadaAddress[namadaAddress] = {
      //chain:            connection.chain!,
      publicKey:        null as any, // FIXME: explicitly state nullability
      address:          null as any, // FIXME: in the type definition
      namadaAddress,
      votingPower:      null as any,
      proposerPriority: null as any,
    }
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
    await Core.optionallyParallel(parallel, namadaAddresses.map(addr => async () => {
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
  let tendermintMetadata: TendermintMetadata = {}
  if (options?.tendermintMetadata ?? true) {
    publicKeys ??= await fetchAndPopulatePublicKeys(options.tendermintMetadata === 'parallel')
    tendermintMetadata = (await getValidators(connection, { ...options||{} }))
      // `getValidators` returns an array, so we rekey it by public key.
      // (Identifier rebinding would have been really nice here.)
      .reduce((vs: any, v: any)=>Object.assign(vs, {[v.publicKey]: v}), {}) as Record<string, {
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
          validator.address          = tendermintMetadata[publicKey].address
          validator.publicKey        = tendermintMetadata[publicKey].publicKey
          validator.votingPower      = tendermintMetadata[publicKey].votingPower
          validator.proposerPriority = tendermintMetadata[publicKey].proposerPriority
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
    // Since this adds up to a *lot* of requests, the parallel/sequential switch only determines
    // whether to do each validator's group of 5 requests simultaneously or sequentially; and
    // iteration over all validators is always sequential.
    for (const validator of Object.values(validatorsByNamadaAddress)) {
      await Core.optionallyParallel(options.namadaMetadata === 'parallel', getRequests(
        connection, tendermintMetadata, validator, validator.namadaAddress!, options?.epoch
      ))
    }
  }
  return Object.values(validatorsByNamadaAddress)
}
/** Generator implementation of fetchValidators. */
export async function * fetchValidatorsIter (connection: Deps, options?: {
  epoch?:     Epoch,
  parallel?:  boolean,
  addresses?: string[]
}) {
  const { addresses = [], epoch, parallel = false } = options || {}
  const namadaAddresses = addresses?.length
    ? addresses
    : await fetchValidatorAddresses(connection, epoch)
  const meta: TendermintMetadata = (await getValidators(connection)).reduce(
    (vs: any, v: any)=>Object.assign(vs, {[v.publicKey]: v}), {}
  )
  for (const namadaAddress of namadaAddresses) {
    const validator: Validator = {
      //chain:            connection.chain!,
      publicKey:        null as any, // FIXME: explicitly state nullability
      address:          null as any, // FIXME: in the type definition
      namadaAddress,
      votingPower:      null as any,
      proposerPriority: null as any,
    }
    const requests = getRequests(connection, meta, validator, namadaAddress, options?.epoch)
    await Core.optionallyParallel(parallel, requests)
    yield validator
  }
}
/** Generate full ABCI queries with decoding and error handling for fetching each field
  * of data about a validator (metadata, state, stake, commmission, consensus key) but
  * do not launch the requests yet. */
const getRequests = (
  connection: Deps,
  meta:       TendermintMetadata,
  validator:  Validator,
  address:    Address,
  epoch?:     Epoch,
) => {
  const { warnMetadata, warnCommission, warnState, warnStake, warnConsensusKey } =
    getWarnings(connection, address, epoch)
  const { metadataPath, commissionPath, statePath, stakePath, consensusKeyPath } =
    getAbciQueryPaths(address, epoch)
  const { decodeMetadata, decodeCommission, decodeState, decodeStake, decodePublicKey } =
    getDecoders(connection, meta, validator)
  const requests: Array<()=>Promise<unknown>> = [
    () => connection.abciQuery(metadataPath).then(decodeMetadata).catch(warnMetadata),
    () => connection.abciQuery(commissionPath).then(decodeCommission).catch(warnCommission),
    () => connection.abciQuery(statePath).then(decodeState).catch(warnState),
    () => connection.abciQuery(stakePath).then(decodeStake).catch(warnStake),
    () => connection.abciQuery(consensusKeyPath).then(decodePublicKey).catch(warnConsensusKey),
  ]
  return requests
}
/** Generates a warning handler for each request. */
const getWarnings = (connection: Deps, address: Address, epoch?: Epoch) => {
  const warn = (msg: string) => (_: Error) => {
    if (!isNaN(epoch as number)) msg += ` for epoch ${epoch}`
    connection.log.warn(`${address}:`, msg)
    return null
  }
  const warnMetadata     = warn(`Failed to provide validator metadata`)
  const warnCommission   = warn(`Failed to provide validator commission pair`)
  const warnState        = warn(`Failed to provide validator state`)
  const warnStake        = warn(`Failed to provide validator stake`)
  const warnConsensusKey = warn(`Failed to decode validator public key`)
  return { warnMetadata, warnCommission, warnState, warnStake, warnConsensusKey }
}
const getAbciQueryPaths = (address: Address, epoch?: Epoch) => {
  const consensusKeyPath = `/vp/pos/validator/consensus_key/${address}`
  const metadataPath     = `/vp/pos/validator/metadata/${address}`
  let commissionPath = `/vp/pos/validator/commission/${address}`
  let statePath      = `/vp/pos/validator/state/${address}`
  let stakePath      = `/vp/pos/validator/stake/${address}`
  if (!isNaN(epoch as number)) {
    const epochSuffix = `/${epoch}`
    commissionPath += epochSuffix
    statePath      += epochSuffix
    stakePath      += epochSuffix
  }
  return { metadataPath, commissionPath, statePath, stakePath, consensusKeyPath }
}
/** Define the callbacks that assign the decoded values to a given validator. */
const getDecoders = (
  { decoder }:        Deps,
  tendermintMetadata: TendermintMetadata,
  validator:          Validator,
) => ({
  decodeMetadata (binary: Uint8Array) {
    if (!binary[0]) return null
    Object.assign(validator, { metadata: decoder.pos_validator_metadata(binary.slice(1)) })
    return validator.metadata
  },
  decodeCommission (binary: Uint8Array) {
    Object.assign(validator, { commission: decoder.pos_commission_pair(binary) })
    return validator.commission
  },
  decodeState (binary: Uint8Array) {
    Object.assign(validator, { state: decoder.pos_validator_state(binary) })
    return validator.state
  },
  decodeStake (binary: Uint8Array) {
    if (!binary[0]) return null
    Object.assign(validator, { stake: decode(u256, binary.slice(1)) })
    return validator.stake
  },
  decodePublicKey (binary: Uint8Array) {
    Object.assign(validator, { publicKey: base16.encode(binary.slice(2)) })
    Object.assign(validator, tendermintMetadata[validator.publicKey!] || {}) // ?!?!? MAGIC ?!?!?
    return validator.publicKey
  }
})

//export async function fetchValidatorsBelowCapacity2 (
  //connection: Deps
//) {
    //let validators = await fetchValidatorsBelowCapacity(connection)
    //if (options?.max) {
      //validators = validators.slice(0, options.max)
    //}
    //if (options?.percentage) {
      //const totalStake = Number(await this.fetchTotalStaked())
      //validators = validators.map((v: Partial<Validator>)=>Object.assign(v, {
        //bondedStake: Number(v.bondedStake),
        //stakePercentage: (Number(v.bondedStake) / totalStake) * 100
      //}))
    //}
    //return validators.map((v: Partial<Validator>)=>Object.assign(v, {
      //status: 'below_capacity'
    //}))
//}

//export async function fetchValidatorsConsensus2 () {
    //let validators = await this.getConnection().fetchValidatorsConsensusImpl()
    //if (options?.max) {
      //validators = validators.slice(0, options.max)
    //}
    //if (options?.percentage) {
      //const totalStake = Number(await this.fetchTotalStaked())
      //validators = validators.map((v: Partial<Validator>)=>Object.assign(v, {
        //bondedStake: Number(v.bondedStake),
        //stakePercentage: (Number(v.bondedStake) / totalStake) * 100
      //}))
    //}
    //return validators.map((v: Partial<Validator>)=>Object.assign(v, { status: 'consensus' }))
//}
