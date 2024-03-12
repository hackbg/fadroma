import { Core } from '@fadroma/agent'
import * as Borsher from 'borsher'
import { addr, decodeAddress } from './namada-address'
import {
  BecomeValidator,
  Bond,
  ConsensusKeyChange,
  CommissionChange,
  MetaDataChange,
  ClaimRewards,
  DeactivateValidator,
  ReactivateValidator,
  Redelegation,
  Unbond,
  UnjailValidator,
  Withdraw
} from './namada-pos'
import {
  ResignSteward,
  UpdateStewardCommission
} from './namada-pgf'
import {
  InitProposal,
  VoteProposal
} from './namada-gov'
import {
  pubkey,
  Section,
  CodeSection,
  DataSection,
  ciphertextSectionFields,
  codeSectionFields,
  dataSectionFields,
  headerFields,
  maspBuilderSectionFields,
  maspTxSectionFields,
  protocolTransactionFields,
  signatureSectionFields,
  wrapperTransactionFields,
} from './namada-tx-section'
import {
  array,
  struct,
  variants,
  variant,
  u8,
  u64,
  u256,
  i128,
  i256,
  option,
  unit,
  string,
  vec,
  Struct
} from '@hackbg/borshest'
import type {
  Fields
} from '@hackbg/borshest'

export class NamadaTransaction {
  static decode = (binary: Uint8Array) => {
    const { header: { tx_type, ...header }, sections } =
      Borsher.borshDeserialize(txSchema, binary) as any
    const [txType, details] = variant(tx_type)
    switch (txType) {
      case 'Raw':
        return new NamadaRawTransaction(header, details, sections)
      case 'Wrapper':
        return new NamadaWrapperTransaction(header, details, sections)
      case 'Decrypted':
        return new NamadaDecryptedTransaction(header, details, sections)
      case 'Protocol':
        return new NamadaProtocolTransaction(header, details, sections)
    }
    throw new Core.Error(
      `Unknown transaction variant "${String(txType)}". Valid are: Raw|Wrapper|Decrypted|Protocol`
    )
  }
  chainId!:    string
  expiration!: string|null
  timestamp!:  string
  codeHash!:   string
  dataHash!:   string
  memoHash!:   string
  txType!:     'Raw'|'Wrapper'|'Decrypted'|'Protocol'
  sections!:   Section[]
  constructor (header: object, sections: object[]) {
    const fields = Object.keys(headerFields).filter(key=>key!=='tx_type')
    Core.assignCamelCase(this, header, fields)
    for (const field of ['codeHash', 'dataHash', 'memoHash']) {
      if (this[field] instanceof Uint8Array) {
        this[field] = Core.base16.encode(this[field])
      } else if (this[field] instanceof Array) {
        this[field] = Core.base16.encode(new Uint8Array(this[field]))
      }
    }
    this.sections = sections.map(section=>Section.fromDecoded(section))
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
      console.log()
      section.print(console)
    }
  }
}

const txSchema = [
  ['header',        struct(...headerFields)],
  ['sections',      vec(variants(
    ['Data',        struct(...dataSectionFields)],
    ['ExtraData',   struct(...codeSectionFields)],
    ['Code',        struct(...codeSectionFields)],
    ['Signature',   struct(...signatureSectionFields)],
    ['Ciphertext',  struct(...ciphertextSectionFields)],
    ['MaspTx',      struct(...maspTxSectionFields)],
    ['MaspBuilder', struct(...maspBuilderSectionFields)],
    ['Header',      struct(...headerFields)]
  ))]
]

export class NamadaRawTransaction extends NamadaTransaction {
  txType = 'Raw' as 'Raw'
  constructor (header: object, details: object, sections: object[]) {
    super(header, sections)
    this.txType = 'Raw'
  }
}

export class NamadaWrapperTransaction extends NamadaTransaction {
  txType = 'Wrapper' as 'Wrapper'
  fee:                 {
    token:             string
    amountPerGasUnit:  {
      amount:          bigint,
      denomination:    number
    },
  }
  pk:                  string
  epoch:               bigint
  gasLimit:            bigint
  unshieldSectionHash: string|null
  constructor (header: object, details: object, sections: object[]) {
    super(header, sections)
    Core.assignCamelCase(this, details, wrapperTransactionFields.map(x=>x[0] as string))
    this.txType = 'Wrapper'
  }
}

export class NamadaDecryptedTransaction extends NamadaTransaction {
  txType = 'Decrypted' as 'Decrypted'
  undecryptable: boolean
  constructor (header: object, details: object, sections: object[]) {
    super(header, sections)
    this.txType = 'Decrypted'
    const [name, _] = variant(details)
    switch (name) {
      case 'Decrypted':
        this.undecryptable = false
        break
      case 'Undecryptable':
        this.undecryptable = true
        break
      default:
        throw new Core.Error(
          `Invalid decrypted transaction details. Allowed: {"Decrypted":{}}|{"Undecryptable":{}}`
        )
    }
  }
  decodeInner () {
    if (this.undecryptable) {
      throw new Core.Error('This transaction is marked as undecryptable.')
    }
    let tag
    for (const section of this.sections) {
      if (section instanceof CodeSection) {
        tag = (section as CodeSection).tag
        break
      }
    }
    if (!tag) {
      throw new Core.Error('Could not find a tagged code section in this transaction.')
    }
    let binary
    for (const section of this.sections) {
      if (section instanceof DataSection) {
        binary = (section as DataSection).data
        break
      }
    }
    if (!binary) {
      throw new Core.Error('Could not find a binary data section in this transaction.')
    }
    switch (tag) {
      case "tx_become_validator.wasm":
        return BecomeValidator.decode(binary)
      case "tx_bond.wasm":
        return Bond.decode(binary)
      case "tx_bridge_pool.wasm":
        return BridgePool.decode(binary)
      case "tx_change_consensus_key.wasm":
        return ConsensusKeyChange.decode(binary)
      case "tx_change_validator_commission.wasm":
        return CommissionChange.decode(binary)
      case "tx_change_validator_metadata.wasm":
        return MetaDataChange.decode(binary)
      case "tx_claim_rewards.wasm":
        return ClaimRewards.decode(binary)
      case "tx_deactivate_validator.wasm":
        return DeactivateValidator.decode(binary)
      case "tx_ibc.wasm":
        return IBC.decode(binary)
      case "tx_init_account.wasm":
        return InitAccount.decode(binary)
      case "tx_init_proposal.wasm":
        return InitProposal.decode(binary)
      case "tx_reactivate_validator.wasm":
        return ReactivateValidator.decode(binary)
      case "tx_redelegate.wasm":
        return Redelegation.decode(binary)
      case "tx_resign_steward.wasm":
        return ResignSteward.decode(binary)
      case "tx_reveal_pk.wasm":
        return RevealPK.decode(binary)
      case "tx_transfer.wasm":
        return Transfer.decode(binary)
      case "tx_unbond.wasm":
        return Unbond.decode(binary)
      case "tx_unjail_validator.wasm":
        return UnjailValidator.decode(binary)
      case "tx_update_account.wasm":
        return UpdateAccount.decode(binary)
      case "tx_update_steward_commission.wasm":
        return UpdateStewardCommission.decode(binary)
      case "tx_vote_proposal.wasm":
        return VoteProposal.decode(binary)
      case "tx_withdraw.wasm":
        return Withdraw.decode(binary)
      case "vp_implicit.wasm":
        return VPImplicit.decode(binary)
      case "vp_user.wasm":
        return VPUser.decode(binary)
    }
    throw new Core.Error(`Unsupported inner transaction type: ${tag}`)
  }
}

export class NamadaProtocolTransaction extends NamadaTransaction {
  txType = 'Protocol' as 'Protocol'
  pk: string
  tx: |'EthereumEvents'
      |'BridgePool'
      |'ValidatorSetUpdate'
      |'EthEventsVext'
      |'BridgePoolVext'
      |'ValSetUpdateVext'
  constructor (header: object, details: object, sections: object[]) {
    super(header, sections)
    Core.assignCamelCase(this, details, protocolTransactionFields.map(x=>x[0] as string))
    this.txType = 'Protocol'
  }
}

export class InitAccount extends Struct(
  ['public_keys',  vec(pubkey)],
  ['vp_code_hash', array(32, u8)],
  ['threshold',    u8],
) {
  publicKeys
  vpCodeHash
  threshold
  print (console) {
    throw new Error('print InitAccount: not implemented')
  }
}

export class UpdateAccount extends Struct(
  ['addr',         addr],
  ['vp_code_hash', option(array(32, u8))],
  ['public_keys',  vec(pubkey)],
  ['threshold',    option(u8)]
) {
  print (console) {
    throw new Error('print UpdateAccount: not implemented')
  }
}

export class RevealPK extends Struct() {
  print (console) {
    throw new Error('print RevealPK: not implemented')
  }
}

export class Transfer extends Struct(
  ["source",   addr],
  ["target",   addr],
  ["token",    addr],
  ["amount",   struct(
    ["amount", i256],
    ["denom",  u8]
  )],
  ["key",      option(string)],
  ["shielded", option(array(32, u8))]
) {
  declare source
  declare target
  declare token
  declare amount
  declare key
  declare shielded
  print (console) {
    console.log(Core.bold('  Decoded Transfer:'))
      .log('    Source:  ', Core.bold(this.source))
      .log('    Target:  ', Core.bold(this.target))
      .log('    Token:   ', Core.bold(this.token))
      .log('    Amount:  ', Core.bold(this.amount.amount))
      .log('      Denom: ', Core.bold(this.amount.denom))
      .log('    Key:     ', Core.bold(this.key))
      .log('    Shielded:', Core.bold(this.shielded))
  }
}

export class VPImplicit extends Struct() {
  print (console) {
    throw new Error('print VPImplicit: not implemented')
  }
}

export class VPUser extends Struct() {
  print (console) {
    throw new Error('print VPUser: not implemented')
  }
}

export class BridgePool extends Struct() {
  print (console) {
    throw new Error('print BridgePool: not implemented')
  }
}

export class IBC extends Struct() {
  print (console) {
    console.warn('decode and print IBC: not implemented')
  }
}
