import type * as Namada from './namadaTypes.ts'
import { fetchValidatorAddresses } from './namadaFetchValidatorAddresses.ts'
import { base16, decode, u256, optionallyParallel, getValidators } from '../deps.ts'

export async function fetchValidators (
  connection: Namada.ConnectionBase,
  options: Partial<Parameters<typeof getValidators>[1]> & {
    epoch?:              Namada.Epoch
    //details?:         boolean,
    //pagination?:      [number, number]
    //allStates?:       boolean,
    //addresses?:       string[],
    //parallel?:        boolean,
    //parallelDetails?: boolean,
    tendermintMetadata?: 'parallel'|'sequential'|boolean
    namadaMetadata?:     'parallel'|'sequential'|boolean
  } = {}
): Promise<Namada.Validator[]> {
  // This will be the return value: map of Namada address to validator details object.
  const validatorsByNamadaAddress: Record<string, Namada.Validator> = {}
  // This is the full list of validators known to the chain.
  // However, it contains no other data than the identifier.
  // The rest we will have to piece together ourselves.
  const namadaAddresses = await fetchValidatorAddresses(connection, options?.epoch)
  for (const namadaAddress of namadaAddresses) {
    validatorsByNamadaAddress[namadaAddress] = {
      chain:            connection.chain!,
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
  let tendermintMetadata: Namada.TendermintMetadata = {}
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
      await optionallyParallel(options.namadaMetadata === 'parallel', getRequests(
        connection, tendermintMetadata, validator, validator.namadaAddress!, options?.epoch
      ))
    }
  }
  return Object.values(validatorsByNamadaAddress)
}

/** Generator implementation of fetchValidators. */
export async function * fetchValidatorsIter (connection: Namada.ConnectionBase, options?: {
  epoch?:     Namada.Epoch,
  parallel?:  boolean,
  addresses?: string[]
}) {
  const { addresses = [], epoch, parallel = false } = options || {}
  const namadaAddresses = addresses?.length
    ? addresses
    : await fetchValidatorAddresses(connection, epoch)
  const meta: Namada.TendermintMetadata = (await getValidators(connection)).reduce(
    (vs: any, v: any)=>Object.assign(vs, {[v.publicKey]: v}), {}
  )
  for (const namadaAddress of namadaAddresses) {
    const validator: Namada.Validator = {
      chain:            connection.chain!,
      publicKey:        null as any, // FIXME: explicitly state nullability
      address:          null as any, // FIXME: in the type definition
      namadaAddress,
      votingPower:      null as any,
      proposerPriority: null as any,
    }
    const requests = getRequests(connection, meta, validator, namadaAddress, options?.epoch)
    await optionallyParallel(parallel, requests)
    yield validator
  }
}

/** Generate full ABCI queries with decoding and error handling for fetching each field
  * of data about a validator (metadata, state, stake, commmission, consensus key) but
  * do not launch the requests yet. */
const getRequests = (
  connection: Namada.ConnectionBase,
  meta:       Namada.TendermintMetadata,
  validator:  Namada.Validator,
  address:    Namada.Address,
  epoch?:     Namada.Epoch,
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
const getWarnings = (connection: Namada.ConnectionBase, address: Namada.Address, epoch?: Namada.Epoch) => {
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

const getAbciQueryPaths = (address: Namada.Address, epoch?: Namada.Epoch) => {
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
  connection:         Namada.ConnectionBase,
  tendermintMetadata: Namada.TendermintMetadata,
  validator:          Namada.Validator,
) => ({
  decodeMetadata (binary: Uint8Array) {
    if (!binary[0]) return null
    const metadata = connection.decode.pos_validator_metadata(binary.slice(1))
    Object.assign(validator, { metadata })
    return metadata
  },
  decodeCommission (binary: Uint8Array) {
    const commission = connection.decode.pos_commission_pair(binary)
    Object.assign(validator, { commission })
    return commission
  },
  decodeState (binary: Uint8Array) {
    const state = connection.decode.pos_validator_state(binary)
    Object.assign(validator, { state })
    return state
  },
  decodeStake (binary: Uint8Array) {
    if (!binary[0]) return null
    const stake = decode(u256, binary.slice(1))
    Object.assign(validator, { stake })
    return stake
  },
  decodePublicKey (binary: Uint8Array) {
    const publicKey = base16.encode(binary.slice(2))
    Object.assign(validator, { publicKey })
    Object.assign(validator, tendermintMetadata[publicKey] || {})
    return publicKey
  }
})
