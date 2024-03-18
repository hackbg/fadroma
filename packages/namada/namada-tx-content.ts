/** Index of inner transaction content. */
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
}

export class UpdateAccount {
  static noun = 'Account Update'
}

export class RevealPK {
  static noun = 'PK Reveal'
}

export class Transfer {
  static noun = 'Transfer'
}

//export class InitAccount extends Struct(
  //['public_keys',  vec(pubkey)],
  //['vp_code_hash', array(32, u8)],
  //['threshold',    u8],
//) {
  //publicKeys
  //vpCodeHash
  //threshold
  //print (console) {
    //throw new Error('print InitAccount: not implemented')
  //}
//}

//export class UpdateAccount extends Struct(
  //['addr',         addr],
  //['vp_code_hash', option(array(32, u8))],
  //['public_keys',  vec(pubkey)],
  //['threshold',    option(u8)]
//) {
  //print (console) {
    //throw new Error('print UpdateAccount: not implemented')
  //}
//}

//export class RevealPK extends Struct() {
  //print (console) {
    //throw new Error('print RevealPK: not implemented')
  //}
//}

//export class Transfer extends Struct(
  //["source",   addr],
  //["target",   addr],
  //["token",    addr],
  //["amount",   struct(
    //["amount", i256],
    //["denom",  u8]
  //)],
  //["key",      option(string)],
  //["shielded", option(array(32, u8))]
//) {
  //declare source
  //declare target
  //declare token
  //declare amount
  //declare key
  //declare shielded
  //print (console) {
    //console.log(Core.bold('  Decoded Transfer:'))
      //.log('    Source:  ', Core.bold(this.source))
      //.log('    Target:  ', Core.bold(this.target))
      //.log('    Token:   ', Core.bold(this.token))
      //.log('    Amount:  ', Core.bold(this.amount.amount))
      //.log('      Denom: ', Core.bold(this.amount.denom))
      //.log('    Key:     ', Core.bold(this.key))
      //.log('    Shielded:', Core.bold(this.shielded))
  //}
//}

//export class VPImplicit extends Struct() {
  //print (console) {
    //throw new Error('print VPImplicit: not implemented')
  //}
//}

//export class VPUser extends Struct() {
  //print (console) {
    //throw new Error('print VPUser: not implemented')
  //}
//}

//export class BridgePool extends Struct() {
  //print (console) {
    //throw new Error('print BridgePool: not implemented')
  //}
//}

//export class IBC extends Struct() {
  //print (console) {
    //console.warn('decode and print IBC: not implemented')
  //}
//}

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
}
