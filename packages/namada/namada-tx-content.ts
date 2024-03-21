/** Index of inner transaction content. */

import { Core } from '@fadroma/agent'
import {
  InitProposal,
  VoteProposal
} from './namada-gov-tx'
import {
  UpdateStewardCommission,
  ResignSteward
} from './namada-pgf-tx'
import {
  BecomeValidator,
  Bond,
  ClaimRewards,
  ConsensusKeyChange,
  CommissionChange,
  MetaDataChange,
  Redelegation,
  Unbond,
  Withdraw,
  DeactivateValidator,
  ReactivateValidator,
  UnjailValidator
} from './namada-pos-tx'

export {
  InitProposal,
  VoteProposal,

  UpdateStewardCommission,
  ResignSteward,

  BecomeValidator,
  Bond,
  ClaimRewards,
  ConsensusKeyChange,
  CommissionChange,
  MetaDataChange,
  Redelegation,
  Unbond,
  Withdraw,
  DeactivateValidator,
  ReactivateValidator,
  UnjailValidator
}

export class InitAccount {
  static noun = 'Account Init'
  publicKeys!: string[]
  vpCodeHash!: string
  threshold!:  bigint
  constructor (properties: Partial<InitAccount> = {}) {
    Core.assign(this, properties, [
      "publicKeys",
      "vpCodeHash",
      "threshold"
    ])
  }
}

export class UpdateAccount {
  static noun = 'Account Update'
  address!:    string
  publicKeys!: string[]
  vpCodeHash!: string
  threshold!:  bigint
  constructor (properties: Partial<UpdateAccount> = {}) {
    Core.assign(this, properties, [
      "address",
      "publicKeys",
      "vpCodeHash",
      "threshold"
    ])
  }
}

export class RevealPK {
  static noun = 'PK Reveal'
  pk!: string
  constructor (properties: Partial<RevealPK> = {}) {
    Core.assign(this, properties, [
      "pk"
    ])
  }
}

export class Transfer {
  static noun = 'Transfer'
  source!:   string
  target!:   string
  token!:    string
  amount!:   bigint
  key!:      string
  shielded!: unknown
  constructor (properties: Partial<Transfer> = {}) {
    Core.assign(this, properties, [
      "source",
      "target",
      "token",
      "amount",
      "key",
      "shielded"
    ])
  }
}

export class IBC {
  static noun = 'IBC'
}

export class BridgePool {}

/** Mapping of target WASM to transaction kind. */
export default {
  'tx_become_validator.wasm':            BecomeValidator,
  'tx_bond.wasm':                        Bond,
  'tx_change_consensus_key.wasm':        ConsensusKeyChange,
  'tx_change_validator_commission.wasm': CommissionChange,
  'tx_change_validator_metadata.wasm':   MetaDataChange,
  'tx_claim_rewards.wasm':               ClaimRewards,
  'tx_deactivate_validator.wasm':        DeactivateValidator,
  'tx_init_account.wasm':                InitAccount,
  'tx_init_proposal.wasm':               InitProposal,
  'tx_reactivate_validator.wasm':        ReactivateValidator,
  'tx_resign_steward.wasm':              ResignSteward,
  'tx_reveal_pk.wasm':                   RevealPK,
  'tx_transfer.wasm':                    Transfer,
  'tx_unbond.wasm':                      Unbond,
  'tx_unjail_validator.wasm':            UnjailValidator,
  'tx_update_account.wasm':              UpdateAccount,
  'tx_update_steward_commission.wasm':   UpdateStewardCommission,
  'tx_vote_proposal.wasm':               VoteProposal,
  'tx_withdraw.wasm':                    Withdraw,
  'tx_ibc.wasm':                         IBC,
}
