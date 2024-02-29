import type { Address } from '@fadroma/agent'
import { CWConnection } from '../cw-connection'
import {
  getStakingParameters,
  getValidators,
  getValidatorsConsensus,
  getValidatorsBelowCapacity,
  getValidatorAddresses,
  getValidator,
  getValidatorStake,
} from './namada-staked'
import {
  getGovernanceParameters,
  getProposalCount,
  getProposalInfo
} from './namada-proposal'
import {
  getCurrentEpoch
} from "./namada-epoch";
import {
  getTotalStaked
} from "./namada-staked"

export class NamadaConnection extends CWConnection {

  getStakingParameters () {
    return getStakingParameters(this)
  }

  getValidatorAddresses () {
    return getValidatorAddresses(this)
  }

  getValidators (options?: { metadata?: boolean }) {
    return getValidators(this, options)
  }

  getValidatorsConsensus () {
    return getValidatorsConsensus(this)
  }

  getValidatorsBelowCapacity () {
    return getValidatorsBelowCapacity(this)
  }

  getValidator (address: Address) {
    return getValidator(this, address)
  }

  getGovernanceParameters () {
    return getGovernanceParameters(this)
  }

  getProposalCount () {
    return getProposalCount(this)
  }

  getProposalInfo (id: number) {
    return getProposalInfo(this, id)
  }

  getCurrentEpoch () {
    return getCurrentEpoch(this)
  }

  getTotalStaked () {
    return getTotalStaked(this)
  }

  getValidatorStake(address: Address) {
    return getValidatorStake(this, address)
  }
}
