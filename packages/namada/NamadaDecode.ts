import type { Address, Uint128 } from '@hackbg/fadroma'
import init, { Decode } from './pkg/fadroma_namada.js'
import type { Block, Transaction } from './NamadaBlock.ts'
import type {  } from './NamadaBlock.ts'
import type * as PGF from './NamadaPGF.ts'
import type * as PoS from './NamadaPoS.ts'
import type * as Gov from './NamadaGov.ts'

export async function initDecoder (decoder: string|URL|Uint8Array): Promise<void> {
  if (decoder instanceof Uint8Array) {
    await init(decoder)
  } else if (decoder) {
    await init(await fetch(decoder))
  }
}

export { Decode }

export interface NamadaDecoder {
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

  gov_proposal (_: Uint8Array): unknown

  gov_votes (_: Uint8Array): unknown

  gov_parameters (_: Uint8Array): Partial<{
    minProposalFund:         bigint
    maxProposalCodeSize:     bigint
    minProposalVotingPeriod: bigint
    maxProposalPeriod:       bigint
    maxProposalContentSize:  bigint
    minProposalGraceEpochs:  bigint
  }>

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

  pgf_parameters (_: Uint8Array): Partial<{
    stewards:              Set<string>
    pgfInflationRate:      bigint
    stewardsInflationRate: bigint
  }>

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

  pos_parameters (_: Uint8Array): Partial<{
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

  pos_rewards_rates (_: Uint8Array): Partial<{
    stakingRewardsRate: unknown
    inflationRate:      unknown
  }>

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
    transactions: Array<Partial<Transaction> & {id: string}>
  }

  tx (): {
    content: NamadaTxContent,
    [key: string]: unknown
  }
}

export type NamadaTxContent = {
  type: 'tx_become_validator.wasm'
  data: {
    address: Address,
    [key: string]: unknown
  }
} | {
  type: 'tx_bond.wasm'
  data: {
    source:    Address,
    validator: Address,
    amount:    Uint128,
    [key: string]: unknown
  }
} | {
  type: 'tx_bridge_pool.wasm'
  data: unknown
} | {
  type: 'tx_change_consensus_key.wasm'
  data: {
    validator: Address,
    [key: string]: unknown
  }
} | {
  type: 'tx_change_validator_commission.wasm'
  data: {
    validator: Address,
    [key: string]: unknown
  }
} | {
  type: 'tx_change_validator_metadata.wasm'
  data: {
    validator: Address,
    [key: string]: unknown
  }
} | {
  type: 'tx_claim_rewards.wasm'
  data: {
    validator: Address,
    [key: string]: unknown
  }
} | {
  type: 'tx_deactivate_validator.wasm'
  data: {
    address: Address,
    [key: string]: unknown
  }
} | {
  type: 'tx_ibc.wasm'
  data: unknown
} | {
  type: 'tx_init_account.wasm'
  data: unknown
} | {
  type: 'tx_init_proposal.wasm'
  data: {
    author: Address,
    [key: string]: unknown
  }
} | {
  type: 'tx_reactivate_validator.wasm'
  data: {
    address: Address,
    [key: string]: unknown
  }
} | {
  type: 'tx_redelegate.wasm'
  data: {
    srcValidator: Address,
    destValidator: Address,
    [key: string]: unknown
  }
} | {
  type: 'tx_resign_steward.wasm'
  data: {
    address: Address,
    [key: string]: unknown
  }
} | {
  type: 'tx_reveal_pk.wasm'
  data: unknown
} | {
  type: 'tx_transfer.wasm'
  data: {
    sources: [{ owner: Address, token: Address }, Uint128][],
    targets: [{ owner: Address, token: Address }, Uint128][],
    [key: string]: unknown
  }
} | {
  type: 'tx_unbond.wasm'
  data: {
    source:    Address,
    validator: Address,
    amount:    Uint128,
    [key: string]: unknown
  }
} | {
  type: 'tx_unjail_validator.wasm'
  data: {
    address: Address,
    [key: string]: unknown
  }
} | {
  type: 'tx_update_account.wasm'
  data: {
    address: Address,
    [key: string]: unknown
  }
} | {
  type: 'tx_update_steward_commission.wasm'
  data: {
    steward: Address,
    [key: string]: unknown
  }
} | {
  type: 'tx_vote_proposal.wasm'
  data: {
    voter: Address,
    [key: string]: unknown
  }
} | {
  type: 'tx_withdraw.wasm'
  data: {
    validator: Address,
    [key: string]: unknown
  }
} | {
  type: 'vp_implicit.wasm'
  data: unknown
} | {
  type: 'vp_user.wasm'
  data: unknown
} | {
  [key: string]: unknown
}
