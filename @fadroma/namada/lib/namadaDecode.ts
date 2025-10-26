import type { GovernanceParameters } from './namadaGov.ts'
import type { PgfParameters } from './namadaPgf.ts'
import type { StakingParameters } from './namadaPos.ts'
import type { Block } from './namadaBlock.ts'
import type { Transaction, TxContent } from './namadaTx.ts'
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
