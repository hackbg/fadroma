import { Core } from '@fadroma/agent'
import * as Borsher from 'borsher'
import { schemaEnum, enumVariant } from './namada-enum'
import { addressSchema, decodeAddress } from './namada-address'
import { u256Schema } from './namada-u256'
import { fromBorshStruct } from './namada-struct'
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

const Schema = Borsher.BorshSchema

const hashSchema = Schema.Array(Schema.u8, 32)

const publicKeySchema = schemaEnum([
  ['Ed25519',   Schema.Array(Schema.u8, 32)],
  ['Secp256k1', Schema.Array(Schema.u8, 33)],
])

const wrapperTransactionFields = {
  fee:                   Schema.Struct({
    amount_per_gas_unit: Schema.Struct({
      amount:            u256Schema,
      denomination:      Schema.u8,
    }),
    token:               addressSchema,
  }),
  pk:                    publicKeySchema,
  epoch:                 Schema.u64,
  gas_limit:             Schema.u64,
  unshield_section_hash: Schema.Option(hashSchema),
}

const protocolTransactionFields = {
  pk:                      publicKeySchema,
  tx:                      schemaEnum([
    ['EthereumEvents',     Schema.Unit],
    ['BridgePool',         Schema.Unit],
    ['ValidatorSetUpdate', Schema.Unit],
    ['EthEventsVext',      Schema.Unit],
    ['BridgePoolVext',     Schema.Unit],
    ['ValSetUpdateVext',   Schema.Unit],
  ]),
}

const headerFields = {
  chain_id:             Schema.String,
  expiration:           Schema.Option(Schema.String),
  timestamp:            Schema.String,
  code_hash:            hashSchema,
  data_hash:            hashSchema,
  memo_hash:            hashSchema,
  tx_type:              schemaEnum([
    ['Raw',             Schema.Unit],
    ['Wrapper',         Schema.Struct(wrapperTransactionFields)],
    ['Decrypted',       schemaEnum([
      ['Decrypted',     Schema.Unit],
      ['Undecryptable', Schema.Unit],
    ])],
    ['Protocol',        Schema.Struct(protocolTransactionFields)],
  ])
}

export class NamadaTransaction {
  static fromBorsh = (binary: Uint8Array) => {
    const { header: { tx_type, ...header }, sections } =
      Borsher.borshDeserialize(txSchema, binary) as any
    const [txType, details] = enumVariant(tx_type)
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
    Core.assignCamelCase(this, header, Object.keys(headerFields))
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
    console
      .log('-', Core.bold(`${this.txType} transaction:`))
      .log('  Chain ID:  ', Core.bold(this.chainId))
      .log('  Timestamp: ', Core.bold(this.timestamp))
      .log('  Expiration:', Core.bold(this.expiration))
      .log('  Code hash: ', Core.bold(this.codeHash))
      .log('  Data hash: ', Core.bold(this.dataHash))
      .log('  Memo hash: ', Core.bold(this.memoHash))
      .log(Core.bold('  Sections:  '))
    for (const section of this.sections) {
      console.log()
      section.print(console)
    }
  }
}

export class Section {
  static fromDecoded = (section: object) => {
    const [variant, details] = enumVariant(section)
    switch (variant) {
      case 'Data':
        return new DataSection(details)
      case 'ExtraData':
        return new ExtraDataSection(details)
      case 'Code':
        return new CodeSection(details)
      case 'Signature':
        return new SignatureSection(details)
      case 'Ciphertext':
        return new CiphertextSection(details)
      case 'MaspTx':
        return new MaspTxSection(details)
      case 'MaspBuilder':
        return new MaspBuilderSection(details)
      case 'Header':
        return new HeaderSection(details)
    }
  }
  print (console) {
    console.log(this)
  }
}

export class DataSection extends Section {
  salt: string
  data: Uint8Array
  constructor ({ salt, data }: { salt: number[], data: number[] }) {
    super()
    this.salt = Core.base16.encode(new Uint8Array(salt))
    this.data = new Uint8Array(data)
  }
  print (console) {
    console
      .log('   ', Core.bold('Data section:'))
      .log('    Salt:', this.salt)
      .log('    Data:', Core.base64.encode(this.data))
  }
}

const dataSectionFields = {
  salt: Schema.Array(Schema.u8, 8),
  data: Schema.Vec(Schema.u8),
}

export class ExtraDataSection extends Section {
  salt: string
  data: Uint8Array
  tag:  string
  constructor ({ salt, data, tag }: { salt: number[], data: number[], tag: string }) {
    super()
    this.salt = Core.base16.encode(new Uint8Array(salt))
    this.data = new Uint8Array(data)
    this.tag  = tag
  }
  print (console) {
    console
      .log('   ', Core.bold('Extra data section:'))
      .log('    Salt:', Core.bold(this.salt))
      .log('    Data:', Core.bold(Core.base64.encode(this.data)))
      .log('    Tag: ', Core.bold(this.tag))
  }
}

export class CodeSection extends Section {
  salt: string
  data: Uint8Array
  tag:  string
  constructor ({ salt, data, tag }: { salt: number[], data: number[], tag: string }) {
    super()
    this.salt = Core.base16.encode(new Uint8Array(salt))
    this.data = new Uint8Array(data)
    this.tag  = tag
  }
  print (console) {
    console
      .log('   ', Core.bold('Code section:'))
      .log('    Salt:', Core.bold(this.salt))
    if (this.data.length > 0) {
      console
        .log('    Data:', Core.base64.encode(this.data))
    }
    console
      .log('    Tag: ', Core.bold(this.tag))
  }
}

const codeFields = {
  salt:      Schema.Array(Schema.u8, 8),
  code:      schemaEnum([
    ['Hash', hashSchema],
    ['Id',   Schema.Vec(Schema.u8)],
  ]),
  tag:       Schema.Option(Schema.String),
}

export class SignatureSection extends Section {
  targets:    string[]
  signer:     { Address: string }|{ PubKeys: string[] }
  signatures: Array<{ Ed25519: string }|{ Secp256k1: string }>
  constructor (
    { targets, signer, signatures }: { targets: any[], signer: any, signatures: any[] }
  ) {
    super()
    this.targets    = targets.map(target=>Core.base16.encode(new Uint8Array(target)))
    this.signer     = signer
    this.signatures = signatures
  }
  print (console) {
    console
      .log('   ', Core.bold('Signature section:'))
      .log('    Targets:   ')
    for (const target of this.targets) {
      console.log('     ', Core.bold(target))
    }
    const [signerVariant, signerDetails] = enumVariant(this.signer)
    switch (signerVariant) {
      case 'Address':
        console.log('    Signed by', Core.bold('address:'), Core.bold(decodeAddress(signerDetails)))
        break
      case 'PubKeys':
        console.log('    Signed by', Core.bold('public keys:'))
        for (const pubkey of signerDetails as any[]) {
          const [variant, details] = enumVariant(pubkey)
          console.log(
            '     ', Core.bold(variant), Core.bold(Core.base16.encode(new Uint8Array(details)))
          )
        }
        break
      default:
        console.warn('    Invalid signer variant:', signerVariant)
    }
    console.log('    Signatures:')
    for (const [key, value] of this.signatures.entries()) {
      const [variant, data] = enumVariant(value)
      console.log(
        `      #${key}`,
        Core.bold(String(variant)),
        Core.bold(Core.base64.encode(new Uint8Array(data)))
      )
    }
  }
}

const signatureSectionFields = {
  targets:        Schema.Vec(hashSchema),
  signer:         schemaEnum([
    ['Address',   addressSchema],
    ['PubKeys',   Schema.Vec(publicKeySchema)],
  ]),
  signatures:     Schema.HashMap(Schema.u8, schemaEnum([
    ['Ed25519',   Schema.Array(Schema.u8, 64)],
    ['Secp256k1', Schema.Array(Schema.u8, 65)]
  ]))
}

export class CiphertextSection extends Section {
  opaque: Uint8Array
  constructor ({ opaque }: { opaque: any }) {
    super()
    this.opaque = new Uint8Array(opaque)
  }
  print (console) {
    console
      .log('   ', Core.bold('Ciphertext section:'))
      .log('    Opaque:', Core.base64.encode(this.opaque))
  }
}

const ciphertextSectionFields = {
  opaque: Schema.Vec(Schema.u8)
}

export class MaspTxSection extends Section {
  txid:              string
  version:           'MASPv5'
  consensusBranchId: 'MASP'
  lockTime:          bigint
  expiryHeight:      bigint
  transparentBundle: null|{}
  saplingBundle:     null|{}
  constructor ({ txid, data }) {
    super()
    this.txid = txid
    Core.assignCamelCase(this, data, Object.keys(maspTxSectionDataFields))
  }
  print (console) {
    console
      .log('   ', Core.bold('MASP transaction section:'))
      .log('    TX ID:             ', this.txid)
      .log('    Version:           ', this.version)
      .log('    Consensus branch:  ', this.consensusBranchId)
      .log('    Lock time:         ', this.lockTime)
      .log('    Expiry height:     ', this.expiryHeight)
      .log('    Transparent bundle:', this.transparentBundle)
      .log('    Sapling bundle:    ', this.saplingBundle)
  }
}

const assetTypeSchema = Schema.Struct({
  identifier: Schema.Array(Schema.u8, 32),
  nonce:      Schema.Option(Schema.u8)
})

const txOutSchema = Schema.Struct({
  asset_type: assetTypeSchema,
  value:      Schema.u64,
  address:    Schema.Array(Schema.u8, 20)
})

const bundleSchema = Schema.Struct({
  vin:               Schema.Vec(Schema.Struct({
    asset_type:      assetTypeSchema,
    value:           Schema.u64,
    address:         Schema.Array(Schema.u8, 20),
    transparent_sig: Schema.Unit,
  })),
  vout:              Schema.Vec(txOutSchema),
  authorization:     Schema.Unit
})

const maspTxSectionDataFields = {
  version:             schemaEnum([
    ['MASPv5',         Schema.Unit]
  ]),
  consensus_branch_id: schemaEnum([
    ['MASP',           Schema.Unit]
  ]),
  lock_time:           Schema.u32,
  expiry_height:       Schema.u32,
  transparent_bundle:  Schema.Option(bundleSchema),
  sapling_bundle:      Schema.Option(bundleSchema),
}

const maspTxSectionFields = {
  txid: Schema.Array(Schema.u8, 32),
  data: Schema.Struct(maspTxSectionDataFields),
}

export class MaspBuilderSection extends Section {
  hash:                 string
  assetTypes:           Set<{
    token:              string
    denomination:       bigint
    position:           'Zero'|'One'|'Two'|'Three'
    epoch:              bigint|null
  }>
  metadata: {
    spend_indices:      bigint[]
    convert_indices:    bigint[]
    output_indices:     bigint[]
  }
  builder: {
    params:             object
    rng:                object
    targetHeight:       object
    expiryHeight:       object
    transparentBuilder: object
    saplingBuilder:     object
  }
  constructor (data) {
    super()
    Core.assignCamelCase(this, data, Object.keys(maspBuilderSectionFields))
  }
  print (console) {
    console
      .log('   ', Core.bold('MASP builder section:'))
      .log('    Hash:       ', this.hash)
      .log('    Asset types:', this.assetTypes)
      .log('    Metadata:   ', this.metadata)
      .log('    Builder:    ', this.builder)
  }
}

const extendedPointSchema = Schema.Struct({
  u:  Schema.Array(Schema.u64, 4),
  v:  Schema.Array(Schema.u64, 4),
  z:  Schema.Array(Schema.u64, 4),
  t1: Schema.Array(Schema.u64, 4),
  t2: Schema.Array(Schema.u64, 4),
})

const noteSchema = Schema.Struct({
  asset_type:   Schema.Struct({
    identifier: Schema.Array(Schema.u8, 32),
  }),
  value:        Schema.u64,
  g_d:          extendedPointSchema,
  pk_d:         extendedPointSchema,
  rseed:        schemaEnum([
    ['BeforeZip212', Schema.Array(Schema.u64, 4)],
    ['AfterZip212',  Schema.Array(Schema.u8, 32)],
  ]),
})

const merklePathSchema = Schema.Struct({
  auth_path: Schema.Vec(Schema.Struct({
    _0:      Schema.Struct({
      repr:  Schema.Array(Schema.u8, 32)
    }),
    _1:      Schema.bool
  })),
  position:  Schema.u64
})

const maspBuilderSectionFields = {
  hash:                     hashSchema,
  asset_types:              Schema.HashSet(Schema.Struct({
    token:                  addressSchema,
    denomination:           Schema.u8,
    position:               schemaEnum([
      ['Zero',              Schema.Unit],
      ['One',               Schema.Unit],
      ['Two',               Schema.Unit],
      ['Three',             Schema.Unit],
    ]),
    epoch:                  Schema.Option(Schema.u64)
  })),
  metadata:                 Schema.Struct({
    spend_indices:          Schema.Vec(Schema.u32),
    convert_indices:        Schema.Vec(Schema.u32),
    output_indices:         Schema.Vec(Schema.u32),
  }),
  builder:                  Schema.Struct({
    params:                 Schema.Unit,
    rng:                    Schema.Unit,
    target_height:          Schema.u32,
    expiry_height:          Schema.u32,
    transparent_builder:    Schema.Struct({
      inputs:               Schema.Vec(Schema.Struct({
        coin:               txOutSchema
      })),
      vout:                 Schema.Vec(txOutSchema)
    }),
    sapling_builder:        Schema.Struct({
      params:               Schema.Unit,
      spend_anchor:         Schema.Option(Schema.Array(Schema.u64, 4)),
      target_height:        Schema.u32,
      value_balance:        Schema.i128,
      convert_anchor:       Schema.Option(Schema.Array(Schema.u64, 4)),
      spends:               Schema.Vec(Schema.Struct({
        extsk:              Schema.Struct({
          depth:            Schema.u8,
          parent_fvk_tag:   Schema.Array(Schema.u8, 4),
          child_index:      schemaEnum([
            ['NonHardened', Schema.u32],
            ['Hardened',    Schema.u32],
          ]),
          chain_code:       Schema.Array(Schema.u8, 32),
          fbk:              Schema.Struct({
            vk:             Schema.Struct({
              ak:           extendedPointSchema,
              nk:           extendedPointSchema,
            }),
            ovk:            Schema.Array(Schema.u8, 32),
          }),
          dk:               Schema.Array(Schema.u8, 32),
        }),
        diversifier:        Schema.Array(Schema.u8, 11),
        note:               noteSchema,
        alpha:              Schema.Array(Schema.u64, 4),
        merkle_path:        merklePathSchema
      })),
      converts:             Schema.Vec(Schema.Struct({
        allowed:            Schema.Struct({
          assets:           Schema.i128,
          generator:        extendedPointSchema
        }),
        value:              Schema.u64,
        merkle_path:        merklePathSchema,
      })),
      outputs:              Schema.Vec(Schema.Struct({
        ovk:                Schema.Option(Schema.Array(Schema.u8, 32)),
        to:                 Schema.Struct({
          pk_d:             extendedPointSchema,
          diversifier:      Schema.Array(Schema.u8, 11)
        }),
        note:               noteSchema,
        memo:               Schema.Array(Schema.u8, 512)
      })),
    })
  })
}

export class HeaderSection extends Section {
  chainId!:    string
  expiration!: string|null
  timestamp!:  string
  codeHash!:   string
  dataHash!:   string
  memoHash!:   string
  txType!:     object
  constructor (data) {
    super()
    Core.assignCamelCase(this, data, Object.keys(headerFields))
  }
}

const txSchema = Schema.Struct({
  header:           Schema.Struct(headerFields),
  sections:         Schema.Vec(schemaEnum([
    ['Data',        Schema.Struct(dataSectionFields)],
    ['ExtraData',   Schema.Struct(codeFields)],
    ['Code',        Schema.Struct(codeFields)],
    ['Signature',   Schema.Struct(signatureSectionFields)],
    ['Ciphertext',  Schema.Struct(ciphertextSectionFields)],
    ['MaspTx',      Schema.Struct(maspTxSectionFields)],
    ['MaspBuilder', Schema.Struct(maspBuilderSectionFields)],
    ['Header',      Schema.Struct(headerFields)]
  ]))
})

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
    Core.assignCamelCase(this, details, Object.keys(wrapperTransactionFields))
    this.txType = 'Wrapper'
  }
}

export class NamadaDecryptedTransaction extends NamadaTransaction {
  txType = 'Decrypted' as 'Decrypted'
  undecryptable: boolean
  constructor (header: object, details: object, sections: object[]) {
    super(header, sections)
    this.txType = 'Decrypted'
    const [variant, _] = enumVariant(details)
    switch (variant) {
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
        return BecomeValidator.fromBorsh(binary)
      case "tx_bond.wasm":
        return Bond.fromBorsh(binary)
      case "tx_bridge_pool.wasm":
        return BridgePool.fromBorsh(binary)
      case "tx_change_consensus_key.wasm":
        return ConsensusKeyChange.fromBorsh(binary)
      case "tx_change_validator_commission.wasm":
        return CommissionChange.fromBorsh(binary)
      case "tx_change_validator_metadata.wasm":
        return MetaDataChange.fromBorsh(binary)
      case "tx_claim_rewards.wasm":
        return ClaimRewards.fromBorsh(binary)
      case "tx_deactivate_validator.wasm":
        return DeactivateValidator.fromBorsh(binary)
      case "tx_ibc.wasm":
        return IBC.fromBorsh(binary)
      case "tx_init_account.wasm":
        return InitAccount.fromBorsh(binary)
      case "tx_init_proposal.wasm":
        return InitProposal.fromBorsh(binary)
      case "tx_reactivate_validator.wasm":
        return ReactivateValidator.fromBorsh(binary)
      case "tx_redelegate.wasm":
        return Redelegation.fromBorsh(binary)
      case "tx_resign_steward.wasm":
        return ResignSteward.fromBorsh(binary)
      case "tx_reveal_pk.wasm":
        return RevealPK.fromBorsh(binary)
      case "tx_transfer.wasm":
        return Transfer.fromBorsh(binary)
      case "tx_unbond.wasm":
        return Unbond.fromBorsh(binary)
      case "tx_unjail_validator.wasm":
        return UnjailValidator.fromBorsh(binary)
      case "tx_update_account.wasm":
        return UpdateAccount.fromBorsh(binary)
      case "tx_update_steward_commission.wasm":
        return UpdateStewardCommission.fromBorsh(binary)
      case "tx_vote_proposal.wasm":
        return VoteProposal.fromBorsh(binary)
      case "tx_withdraw.wasm":
        return Withdraw.fromBorsh(binary)
      case "vp_implicit.wasm":
        return VPImplicit.fromBorsh(binary)
      case "vp_user.wasm":
        return VPUser.fromBorsh(binary)
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
    Core.assignCamelCase(this, details, Object.keys(protocolTransactionFields))
    this.txType = 'Protocol'
  }
}

export class InitAccount extends fromBorshStruct({
  public_keys:  Schema.Vec(publicKeySchema),
  vp_code_hash: Schema.Array(Schema.u8, 32),
  threshold:    Schema.u8,
}) {
  publicKeys
  vpCodeHash
  threshold
}

export class UpdateAccount extends fromBorshStruct({
  addr:         addressSchema,
  vp_code_hash: Schema.Option(Schema.Array(Schema.u8, 32)),
  public_keys:  Schema.Vec(publicKeySchema),
  threshold:    Schema.Option(Schema.u8)
}) {}

export class RevealPK extends fromBorshStruct({}) {}

export class Transfer extends fromBorshStruct({
  source:   addressSchema,
  target:   addressSchema,
  token:    addressSchema,
  amount:   denominatedAmountSchema,
  key:      Schema.Option(Schema.String),
  shielded: Schema.Option(Schema.Array(Schema.u8, 32))
}) {
  source
  target
  token
  amount
  key
  shielded
}

export class VPImplicit extends fromBorshStruct({}) {}

export class VPUser extends fromBorshStruct({}) {}

export class BridgePool extends fromBorshStruct({}) {}

export class IBC extends fromBorshStruct({}) {}
