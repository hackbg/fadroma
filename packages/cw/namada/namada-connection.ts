import type { Address } from '@fadroma/agent'
import { CWConnection } from '../cw-connection'
import {
  getValidatorMetadata
} from './namada-validator'
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

  getValidatorMetadata (address: Address) {
    return getValidatorMetadata(this, address)
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
}
