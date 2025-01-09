import type { Address } from '../deps.ts'
import type { Deps } from './namada.ts'
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
export async function fetchStakingParameters ({abciQuery, decoder}: Deps) {
  const binary = await abciQuery("/vp/pos/pos_params")
  return decoder.pos_parameters(binary)
}
/** Fetch total staked NAMNAM. */
export async function fetchTotalStaked ({abciQuery}: Deps, epoch?: number|bigint|string) {
  let query = "/vp/pos/total_stake"
  if (epoch!==undefined) query += `/${epoch}`
  const binary = await abciQuery(query)
  return decode(u64, binary)
}
export async function fetchBondWithSlashing (
  {abciQuery}: Deps, delegator: Address, validator: Address, epoch?: Epoch,
) {
  let query = `/vp/pos/bond_with_slashing/${delegator}/${validator}`
  if (epoch) query += `/${epoch}`
  const totalStake = await abciQuery(query)
  return decode(u256, totalStake)
}
/** Fetch all delegations. */
export const fetchDelegations = async ({abciQuery, decoder}: Deps, address: Address) =>
  decoder.addresses(await abciQuery(`/vp/pos/delegations/${address}`))
/** Fetch delegations at given address. */
export const fetchDelegationsAt = async (
  {abciQuery, decoder}: Deps, address: Address, epoch?: Epoch
): Promise<Record<string, bigint>> => {
  let query = `/vp/pos/delegations_at/${address}`
  epoch = Number(epoch)
  if (!isNaN(epoch)) query += `/${epoch}`
  return decoder.address_to_amount(await abciQuery(query)) as Record<string, bigint>
}
