import type { Address } from '@fadroma/agent'
import { CWConnection } from '../cw-connection'
import {
  getStakingParameters,
  getValidators,
  getValidatorAddresses,
  getConsensusValidators,
  getBelowCapacityValidators,
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

  getValidators () {
    return getValidators(this)
  }

  getValidatorAddresses () {
    return getValidatorAddresses(this)
  }

  getConsensusValidators () {
    return getConsensusValidators(this)
  }

  getBelowCapacityValidators () {
    return getBelowCapacityValidators(this)
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
