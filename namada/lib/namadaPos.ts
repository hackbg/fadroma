import type { Address } from '../deps.ts'
import type { ConnectionBase } from './namada.ts'
import type { Epoch } from './namadaEpoch.ts'
import { decode, u64, u256 } from '../deps.ts'

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

/** Fetch staking parameters. */
export async function fetchStakingParameters (connection: ConnectionBase) {
  const binary = await connection.abciQuery("/vp/pos/pos_params")
  return connection.decode.pos_parameters(binary)
}

/** Fetch total staked NAMNAM. */
export async function fetchTotalStaked (
  connection: ConnectionBase, epoch?: number|bigint|string
) {
  let query = "/vp/pos/total_stake"
  if (epoch!==undefined) query += `/${epoch}`
  const binary = await connection.abciQuery(query)
  return decode(u64, binary)
}

export async function fetchBondWithSlashing (
  connection: ConnectionBase,
  delegator:  Address,
  validator:  Address,
  epoch?:     Epoch,
) {
  let query = `/vp/pos/bond_with_slashing/${delegator}/${validator}`
  if (epoch) query += `/${epoch}`
  const totalStake = await connection.abciQuery(query)
  return decode(u256, totalStake)
}

/** Fetch all delegations. */
export async function fetchDelegations (
  connection: ConnectionBase,
  address:    Address,
) {
  const binary = await connection.abciQuery(`/vp/pos/delegations/${address}`)
  return connection.decode.addresses(binary)
}

/** Fetch delegations at given address. */
export async function fetchDelegationsAt (
  connection: ConnectionBase,
  address:    Address,
  epoch?:     Epoch
): Promise<Record<string, bigint>> {
  let query = `/vp/pos/delegations_at/${address}`
  epoch = Number(epoch)
  if (!isNaN(epoch)) {
    query += `/${epoch}`
  }
  const binary = await connection.abciQuery(query)
  return connection.decode.address_to_amount(binary) as Record<string, bigint>
}
