import { fetchBalance } from './namadaFetchBalance.ts'
import { fetchBlock } from './namadaFetchBlock.ts'
import { fetchBlockResults } from './namadaFetchBlockResults.ts'
import { fetchBondWithSlashing } from './namadaFetchBondWithSlashing.ts'
import { fetchDelegations } from './namadaFetchDelegations.ts'
import { fetchDelegationsAt } from './namadaFetchDelegationsAt.ts'
import { fetchEpoch } from './namadaFetchEpoch.ts'
import { fetchEpochDuration } from './namadaFetchEpochDuration.ts'
import { fetchEpochFirstBlock } from './namadaFetchEpochFirstBlock.ts'
import { fetchGovernanceParameters } from './namadaFetchGovernanceParameters.ts'
import { fetchPGFParameters } from './namadaFetchPGFParameters.ts'
import { fetchProposalCount } from './namadaFetchProposalCount.ts'
import { fetchProposalInfo } from './namadaFetchProposalInfo.ts'
import { fetchProposalResult } from './namadaFetchProposalResult.ts'
import { fetchProposalVotes } from './namadaFetchProposalVotes.ts'
import { fetchProposalWasm } from './namadaFetchProposalWasm.ts'
import { fetchProtocolParameters } from './namadaFetchProtocolParameters.ts'
import { fetchStakingParameters } from './namadaFetchStakingParameters.ts'
import { fetchStorageValue } from './namadaFetchStorageValue.ts'
import { fetchTotalStaked } from './namadaFetchTotalStaked.ts'
import { fetchValidator } from './namadaFetchValidator.ts'
import { fetchValidatorAddresses } from './namadaFetchValidatorAddresses.ts'
import { fetchValidatorStake } from './namadaFetchValidatorStake.ts'
import { fetchValidators, fetchValidatorsIter } from './namadaFetchValidators.ts'
import { fetchValidatorsBelowCapacity, fetchValidatorsConsensus } from './namadaFetchValidatorSets.ts'

/** Slices first argument of implementation signature
  * (see https://stackoverflow.com/a/67605309) */
type Method<F> = F extends (arg0: never, ...rest: infer R) =>
  infer T ? ((...args: R) => T) : never

export interface Api {
  fetchBalance:                 Method<typeof fetchBalance>
  fetchBlockResults:            Method<typeof fetchBlockResults>
  fetchBondWithSlashing:        Method<typeof fetchBondWithSlashing>
  fetchDelegations:             Method<typeof fetchDelegations>
  fetchDelegationsAt:           Method<typeof fetchDelegationsAt>
  fetchEpoch:                   Method<typeof fetchEpoch>
  fetchEpochDuration:           Method<typeof fetchEpochDuration>
  fetchEpochFirstBlock:         Method<typeof fetchEpochFirstBlock>
  fetchGovernanceParameters:    Method<typeof fetchGovernanceParameters>
  fetchPGFParameters:           Method<typeof fetchPGFParameters>
  fetchProposalCount:           Method<typeof fetchProposalCount>
  fetchProposalInfo:            Method<typeof fetchProposalInfo>
  fetchProposalResult:          Method<typeof fetchProposalResult>
  fetchProposalVotes:           Method<typeof fetchProposalVotes>
  fetchProposalWasm:            Method<typeof fetchProposalWasm>
  fetchProtocolParameters:      Method<typeof fetchProtocolParameters>
  fetchStakingParameters:       Method<typeof fetchStakingParameters>
  fetchStorageValue:            Method<typeof fetchStorageValue>
  fetchTotalStaked:             Method<typeof fetchTotalStaked>
  fetchValidator:               Method<typeof fetchValidator>
  fetchValidatorAddresses:      Method<typeof fetchValidatorAddresses>
  fetchValidatorStake:          Method<typeof fetchValidatorStake>
  fetchValidators:              Method<typeof fetchValidators>
  fetchValidatorsBelowCapacity: Method<typeof fetchValidatorsBelowCapacity>
  fetchValidatorsConsensus:     Method<typeof fetchValidatorsConsensus>
  fetchValidatorsIter:          Method<typeof fetchValidatorsIter>
}

export default {
  fetchBalance,
  fetchBlock,
  fetchBlockResults,
  fetchBondWithSlashing,
  fetchDelegations,
  fetchDelegationsAt,
  fetchEpoch,
  fetchEpochDuration,
  fetchEpochFirstBlock,
  fetchGovernanceParameters,
  fetchPGFParameters,
  fetchProposalCount,
  fetchProposalInfo,
  fetchProposalResult,
  fetchProposalVotes,
  fetchProposalWasm,
  fetchProtocolParameters,
  fetchStakingParameters,
  fetchStorageValue,
  fetchTotalStaked,
  fetchValidator,
  fetchValidatorAddresses,
  fetchValidatorStake,
  fetchValidators,
  fetchValidatorsIter,
  fetchValidatorsBelowCapacity,
  fetchValidatorsConsensus
}
