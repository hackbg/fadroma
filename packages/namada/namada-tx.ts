import { Core } from '@fadroma/agent'
import {
  Section,
  DataSection,
  ExtraDataSection,
  CodeSection,
  SignatureSection,
  CiphertextSection,
  MaspTxSection,
  MaspBuilderSection,
  HeaderSection,
  UnknownSection
} from './namada-tx-section'

export class NamadaTransaction {

  static fromDecoded = ({ sections, ...header }) => new this({
    ...header,
    sections: sections.map(section=>{
      switch (section.type) {
        case 'Data':
          return new DataSection(section)
        case 'ExtraData':
          return new ExtraDataSection(section)
        case 'Code':
          return new CodeSection(section)
        case 'Signature':
          return new SignatureSection(section)
        case 'Ciphertext':
          return new CiphertextSection()
        case 'MaspBuilder':
          return new MaspBuilderSection(section)
        case 'Header':
          return new HeaderSection(section)
        case 'MaspTx':
          return new MaspTxSection(section)
        default:
          return new UnknownSection(section)
      }
    })
  })

  chainId:    string
  expiration: string|null
  timestamp:  string
  codeHash:   string
  dataHash:   string
  memoHash:   string
  txType:     'Raw'|'Wrapper'|'Decrypted'|'Protocol'
  sections:   Section[]

  constructor (properties: Partial<NamadaTransaction> = {}) {
    Core.assign(this, properties, [
      'chainId',
      'expiration',
      'timestamp',
      'codeHash',
      'dataHash',
      'memoHash',
      'txType',
      'sections',
    ])
  }

  print (console = new Core.Console()) {
    console.log('-', Core.bold(`${this.txType} transaction:`))
      .log('  Chain ID:  ', Core.bold(this.chainId))
      .log('  Timestamp: ', Core.bold(this.timestamp))
      .log('  Expiration:', Core.bold(this.expiration))
      .log('  Code hash: ', Core.bold(this.codeHash))
      .log('  Data hash: ', Core.bold(this.dataHash))
      .log('  Memo hash: ', Core.bold(this.memoHash))
      .log('  Sections:  ', Core.bold(this.sections?.length))
  }

  printSections (console = new Core.Console()) {
    console.log(Core.bold('  Sections:  '))
    for (const section of this.sections) {
      section.print(console)
    }
  }
}

export class NamadaRawTransaction extends NamadaTransaction {
  //txType = 'Raw' as 'Raw'
  //constructor (header: object, details: object, sections: object[]) {
    //super(header, sections)
    //this.txType = 'Raw'
  //}
}

export class NamadaWrapperTransaction extends NamadaTransaction {
  //txType = 'Wrapper' as 'Wrapper'
  //declare fee:                 {
    //token:                     string
    //amountPerGasUnit:          {
      //amount:                  bigint,
      //denomination:            number
    //},
  //}
  //declare pk:                  string
  //declare epoch:               bigint
  //declare gasLimit:            bigint
  //declare unshieldSectionHash: string|null
  //constructor (header: object, details: object, sections: object[]) {
    //super(header, sections)
    //Core.assignCamelCase(this, details, wrapperTransactionFields.map(x=>x[0] as string))
    //this.txType = 'Wrapper'
  //}
}

export class NamadaDecryptedTransaction extends NamadaTransaction {
  //txType = 'Decrypted' as 'Decrypted'
  //undecryptable: boolean
  //constructor (header: object, details: object, sections: object[]) {
    //super(header, sections)
    //this.txType = 'Decrypted'
    //const [name, _] = variant(details)
    //switch (name) {
      //case 'Decrypted':
        //this.undecryptable = false
        //break
      //case 'Undecryptable':
        //this.undecryptable = true
        //break
      //default:
        //throw new Core.Error(
          //`Invalid decrypted transaction details. Allowed: {"Decrypted":{}}|{"Undecryptable":{}}`
        //)
    //}
  //}
  //decodeInner () {
    //return { print () {} }
    //if (this.undecryptable) {
      //throw new Core.Error('This transaction is marked as undecryptable.')
    //}
    //let tag
    //for (const section of this.sections) {
      //if (section instanceof CodeSection) {
        //tag = (section as CodeSection).tag
        //break
      //}
    //}
    //if (!tag) {
      //throw new Core.Error('Could not find a tagged code section in this transaction.')
    //}
    //let binary
    //for (const section of this.sections) {
      //if (section instanceof DataSection) {
        //binary = (section as DataSection).data
        //break
      //}
    //}
    ////console.log('sections', this.sections)
    //if (!binary) {
      //throw new Core.Error('Could not find a binary data section in this transaction.')
    //}
    //switch (tag) {
      //case "tx_become_validator.wasm":
        //return BecomeValidator.decode(binary)
      //case "tx_bond.wasm":
        //return Bond.decode(binary)
      //case "tx_bridge_pool.wasm":
        //return BridgePool.decode(binary)
      //case "tx_change_consensus_key.wasm":
        //return ConsensusKeyChange.decode(binary)
      //case "tx_change_validator_commission.wasm":
        //return CommissionChange.decode(binary)
      //case "tx_change_validator_metadata.wasm":
        //return MetaDataChange.decode(binary)
      //case "tx_claim_rewards.wasm":
        //return ClaimRewards.decode(binary)
      //case "tx_deactivate_validator.wasm":
        //return DeactivateValidator.decode(binary)
      //case "tx_ibc.wasm":
        //return IBC.decode(binary)
      //case "tx_init_account.wasm":
        //return InitAccount.decode(binary)
      //case "tx_init_proposal.wasm":
        //return InitProposal.decode(binary)
      //case "tx_reactivate_validator.wasm":
        //return ReactivateValidator.decode(binary)
      //case "tx_redelegate.wasm":
        //return Redelegation.decode(binary)
      //case "tx_resign_steward.wasm":
        //return ResignSteward.decode(binary)
      //case "tx_reveal_pk.wasm":
        //return RevealPK.decode(binary)
      //case "tx_transfer.wasm":
        //return Transfer.decode(binary)
      //case "tx_unbond.wasm":
        //return Unbond.decode(binary)
      //case "tx_unjail_validator.wasm":
        //return UnjailValidator.decode(binary)
      //case "tx_update_account.wasm":
        //return UpdateAccount.decode(binary)
      //case "tx_update_steward_commission.wasm":
        //return UpdateStewardCommission.decode(binary)
      //case "tx_vote_proposal.wasm":
        //return { binary, print (console) { console.log(binary) } }
        ////return VoteProposal.decode(binary)
      //case "tx_withdraw.wasm":
        //return Withdraw.decode(binary)
      //case "vp_implicit.wasm":
        //return VPImplicit.decode(binary)
      //case "vp_user.wasm":
        //return VPUser.decode(binary)
    //}
    //throw new Core.Error(`Unsupported inner transaction type: ${tag}`)
  //}
}

export class NamadaProtocolTransaction extends NamadaTransaction {
  //txType = 'Protocol' as 'Protocol'
  //pk: string
  //tx: |'EthereumEvents'
      //|'BridgePool'
      //|'ValidatorSetUpdate'
      //|'EthEventsVext'
      //|'BridgePoolVext'
      //|'ValSetUpdateVext'
  //constructor (header: object, details: object, sections: object[]) {
    //super(header, sections)
    //Core.assignCamelCase(this, details, protocolTransactionFields.map(x=>x[0] as string))
    //this.txType = 'Protocol'
  //}
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

//export const wrapperTransactionFields: Fields = [
  //["fee",                 struct(
    //["amountPerGasUnit",  struct(
      //["amount",          u256],
      //["denomination",    u8],
    //)],
    //["token",             addr],
  //)],
  //["pk",                  pubkey],
  //["epoch",               u64],
  //["gasLimit",            u64],
  //["unshieldSectionHash", option(hashSchema)],
//]

//export const protocolTransactionFields: Fields = [
  //["pk",                   pubkey],
  //["tx",                   variants(
    //['EthereumEvents',     unit],
    //['BridgePool',         unit],
    //['ValidatorSetUpdate', unit],
    //['EthEventsVext',      unit],
    //['BridgePoolVext',     unit],
    //['ValSetUpdateVext',   unit],
  //)],
//]
