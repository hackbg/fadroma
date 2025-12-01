/**
  Fadroma
  Copyright (C) 2023 Hack.bg

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/

import init, { Decode } from './pkg/fadroma_namada.js'
import type { Address, Tendermint, Uint128 } from './deps.ts'
import { BaseError, BaseConsole, base16, decode, u64, u256 } from './deps.ts';

export interface Transaction extends Tendermint.Transaction {
  //readonly block?: Height
  readonly data: {
    readonly expiration?:          string|null
    readonly timestamp?:           string
    readonly feeToken?:            string
    readonly feeAmountPerGasUnit?: string
    readonly multiplier?:          bigint
    readonly gasLimitMultiplier?:  bigint
    readonly atomic?:              boolean
    readonly txType?:              'Raw'|'Wrapper'|'Decrypted'|'Protocol'
    readonly sections?:            object[]
    readonly content?:             Array<object>
    readonly batch?:               Array<{
      readonly hash:     string,
      readonly codeHash: string,
      readonly dataHash: string,
      readonly memoHash: string
    }>
  }
}

/** The height of a Namada block. */
export type Height = Tendermint.Height
/** A Namada block. */
export type Block = Tendermint.Block & { readonly transactions: Transaction[] }
export type Epoch = number|bigint|string
export type GovernanceParameters = Partial<{
  minProposalFund:         bigint
  maxProposalCodeSize:     bigint
  minProposalVotingPeriod: bigint
  maxProposalPeriod:       bigint
  maxProposalContentSize:  bigint
  minProposalGraceEpochs:  bigint
}>
export type GovernanceProposal = {
  readonly id:       bigint
  readonly proposal: ReturnType<Decoder["gov_proposal"]>
  readonly votes:    ReturnType<Decoder["gov_votes"]>
  readonly result:   GovernanceProposalResult|null
}
export type GovernanceProposalResult = {
  readonly result:            "Passed"|"Rejected"
  readonly tallyType:         "TwoThirds"|"OneHalfOverOneThird"|"LessOneHalfOverOneThirdNay"
  readonly totalVotingPower:  bigint
  readonly totalYayPower:     bigint
  readonly totalNayPower:     bigint
  readonly totalAbstainPower: bigint
  readonly turnout:           string
  readonly turnoutPercent:    string
  readonly yayPercent:        string
  readonly nayPercent:        string
  readonly abstainPercent:    string
}
export type GovernanceProposalWasm = {
  readonly id:      bigint
  readonly codeKey: string
  readonly wasm?:   Uint8Array
}
export type PgfParameters = Partial<{
  stewards:              Set<string>
  pgfInflationRate:      bigint
  stewardsInflationRate: bigint
}>
export type StakingParameters = Partial<{
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
}>
/** A Namada chain. */
export type Chain = Tendermint.Chain & Api & {
  readonly connections: Record<string, Connection>
  connect (url?: string|URL): Connection
}
/** A connection to a Namada chain. */
export type Connection = Context & Api
/** The dependencies expected by Namada API methods. */
export type Context = Omit<Tendermint.Connection, 'log'> & {
  log:               Console
  chain:             () => Core.ChainRef
  fetchAbciQuery:    (path: string) => Promise<Uint8Array>
  fetchStorageValue: (key:  string) => Promise<Uint8Array>
  decoder:           Decoder
}
/** Methods available for interacting with Namada chains. */
export type Api = Tendermint.Api & Core.ToApi<typeof impl>
export type TxContent = {
  readonly type: 'tx_become_validator.wasm'
  readonly data: {
    readonly address: Address,
    readonly [key: string]: unknown
  }
} | {
  readonly type: 'tx_bond.wasm'
  readonly data: {
    readonly source:    Address,
    readonly validator: Address,
    readonly amount:    Uint128,
    readonly [key: string]: unknown
  }
} | {
  readonly type: 'tx_bridge_pool.wasm'
  readonly data: unknown
} | {
  readonly type: 'tx_change_consensus_key.wasm'
  readonly data: {
    readonly validator: Address,
    readonly [key: string]: unknown
  }
} | {
  readonly type: 'tx_change_validator_commission.wasm'
  readonly data: {
    readonly validator: Address,
    readonly [key: string]: unknown
  }
} | {
  readonly type: 'tx_change_validator_metadata.wasm'
  readonly data: {
    readonly validator: Address,
    readonly [key: string]: unknown
  }
} | {
  readonly type: 'tx_claim_rewards.wasm'
  readonly data: {
    readonly validator: Address,
    readonly [key: string]: unknown
  }
} | {
  readonly type: 'tx_deactivate_validator.wasm'
  readonly data: {
    readonly address: Address,
    readonly [key: string]: unknown
  }
} | {
  readonly type: 'tx_ibc.wasm'
  readonly data: unknown
} | {
  readonly type: 'tx_init_account.wasm'
  readonly data: unknown
} | {
  readonly type: 'tx_init_proposal.wasm'
  readonly data: {
    readonly author: Address,
    readonly [key: string]: unknown
  }
} | {
  readonly type: 'tx_reactivate_validator.wasm'
  readonly data: {
    readonly address: Address,
    readonly [key: string]: unknown
  }
} | {
  readonly type: 'tx_redelegate.wasm'
  readonly data: {
    readonly srcValidator: Address,
    readonly destValidator: Address,
    readonly [key: string]: unknown
  }
} | {
  readonly type: 'tx_resign_steward.wasm'
  readonly data: {
    readonly address: Address,
    readonly [key: string]: unknown
  }
} | TxContentRevealPk | TxContentTransfer | TxContentUnbond | TxContentUnjailValidator | TxContentUpdateAccount | TxContentUpdateStewardCommission | TxContentVoteProposal | TxContentWithdraw | VpImplicit | VpUser | {
  [key: string]: unknown
}

export interface TxContentRevealPk {
  readonly type: 'tx_reveal_pk.wasm'
  readonly data: unknown
}

export interface TxContentTransfer {
  readonly type: 'tx_transfer.wasm'
  readonly data: {
    readonly sources: [{ owner: Address, token: Address }, Uint128][],
    readonly targets: [{ owner: Address, token: Address }, Uint128][],
    readonly [key: string]: unknown
  }
}

export interface TxContentUnbond {
  readonly type: 'tx_unbond.wasm'
  readonly data: {
    readonly source:    Address,
    readonly validator: Address,
    readonly amount:    Uint128,
    readonly [key: string]: unknown
  }
}

export interface TxContentUnjailValidator {
  readonly type: 'tx_unjail_validator.wasm'
  readonly data: {
    readonly address: Address,
    readonly [key: string]: unknown
  }
}

export interface TxContentUpdateAccount {
  readonly type: 'tx_update_account.wasm'
  readonly data: {
    readonly address: Address,
    readonly [key: string]: unknown
  }
}

export interface TxContentUpdateStewardCommission {
  readonly type: 'tx_update_steward_commission.wasm'
  readonly data: {
    readonly steward: Address,
    readonly [key: string]: unknown
  }
}

export interface TxContentVoteProposal {
  readonly type: 'tx_vote_proposal.wasm'
  readonly data: {
    readonly voter: Address,
    readonly [key: string]: unknown
  }
}

export interface TxContentWithdraw {
  readonly type: 'tx_withdraw.wasm'
  readonly data: {
    readonly validator: Address,
    readonly [key: string]: unknown
  }
}

export interface VpImplicit {
  readonly type: 'vp_implicit.wasm'
  readonly data: unknown
}

export interface VpUser {
  readonly type: 'vp_user.wasm'
  readonly data: unknown
}
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

export const fetchBalance = async ({ decoder, fetchAbciQuery }: Context, parameters: {
  addresses: Record<string, string[]>,
}): Promise<Record<string, Record<string, string>>> => {
  const result: Record<string, Record<string, string>> = {}
  for (const [address, tokens] of Object.entries(parameters.addresses)) {
    result[address] = {}
    for (const token of tokens) {
      if (token.split('1')[1]?.length !== 40) throw new Error(`Invalid token address: ${token}`);
      const balanceKey  = decoder.balance_key(token, address)
      const balanceAbci = `/shell/value/${balanceKey}`
      const balance     = (await fetchAbciQuery(balanceAbci)).value!
      if (balance.length > 0) {
        result[address][token] = String(decode(u256, balance))
      } else {
        result[address][token] = "0"
      }
    }
  }
  return result
}


export const fetchBlock = async (
  api: Context, options?: { height?: Height, hash?: string, results?: boolean, raw?: boolean }
): Promise<Block> => {
  const result      = await Tendermint.fetchBlock(api, { ...options, raw: true })
  const blockData   = result.responses!.block!.data!
  const resultsData = options?.results ? result.responses!.results!.data! : ""
  const decoded     = decodeBlock(api, options?.raw||false, result.height, blockData, resultsData)
  if (options?.raw) Object.assign(decoded, { responses: result.responses })
  return decoded as Block
}
export const decodeBlock = (
  { log, decoder, chain }: Context,
  raw:     boolean,
  h:       Height,
  block:   string,
  results: string,
) => {
  const height = (typeof h === 'bigint') ? h : (isNaN(Number(h)) ? undefined : BigInt(h!))
  if (!height) {
    log.error('could not detect block height in', block)
    if (raw) return {}
    throw new Error('could not detect block height', { block })
  }
  try {
    const { hash: id, header, transactions: decoded } = decoder.block(block, results||null)
    const transactions = decoded.map(tx=>({hash: tx?.id, ...tx, block: height} as Transaction))
    return { chain: chain(), id, height, header, transactions }
  } catch (e: any) {
    log.error('failed to decode block:', { block, results })
    if (raw) return {}
    throw Object.assign(e, { block, results })
  }
}
/** Describe a Namada chain. */
export async function chain (
  { ...options }: Parameters<typeof Tendermint.chain>[0] & { decoder?: string|URL|Uint8Array }
): Promise<Chain> {
  // Init the WASM translation blob.
  if (options?.decoder) {
    options.decoder = await initDecoder(options.decoder) as any
  } else {
    new Console().warnNoDecoder()
  }
  options.bech32Prefix ??= 'tnam'
  // Construct chain.
  const chain = Tendermint.chain({ ...options }, impl as any /*FIXME*/) as Chain
  // Construct one connection.
  chain.connect = (url: string|URL = options?.url!): Connection => {
    if (!url) throw new Error('pass rpc url')
    url = url.toString()
    chain.connections || Object.assign(chain, { connections: chain.connections || {} })
    chain.connections[url] ??= Object.assign(
      Core.connection(chain, impl as any, url) as Connection,
      { decoder: options.decoder }
    )
    return chain.connections[url]
  }
  return chain as Chain
}
export const coinType = 118
export const bech32Prefix = 'tnam'
export const hdAccountIndex = 0
export const initDecoder = async (decoder: string|URL|Uint8Array): Promise<Decoder> => {
  if (decoder instanceof Uint8Array) {
    await init(decoder)
  } else if (decoder) {
    await init(await fetch(decoder))
  } else {
    throw new Error('Provide decoder as path, URL or Uint8Array')
  }
  return Decode as unknown as Decoder
}
/** Fetch a value from storage. */
export const fetchStorageValue = async (api: Context, key: string): Promise<Uint8Array> =>
  (await api.fetchAbciQuery(`/shell/value/${key}`)).value!
/** Fetch core protocol parameters. */
export const fetchProtocolParameters = async (api: Context) => {
  const { decoder } = api
  const parameters: Record<string, unknown> = {}
  await Promise.all(Object.entries(decoder.storage_keys())
    .map(([name, key])=>fetchStorageValue(api, key as string).then(binary=>{
      if (binary.length === 0) return
      switch (name) {
        case 'gasCostTable':
          return parameters[name]=decoder.gas_cost_table(binary)
        case 'epochDuration':
          return parameters[name]=decoder.epoch_duration(binary)
        case 'maxTxBytes':
          return parameters[name]=decoder.u32(binary)
        case 'txAllowlist':
        case 'vpAllowlist':
          return parameters[name]=decoder.vec_string(binary)
        case 'isNativeTokenTransferable':
          return parameters[name]=!!binary[0]
        case 'implicitVpCodeHash':
          return parameters[name]=decoder.code_hash(binary)
        default:
          return parameters[name]=decoder.u64(binary)
      }
    })))
  return parameters
}
/** Default implementation of Namada client API. */
export const impl = {
  ...Tendermint.impl,
  ...Bank,
  ...Block,
  ...Pos,
  ...Epoch,
  ...Gov,
  ...Pgf,
  ...Val,
  fetchStorageValue,
  fetchProtocolParameters,
}
/** Generate full ABCI queries with decoding and error handling for fetching each field
  * of data about a validator (metadata, state, stake, commmission, consensus key) but
  * do not launch the requests yet. */
const getRequests = (
  connection: Context,
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
    () => connection.fetchAbciQuery(metadataPath).then(decodeMetadata).catch(warnMetadata),
    () => connection.fetchAbciQuery(commissionPath).then(decodeCommission).catch(warnCommission),
    () => connection.fetchAbciQuery(statePath).then(decodeState).catch(warnState),
    () => connection.fetchAbciQuery(stakePath).then(decodeStake).catch(warnStake),
    () => connection.fetchAbciQuery(consensusKeyPath).then(decodePublicKey).catch(warnConsensusKey),
  ]
  return requests
}
/** Generates a warning handler for each request. */
const getWarnings = (connection: Context, address: Address, epoch?: Epoch) => {
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
  { decoder }:        Context,
  tendermintMetadata: TendermintMetadata,
  validator:          Validator,
) => ({
  decodeMetadata ({ value }: { value: Uint8Array|null }) {
    if (!value || !value[0]) return null
    Object.assign(validator, { metadata: decoder.pos_validator_metadata(value.slice(1)) })
    return validator.metadata
  },
  decodeCommission ({ value }: { value: Uint8Array|null }) {
    if (!value) return null
    Object.assign(validator, { commission: decoder.pos_commission_pair(value) })
    return validator.commission
  },
  decodeState ({ value }: { value: Uint8Array|null }) {
    if (!value) return null
    Object.assign(validator, { state: decoder.pos_validator_state(value) })
    return validator.state
  },
  decodeStake ({ value }: { value: Uint8Array|null }) {
    if (!value) return null
    if (!value[0]) return null
    Object.assign(validator, { stake: decode(u256, value.slice(1)) })
    return validator.stake
  },
  decodePublicKey ({ value }: { value: Uint8Array|null }) {
    if (!value) return null
    Object.assign(validator, { publicKey: base16.encode(value.slice(2)) })
    Object.assign(validator, tendermintMetadata[validator.publicKey!] || {}) // ?!?!? MAGIC ?!?!?
    return validator.publicKey
  }
})

//export async function fetchValidatorsBelowCapacity2 (
  //connection: Context
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
