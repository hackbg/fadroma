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
  getBond,
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
import {
  getPGFParameters,
  getPGFStewards,
  getPGFFundings,
  isPGFSteward
} from "./namada-pgf"

export class NamadaConnection extends CWConnection {

  getPGFParameters () {
    return getPGFParameters(this)
  }

  getPGFStewards () {
    return getPGFStewards(this)
  }

  getPGFFundings () {
    return getPGFFundings(this)
  }

  isPGFSteward (address: Address) {
    return isPGFSteward(this)
  }

  getStakingParameters () {
    return getStakingParameters(this)
  }

  getValidatorAddresses () {
    return getValidatorAddresses(this)
  }

  getValidators (options?: {
    details?:    boolean,
    pagination?: [number, number]
    allStates?:  boolean,
    addresses?:  string[],
  }) {
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
  getBond(source:Address, validator:Address, delta: number) {
    return getBond(this, source, validator, delta)
  }
}
