import type {
  Address,
  TendermintBlock,
  TendermintChain,
  TendermintConnection,
  TendermintTransaction,
  TendermintMetadata,
  TendermintValidator,
  Uint128,
} from '../deps.ts'

import type { Api } from './namadaApi.ts'

export type { Address, TendermintMetadata }

export type Epoch = number|bigint|string

export type Height = number|bigint|string

export type Chain = TendermintChain & Api & {
  readonly connections: Connection[]
  getConnection (): Connection
}

export interface ConnectionBase extends TendermintConnection {
  abciQuery (path: string): Promise<Uint8Array>
  readonly chain:  Chain
  readonly decode: Decoder
  readonly log:    Console
}

export type Connection = ConnectionBase & Api

export interface BlockResults {
  readonly height:                string
  readonly txsResults:            TxResult[]|null
  readonly beginBlockEvents:      unknown[]|null
  readonly endBlockEvents:        EndBlockEvent[]|null
  readonly validatorUpdates:      unknown[]|null
  readonly consensusParamUpdates: unknown[]|null
}

export interface TxResult {
  readonly code:       number
  readonly data:       unknown|null
  readonly log:        string
  readonly info:       string
  readonly gas_wanted: string
  readonly gas_used:   string
  readonly events:     unknown[]
  readonly codespace:  string
}

export interface EndBlockEvent {
  readonly type:       string
  readonly attributes: Array<{
    readonly key:      string
    readonly value:    string
    readonly index:    boolean
  }>
}

export interface GovernanceProposal {
  readonly id:       bigint
  readonly proposal: ReturnType<Decoder["gov_proposal"]>
  readonly votes:    ReturnType<Decoder["gov_votes"]>
  readonly result:   GovernanceProposalResult|null
}

export interface GovernanceProposalResult {
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

/** Describes a Namada validator. */
export interface Validator extends TendermintValidator {
  readonly chain:          Chain,
  readonly namadaAddress?: Address
  readonly metadata?:      ValidatorMetadata
  readonly commission?:    ValidatorCommission
  readonly state?:         ValidatorState
  readonly stake?:         bigint
  readonly bondedStake?:   bigint|number
}

/** Describes the metadata of a Namada validator. */
export interface ValidatorMetadata {
  readonly name?:          string
  readonly email?:         string
  readonly description?:   string|null
  readonly website?:       string|null
  readonly discordHandle?: string|null
  readonly avatar?:        string|null
}

/** Describes the commission rate of a Namada validator. */
export interface ValidatorCommission {
  readonly commissionRate?:              bigint
  readonly maxCommissionChangePerEpoch?: bigint
}

/** Describes the current state of a Namada validator. */
export interface ValidatorState {
  readonly state?: string,
  readonly epoch?: bigint,
}

export interface GovernanceProposalWasm {
  readonly id:      bigint
  readonly codeKey: string
  readonly wasm?:   Uint8Array
}

export interface Block extends TendermintBlock {
  readonly chain: Chain
  readonly responses?: {
    readonly block:    { url: string, response: string }
    readonly results?: { url: string, response: string }
  }
  /** Block header. */
  readonly header: {
    readonly version:            object
    readonly chainId:            string
    readonly height:             bigint
    readonly time:               string
    readonly lastBlockId:        string
    readonly lastCommitHash:     string
    readonly dataHash:           string
    readonly validatorsHash:     string
    readonly nextValidatorsHash: string
    readonly consensusHash:      string
    readonly appHash:            string
    readonly lastResultsHash:    string
    readonly evidenceHash:       string
    readonly proposerAddress:    string
  }
  /** Transaction in block. */
  readonly transactions: Transaction[]
}

export interface Transaction extends TendermintTransaction {
  readonly block?: Block
  readonly data?: {
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

  gov_parameters (_: Uint8Array): GovernanceParameters

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

  pgf_parameters (_: Uint8Array): PGFParameters

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

  pos_parameters (_: Uint8Array): StakingParameters

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
    content: TxContent,
    [key: string]: unknown
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

export type PGFParameters = Partial<{
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
