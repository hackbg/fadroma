/**
  Fadroma for Namada
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

import { env } from 'node:process';
import { Error } from '../../library/Err.ts';
import { Uint128 } from '../../library/Number.ts';
import Tendermint from '../Tendermint/Tendermint.ts';
import init, { Decode } from './pkg/fadroma_namada.js';

export default Namada;

/** Describe a Namada chain. */
async function Namada (
  { ...options }: Parameters<typeof Tendermint.chain>[0] & { decoder?: string|URL|Uint8Array }
): Promise<Namada> {
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

interface Namada {
  rpcUrl?: string
  decode?: Namada.Decoder
}

namespace Namada {
  type TendermintMetadata = Record<string, Validator>

  export type Epoch = number|bigint|string
  /** The height of a Namada block. */
  export type Height = Tendermint.Height
  /** A Namada block. */
  export type Block = Tendermint.Block & { readonly transactions: Tx[] }
  /** Namada WASM-based wasm. */
  export let Wasm = async function loadNamadaWasm (
    wasm: string|URL|Uint8Array = env['FADROMA_NAMADA_WASM']
  ): Promise<Namada.Decoder> {
    const { default: init, Decode } = await import('./namada/pkg/fadroma_namada.js');
    if (wasm instanceof Uint8Array) {
      await init(wasm)
    } else if (wasm) {
      await init(await fetch(wasm))
    } else {
      throw new Error('Provide wasm as path, URL or Uint8Array')
    }
    Wasm = async () => Decode as unknown as Namada.Decoder;
    return Decode as unknown as Namada.Decoder;
  }
  export interface Decoder {
    u32 (_: Uint8Array): bigint
    u64 (_: Uint8Array): bigint
    vec_string (_: Uint8Array): string[]
    code_hash (_: Uint8Array): string

    address_to_amount (_: Uint8Array): Record<string, bigint>
    addresses         (_: Uint8Array): string[]
    address           (_: Uint8Array): string

    epoch_duration (_: Uint8Array): {
      minNumOfBlocks: number,
      minDuration: number
    }

    gas_cost_table (_: Uint8Array): Record<string, string>

    gov_parameters (_: Uint8Array): Governance.Parameters

    gov_proposal (_: Uint8Array): Partial<{
      id:               string
      content:          Map<string, string>
      author:           string
      type:             { type: string, [k: string]: unknown }
      votingStartEpoch: bigint
      votingEndEpoch:   bigint
      graceEpoch:       bigint
    }>

    gov_proposal_code_key (id: bigint): string

    gov_votes (_: Uint8Array): Partial<{
      validator: string
      delegator: string
      data:      "Yay"|"Nay"|"Abstain"
    }>[]

    gov_result (_: Uint8Array): Partial<{
      result:            "Passed"|"Rejected"
      tallyType:         "TwoThirds"|"OneHalfOverOneThird"|"LessOneHalfOverOneThirdNay"
      totalVotingPower:  bigint
      totalYayPower:     bigint
      totalNayPower:     bigint
      totalAbstainPower: bigint
    }>

    pgf_parameters (_: Uint8Array): PgfParameters

    pos_commission_pair (_: Uint8Array): {
      epoch:                       string
      commissionRate:              bigint
      maxCommissionChangePerEpoch: bigint
    }

    pos_validator_state (_: Uint8Array): {
      epoch: bigint
      state: 'Consensus'|'BelowCapacity'|'BelowThreshold'|'Inactive'|'Jailed'
    }

    pos_validator_metadata (_: Uint8Array): {
      name?:          string
      email?:         string
      description?:   string
      website?:       string
      discordHandle?: string
      avatar?:        string
    }

    pos_validator_set (_: Uint8Array): {
      bondedStake: number|bigint
    }[]

    pos_parameters (_: Uint8Array): Staking.Parameters

    storage_keys (): {
      epochDuration:             string
      epochsPerYear:             string
      gasCostTable:              string
      gasScale:                  string
      implicitVpCodeHash:        string
      maspEpochMultipler:        string
      maspFeePaymentGasLimi:     string
      maxBlockGas:               string
      maxProposalBytes:          string
      maxTxBytes:                string
      isNativeTokenTransferable: string
      txAllowlist:               string
      vpAllowlist:               string
    }

    balance_key (token: string, address: string): string

    block (blockResponse: unknown, resultsResponse: unknown): {
      hash:         string,
      header:       Block["header"]
      transactions: Array<Partial<Tx> & {id: string}>
    }

    tx (): {
      content: TxContent,
      [key: string]: unknown
    }
  }

  export namespace Governance {
    export type Parameters = Partial<{
      minProposalFund:         bigint
      maxProposalCodeSize:     bigint
      minProposalVotingPeriod: bigint
      maxProposalPeriod:       bigint
      maxProposalContentSize:  bigint
      minProposalGraceEpochs:  bigint
    }>
    export type Proposal = {
      readonly id:       bigint
      readonly proposal: ReturnType<Decoder["gov_proposal"]>
      readonly votes:    ReturnType<Decoder["gov_votes"]>
      readonly result:   ProposalResult|null
    }
    export type ProposalResult = {
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
    export type ProposalWasm = {
      readonly id:      bigint
      readonly codeKey: string
      readonly wasm?:   Uint8Array
    }
  }

  export namespace Pgf {
    export type Parameters = Partial<{
      stewards:              Set<string>
      pgfInflationRate:      bigint
      stewardsInflationRate: bigint
    }>
  }

  export namespace Staking {
    export type Parameters = Partial<{
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
  }

  export interface Tx extends Tendermint.Tx {
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

  export namespace Tx {
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
  }
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
    readonly stake?:         bigint
    readonly bondedStake?:   bigint|number
  }
  /** Describes a Namada validator. */
  export type Validator = Tendermint.Validator & {
    readonly namadaAddress?: Address
    readonly metadata?:      ValidatorMetadata
    readonly commission?:    ValidatorCommission
    readonly state?:         ValidatorState
    readonly stake?:         bigint
    readonly bondedStake?:   bigint|number
  };
  export namespace Validator {
    /** Describes the metadata of a Namada validator. */
    export type Metadata = {
      readonly name?:          string
      readonly email?:         string
      readonly description?:   string|null
      readonly website?:       string|null
      readonly discordHandle?: string|null
      readonly avatar?:        string|null
    }
    /** Describes the commission rate of a Namada validator. */
    export type Commission = {
      readonly commissionRate?:              bigint
      readonly maxCommissionChangePerEpoch?: bigint
    }
    /** Describes the current state of a Namada validator. */
    export type State = {
      readonly state?: string,
      readonly epoch?: bigint,
    }
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
      const transactions = decoded.map(tx=>({hash: tx?.id, ...tx, block: height} as Tx))
      return { chain: chain(), id, height, header, transactions }
    } catch (e: any) {
      log.error('failed to decode block:', { block, results })
      if (raw) return {}
      throw Object.assign(e, { block, results })
    }
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
  export const fetchBalance = async ({ decoder, fetchAbciQuery }: Context, parameters: {
    addresses: Record<string, string[]>,
  }): Promise<Record<string, Record<string, string>>> => {
    const result: Record<string, Record<string, string>> = {}
    for (const [address, tokens] of Object.entries(parameters.addresses)) {
      result[address] = {}
      for (const token of tokens) {
        if (token.split('1')[1]?.length !== 40) {
          throw new Error(`Invalid token address: ${token}`)
        }
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
      const transactions = decoded.map(tx=>({hash: tx?.id, ...tx, block: height} as Tx))
      return { chain: chain(), id, height, header, transactions }
    } catch (e: any) {
      log.error('failed to decode block:', { block, results })
      if (raw) return {}
      throw Object.assign(e, { block, results })
    }
  }
  export const fetchEpoch = async ({ fetchAbciQuery }: Context, height?: Height) => {
    if (height !== undefined) {
      const binary = (await fetchAbciQuery(`/shell/epoch_at_height/${height}`)).value!
      return binary[0] ? decode(u64, binary.slice(1)) : null
    }
    return decode(u64, (await fetchAbciQuery("/shell/epoch")).value!)
  }
  export const fetchEpochDuration = async ({ decoder, fetchStorageValue }: Context) =>
    decoder.epoch_duration(await fetchStorageValue(decoder.storage_keys().epochDuration))
  export const fetchEpochFirstBlock = async ({ fetchAbciQuery }: Context) =>
    Number(decode(u64, (await fetchAbciQuery('/shell/first_block_height_of_current_epoch')).value!))
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
  export const GOV_INTERNAL_ADDRESS = "tnam1q5qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqrw33g6"
  export const fetchGovernanceParameters = async ({ fetchAbciQuery, decoder }: Context) =>
    decoder.gov_parameters((await fetchAbciQuery(`/vp/governance/parameters`)).value!)
  export const fetchProposalCount = async ({ fetchAbciQuery }: Context) => decode(u64,
    (await fetchAbciQuery(`/shell/value/#${GOV_INTERNAL_ADDRESS}/counter`)).value!) as bigint
  export const fetchProposalInfo = async (
    { fetchAbciQuery, decoder }: Context, id: number|bigint
  ): Promise<ReturnType<Decoder["gov_proposal"]>|null> => {
    const response = (await fetchAbciQuery(`/vp/governance/proposal/${id}`)).value!
    if (response[0] === 0) return null
    return decoder.gov_proposal(response.slice(1)) as ReturnType<Decoder["gov_proposal"]>
  }
  export const fetchProposalVotes = async (
    { fetchAbciQuery, decoder }: Context, id: number|bigint
  ): Promise<ReturnType<Decoder["gov_votes"]>> => {
    const binary = (await fetchAbciQuery(`/vp/governance/proposal/${id}/votes`)).value!
    return decoder.gov_votes(binary) as ReturnType<Decoder["gov_votes"]>
  }
  export const fetchProposalWasm = async (
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
  }
  export const fetchProposalResult = async (
    { fetchAbciQuery, decoder }: Context, id: number|bigint
  ): Promise<GovernanceProposalResult|null> => {
    const response = (await fetchAbciQuery(`/vp/governance/stored_proposal_result/${id}`)).value!
    if (response[0] === 0) return null
    const decoded = decoder.gov_result(response.slice(1))
    const results = decodeResultResponse(decoded as Required<typeof decoded>)
    return results as GovernanceProposalResult
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
  /** A Namada logger. */
  const warnNoDecoder = ({ warn }) =>
    warn("decoder binary not provided; trying to decode namada objects will fail");
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
}
