import * as BorshJS from 'borsh'
import * as BorshTS from '@dao-xyz/borsh'
import type { Address } from '@fadroma/agent'
import { Core } from '@fadroma/agent'
import { CWConnection } from '../cw-connection'
import {
  getValidatorMetadata
} from './namada-validator'
import {
  getGovernanceParameters,
  getProposalCount,
  getProposalInfo
} from './namada-proposal'
import type { ValidatorMetaData } from './namada-validator'

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

}
