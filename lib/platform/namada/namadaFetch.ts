export const Epoch = Object.assign(async function fetchEpoch (
  { fetchAbciQuery }: Context, height?: Height
) {
  if (height !== undefined) {
    const binary = (await fetchAbciQuery(`/shell/epoch_at_height/${height}`)).value!
    return binary[0] ? decode(u64, binary.slice(1)) : null
  }
  return decode(u64, (await fetchAbciQuery("/shell/epoch")).value!)
}, {
  Duration:   async ({ decoder, fetchStorageValue }: Context) =>
    decoder.epoch_duration(await fetchStorageValue(decoder.storage_keys().epochDuration)),
  FirstBlock: async ({ fetchAbciQuery }: Context) =>
    Number(decode(u64, (await fetchAbciQuery('/shell/first_block_height_of_current_epoch')).value!)),
});

export const Gov = {
  GOV_INTERNAL_ADDRESS: "tnam1q5qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqrw33g6",

  Parameters: async ({ fetchAbciQuery, decoder }: Context) =>
    decoder.gov_parameters((await fetchAbciQuery(`/vp/governance/parameters`)).value!),

  Proposal: {
    Count: async ({ fetchAbciQuery }: Context) => decode(u64,
      (await fetchAbciQuery(`/shell/value/#${GOV_INTERNAL_ADDRESS}/counter`)).value!) as bigint,
    Info: async (
      { fetchAbciQuery, decoder }: Context, id: number|bigint
    ): Promise<ReturnType<Decoder["gov_proposal"]>|null> => {
      const response = (await fetchAbciQuery(`/vp/governance/proposal/${id}`)).value!
      if (response[0] === 0) return null
      return decoder.gov_proposal(response.slice(1)) as ReturnType<Decoder["gov_proposal"]>
    },
    Votes: async (
      { fetchAbciQuery, decoder }: Context, id: number|bigint
    ): Promise<ReturnType<Decoder["gov_votes"]>> => {
      const binary = (await fetchAbciQuery(`/vp/governance/proposal/${id}/votes`)).value!
      return decoder.gov_votes(binary) as ReturnType<Decoder["gov_votes"]>
    },
    Wasm: async (
      { fetchAbciQuery, decoder }: Context, id: number|bigint
    ): Promise<GovernanceProposalWasm|null> => {
      id = BigInt(id)
      const codeKey = decoder.gov_proposal_code_key(BigInt(id))
      let wasm
      const hasKey = (await fetchAbciQuery(`/shell/has_key/${codeKey}`)).value!
      if (hasKey[0] === 1) {
        wasm = (await fetchAbciQuery(`/shell/value/${codeKey}`)).value!
        wasm = wasm.slice(4) // trim length prefix
        return { id, codeKey, wasm }
      } else {
        return null
      }
    },
    Result: async (
      { fetchAbciQuery, decoder }: Context, id: number|bigint
    ): Promise<GovernanceProposalResult|null> => {
      const response = (await fetchAbciQuery(`/vp/governance/stored_proposal_result/${id}`)).value!
      if (response[0] === 0) return null
      const decoded = decoder.gov_result(response.slice(1))
      const results = decodeResultResponse(decoded as Required<typeof decoded>)
      return results as GovernanceProposalResult
    },
  }
}

export const decodeResultResponse = (
  decoded: {
    result:            "Passed"|"Rejected"
    tallyType:         "TwoThirds"|"OneHalfOverOneThird"|"LessOneHalfOverOneThirdNay"
    totalVotingPower:  bigint
    totalYayPower:     bigint
    totalNayPower:     bigint
    totalAbstainPower: bigint
  },
  turnout =
    BigInt(decoded.totalYayPower!) +
    BigInt(decoded.totalNayPower!) +
    BigInt(decoded.totalAbstainPower!)
): GovernanceProposalResult => ({
  ...decoded,
  turnout:        String(turnout),
  turnoutPercent: (decoded.totalVotingPower! > 0) ? percent2(turnout, decoded.totalVotingPower!) : '0',
  yayPercent:     (turnout > 0) ? percent(decoded.totalYayPower!, turnout) : '0',
  nayPercent:     (turnout > 0) ? percent(decoded.totalNayPower!, turnout) : '0',
  abstainPercent: (turnout > 0) ? percent(decoded.totalAbstainPower!, turnout) : '0',
})
const percent = (a: string|number|bigint, b: string|number|bigint) =>
  ((Number(BigInt(a) * 1000000n / BigInt(b)) / 10000).toFixed(2) + '%')
const percent2 = (a: string|number|bigint, b: string|number|bigint) =>
  ((Number(BigInt(a) * 1000000n / BigInt(b)) / 1000000).toFixed(2) + '%')
/** A Namada error. */
export class Error extends BaseError {}
/** A Namada logger. */
export class Console extends BaseConsole {
  warnNoDecoder = () => this.warn(
    "decoder binary not provided; trying to decode namada objects will fail"
  )
}
export const fetchPgfParameters = async ({ decoder, fetchAbciQuery }: Context) =>
  decoder.pgf_parameters((await fetchAbciQuery(`/vp/pgf/parameters`)).value!)
/** Fetch staking parameters. */
export async function fetchStakingParameters ({fetchAbciQuery, decoder}: Context) {
  const binary = (await fetchAbciQuery("/vp/pos/pos_params")).value!
  return decoder.pos_parameters(binary)
}
/** Fetch total staked NAMNAM. */
export async function fetchTotalStaked ({fetchAbciQuery}: Context, epoch?: number|bigint|string) {
  let query = "/vp/pos/total_stake"
  if (epoch!==undefined) query += `/${epoch}`
  const binary = (await fetchAbciQuery(query)).value!
  return decode(u64, binary)
}
export async function fetchBondWithSlashing (
  {fetchAbciQuery}: Context, delegator: Address, validator: Address, epoch?: Epoch,
) {
  let query = `/vp/pos/bond_with_slashing/${delegator}/${validator}`
  if (epoch) query += `/${epoch}`
  const totalStake = (await fetchAbciQuery(query)).value!
  return decode(u256, totalStake)
}
/** Fetch all delegations. */
export const fetchDelegations = async ({fetchAbciQuery, decoder}: Context, address: Address) =>
  decoder.addresses((await fetchAbciQuery(`/vp/pos/delegations/${address}`)).value!)
/** Fetch delegations at given address. */
export const fetchDelegationsAt = async (
  {fetchAbciQuery, decoder}: Context, address: Address, epoch?: Epoch
): Promise<Record<string, bigint>> => {
  let query = `/vp/pos/delegations_at/${address}`
  epoch = Number(epoch)
  if (!isNaN(epoch)) query += `/${epoch}`
  return decoder.address_to_amount((await fetchAbciQuery(query)).value!) as Record<string, bigint>
}
/** Fetch details about one validator. */
export const fetchValidator = async (
  api: Context, namadaAddress: Address, options?: { epoch?: Epoch }
) => {
  const validator = { chain: api.chain, address: null as any, namadaAddress }
  return await fetchValidatorDetails(api, {...options, validator})
}
/** Fetch the stake of a given validator. */
export const fetchValidatorStake = async (
  { fetchAbciQuery }: Context, address: Address, epoch?: Epoch,
) => {
  let query = `/vp/pos/validator/stake/${address}`
  if (epoch) query += `/${epoch}`
  const totalStake = (await fetchAbciQuery(query)).value!
  if (totalStake[0] === 0) return 0
  return decode(u256, totalStake.slice(1))
}
/** Fetch addresses of all known validators. */
export const fetchValidatorAddresses = async (
  { fetchAbciQuery, decoder }: Context, epoch?: Epoch
): Promise<Address[]> => {
  let query = "/vp/pos/validator/addresses"
  if (epoch!==undefined) query += `/${epoch}`
  return decoder.addresses((await fetchAbciQuery(query)).value!)
}
/** Fetch info about the set of validators currently participating in consensus. */
export async function fetchValidatorsConsensus (
  { fetchAbciQuery, decoder }: Context, epoch?: Epoch
) {
  let query = "/vp/pos/validator_set/consensus"
  if (epoch!==undefined) query += `/${epoch}`
  return decoder.pos_validator_set((await fetchAbciQuery(query)).value!).sort(byBondedStake)
}
/** Fetch info about the set of validators currently below capacity. */
export async function fetchValidatorsBelowCapacity (
  { fetchAbciQuery, decoder }: Context, epoch?: Epoch
) {
  let query = "/vp/pos/validator_set/below_capacity"
  if (epoch!==undefined) query += `/${epoch}`
  return decoder.pos_validator_set((await fetchAbciQuery(query)).value!).sort(byBondedStake)
}
/** Sorting function by the bondedStake parameter. */
const byBondedStake = (a: {bondedStake: number|bigint}, b: {bondedStake: number|bigint})=>
  (BigInt(a.bondedStake) > BigInt(b.bondedStake)) ? -1
    : (BigInt(a.bondedStake) < BigInt(b.bondedStake)) ?  1
    : 0
/** Fetch details for a Namada validator. */
export const fetchValidatorDetails = async (
  { fetchAbciQuery, decoder, log }: Context,
  options?: { epoch?: Epoch, parallel?: boolean, validator?: Partial<Validator> }
) => {
  const { epoch, validator = {}, parallel = false } = options || {}
  if (!validator.namadaAddress) {
    if (!validator.address) {
      throw new Error('missing tendermint or namada address for validator')
    }
    const addressBinary = (await fetchAbciQuery(`/vp/pos/validator_by_tm_addr/${validator.address}`)).value!
    Object.assign(validator, { namadaAddress: decoder.address(addressBinary.slice(1)) })
    log.info(validator.address, 'is', validator.namadaAddress)
  }
  const v = validator.namadaAddress
  const warn = (...args: Parameters<typeof log["warn"]>) => (e: Error) => {
    log.warn(...args)
    return null
  }
  const requests: Array<()=>Promise<unknown>> = [
    () => fetchAbciQuery(`/vp/pos/validator/metadata/${v}`)
      .then(x=>x.value!)
      .then((value: Uint8Array) => value[0] && ((validator as any).metadata = decoder.pos_validator_metadata(value.slice(1))))
      .catch(warn(`Failed to provide validator metadata for ${v}`)),
    () => fetchAbciQuery(`/vp/pos/validator/commission/${v}`)
      .then(x=>x.value!)
      .then((value: Uint8Array) => (validator as any).commission = decoder.pos_commission_pair(value))
      .catch(warn(`Failed to provide validator commission pair for ${v}`)),
    () => fetchAbciQuery(`/vp/pos/validator/state/${v}` + (epoch?`/${epoch}`:''))
      .then(x=>x.value!)
      .then((value: Uint8Array) => (validator as any).state = decoder.pos_validator_state(value))
      .catch(warn(`Failed to provide validator state for ${v}`)),
    () => fetchAbciQuery(`/vp/pos/validator/stake/${v}` + (epoch?`/${epoch}`:''))
      .then(x=>x.value!)
      .then((value: Uint8Array) => value[0] && ((validator as any).stake = decode(u256, value.slice(1))))
      .catch(warn(`Failed to provide validator stake for ${v}`)),
    () => fetchAbciQuery(`/vp/pos/validator/consensus_key/${v}`)
      .then(x=>x.value!)
      .then((value: Uint8Array) => {
        const publicKey = base16.encode(value.slice(2))
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
  connection: Context,
  options: Partial<Parameters<typeof Tendermint.fetchValidators>[1]> & {
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
      const binary = (await connection.fetchAbciQuery(`/vp/pos/validator/consensus_key/${addr}`)).value!
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
    tendermintMetadata = (await Tendermint.fetchValidators(connection, { ...options||{} }))
      // `fetchValidators` returns an array, so we rekey it by public key.
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
export async function * fetchValidatorsIter (connection: Context, options?: {
  epoch?:     Epoch,
  parallel?:  boolean,
  addresses?: string[]
}) {
  const { addresses = [], epoch, parallel = false } = options || {}
  const namadaAddresses = addresses?.length
    ? addresses
    : await fetchValidatorAddresses(connection, epoch)
  const meta: TendermintMetadata = (await Tendermint.fetchValidators(connection)).reduce(
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
