import type { Address } from '../deps.ts'
import type { Context } from './namada.ts'
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
