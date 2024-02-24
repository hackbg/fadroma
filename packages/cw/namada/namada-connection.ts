import * as BorshJS from 'borsh'
import * as BorshTS from '@dao-xyz/borsh'
import type { Address } from '@fadroma/agent'
import { Core } from '@fadroma/agent'
import { CWConnection } from '../cw-connection'
import Borshes from './namada-borsh'
import { InternalAddresses } from './namada-address'
import { Proposal } from './namada-proposal'

type ValidatorMetaData = {
  email:          string
  description:    string|null
  website:        string|null
  discord_handle: string|null
  avatar:         string|null
}

export class NamadaConnection extends CWConnection {

  async getValidatorMetadata (address: Address): Promise<{
    metadata: ValidatorMetaData
    state: any
  }> {
    const status = await this.abciQuery(`/status`)
    console.log({status})

    const [
      metadata,
      /*commission,*/
      state,
    ] = await Promise.all([
      `/vp/pos/validator/metadata/${address}`,
      //`/vp/pos/validator/commission/${address}`, // TODO
      `/vp/pos/validator/state/${address}`,
    ].map(path => this.abciQuery(path)))

    return {
      metadata: BorshJS.deserialize(
        Borshes.ValidatorMetaData, 
        metadata
      ) as ValidatorMetaData,
      state: BorshJS.deserialize(
        Borshes.ValidatorState,
        state
      ) as any
      //commission: Borsh.deserialize(Borshes.CommissionPair, commission),
    }
  }

  async getProposalCount () {
    const counter = await this.abciQuery(`/shell/value/#${InternalAddresses.Governance}/counter`)
    return BorshJS.deserialize('u64', counter) as bigint
  }

  async getProposalInfo (number: Number) {
    // FIXME: don't use WebSocket?
    const binary = await this.abciQuery(`/vp/governance/proposal/${number}`)
    console.log(Core.brailleDump(binary))

    return Proposal.deserialize(binary)
  }

}

