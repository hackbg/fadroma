import { Core } from '@fadroma/agent'
import {
  variant, array, vec, u8, u32, u64, u256, i128, string, option, variants, unit, struct, map, set,
  bool
} from '@hackbg/borshest'
import type { Fields } from '@hackbg/borshest'

const hashSchema = array(32, u8)

const publicKeySchema = variants(
  ['Ed25519',   array(32, u8)],
  ['Secp256k1', array(33, u8)],
)

export const wrapperTransactionFields: Fields = [
  ["fee",                 struct(
    ["amountPerGasUnit",  struct(
      ["amount",          u256],
      ["denomination",    u8],
    )],
    ["token",             addressSchema],
  )],
  ["pk",                  publicKeySchema],
  ["epoch",               u64],
  ["gasLimit",            u64],
  ["unshieldSectionHash", option(hashSchema)],
]

export const protocolTransactionFields: Fields = [
  ["pk",                   publicKeySchema],
  ["tx",                   variants(
    ['EthereumEvents',     unit],
    ['BridgePool',         unit],
    ['ValidatorSetUpdate', unit],
    ['EthEventsVext',      unit],
    ['BridgePoolVext',     unit],
    ['ValSetUpdateVext',   unit],
  )],
]

export class Section {
  static fromDecoded = (section: object) => {
    const [name, details] = variant(section)
    switch (name) {
      case 'Data':        return new DataSection(details)
      case 'ExtraData':   return new ExtraDataSection(details)
      case 'Code':        return new CodeSection(details)
      case 'Signature':   return new SignatureSection(details)
      case 'Ciphertext':  return new CiphertextSection(details)
      case 'MaspTx':      return new MaspTxSection(details)
      case 'MaspBuilder': return new MaspBuilderSection(details)
      case 'Header':      return new HeaderSection(details)
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

export const dataSectionFields: Fields = [
  ["salt", array(8, u8)],
  ["data", vec(u8)],
]

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

export const codeSectionFields: Fields = [
  ["salt",   array(8, u8)],
  ["code",   variants(
    ['Hash', hashSchema],
    ['Id',   vec(u8)],
  )],
  ["tag",    option(string)],
]

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
    const [signerVariant, signerDetails] = variant(this.signer)
    switch (signerVariant) {
      case 'Address':
        console.log('    Signed by', Core.bold('address:'), Core.bold(decodeAddress(signerDetails)))
        break
      case 'PubKeys':
        console.log('    Signed by', Core.bold('public keys:'))
        for (const pubkey of signerDetails as any[]) {
          const [name, details] = variant(pubkey)
          console.log(
            '     ', Core.bold(name), Core.bold(Core.base16.encode(new Uint8Array(details)))
          )
        }
        break
      default:
        console.warn('    Invalid signer variant:', signerVariant)
    }
    console.log('    Signatures:')
    for (const [key, value] of this.signatures.entries()) {
      const [name, data] = variant(value)
      console.log(
        `      #${key}`,
        Core.bold(String(name)),
        Core.bold(Core.base64.encode(new Uint8Array(data)))
      )
    }
  }
}

export const signatureSectionFields: Fields = [
  ["targets",     vec(hashSchema)],
  ["signer",      variants(
    ['Address',   addressSchema],
    ['PubKeys',   vec(publicKeySchema)],
  )],
  ["signatures",  map(u8, variants(
    ['Ed25519',   array(64, u8)],
    ['Secp256k1', array(65, u8)]
  ))]
]

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

export const ciphertextSectionFields: Fields = [
  ["opaque", vec(u8)]
]

const assetTypeSchema = struct(
  ['identifier', array(32, u8)],
)

const transferTxSchema = struct(
  ['asset_type', assetTypeSchema],
  ['value',      u64],
  ['address',    array(20, u8)]
)

const transactionDataFields: Fields = [
  ['version',             array(2, u32)],
  ['consensus_branch_id', u32],
  ['lock_time',           u32],
  ['expiry_height',       u32],
  ['transparent_vin',     option(vec(transferTxSchema))],
  ['transparent_vout',    option(vec(transferTxSchema))],
  //shielded_spends:     option(vec(struct({
    //cv:                extendedPointSchema,
    //anchor:            array(u64, 4),
    //nullifier:         array(u8, 32),
    //rk:                extendedPointSchema,
    //zkproof:           array(u8, 192),
    //spend_auth_sig:    struct({
      //rbar:            array(u8, 32),
      //sbar:            array(u8, 32),
    //}),
  //}))),
  //shielded_converts:   option(vec(struct({
    //cv:                extendedPointSchema,
    //anchor:            array(u64, 4),
    //zkproof:           array(u8, 192)
  //}))),
  //shielded_outputs:    option(vec(struct({
    //cv:                extendedPointSchema,
    //cmu:               array(u64, 4),
    //ephemeral_key:     array(u8, 32),
    //enc_ciphertext:    array(u8, 612),
    //out_ciphertext:    array(u8, 80),
    //zkproof:           array(u8, 192)
  //}))),
  //value_balance:       option(Schema.i128),
  //spend_anchor:        option(array(u64, 4)),
  //convert_anchor:      option(array(u64, 4)),
]

export const maspTxSectionFields: Fields = transactionDataFields /*{
  txid: array(u8, 32),
  data: struct(transactionDataFields),
}*/

export class MaspTxSection extends Section {
  txid:              string
  version:           bigint
  consensusBranchId: bigint
  lockTime:          bigint
  expiryHeight:      bigint
  transparentBundle: null|{}
  saplingBundle:     null|{}
  constructor ({ txid, data }) {
    super()
    this.txid = txid
    Core.assignCamelCase(this, data, Object.keys(transactionDataFields))
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

const extendedPointSchema = struct(
  ['u',  array(4, u64)],
  ['v',  array(4, u64)],
  ['z',  array(4, u64)],
  ['t1', array(4, u64)],
  ['t2', array(4, u64)],
)

const noteSchema = struct(
  ['asset_type',   struct(
    ['identifier', array(32, u8)],
  )],
  ['value',        u64],
  ['g_d',          extendedPointSchema],
  ['pk_d',         extendedPointSchema],
  ['rseed',        variants(
    ['BeforeZip212', array(4, u64)],
    ['AfterZip212',  array(32, u8)],
  )],
)

const merklePathSchema = struct(
  ['auth_path', struct(
    ['_0',      struct(['repr',  array(32, u8)])],
    ['_1',      bool],
  )],
  ['position',  u64]
)

export const maspBuilderSectionFields: Fields = [
  ["hash",                     hashSchema],
  ["asset_types",              set(struct(
    ["token",                  addressSchema],
    ["denomination",           u8],
    ["position",               variants(
      ["Zero",                 unit],
      ["One",                  unit],
      ["Two",                  unit],
      ["Three",                unit],
    )],
    ["epoch",                  option(u64)]
  ))],
  ["metadata",                 struct(
    ["spend_indices",          vec(u32)],
    ["convert_indices",        vec(u32)],
    ["output_indices",         vec(u32)],
  )],
  ["builder",                  struct(
    ["params",                 unit],
    ["rng",                    unit],
    ["target_height",          u32],
    ["expiry_height",          u32],
    ["transparent_builder",    struct(
      ["inputs",               vec(struct(
        ["coin",               transferTxSchema]
      ))],
      ["vout",                 vec(transferTxSchema)]
    )],
    ["sapling_builder",        struct(
      ["params",               unit],
      ["spend_anchor",         option(array(4, u64))],
      ["target_height",        u32],
      ["value_balance",        i128],
      ["convert_anchor",       option(array(4, u64))],
      ["spends",               vec(struct(
        ["extsk",              struct(
          ["depth",            u8],
          ["parent_fvk_tag",   array(4, u8)],
          ["child_index",      variants(
            ["NonHardened",    u32],
            ["Hardened",       u32],
          )],
          ["chain_code",       array(32, u8)],
          ["fbk",              struct(
            ["vk",             struct(
              ["ak",           extendedPointSchema],
              ["nk",           extendedPointSchema],
            )],
            ["ovk",            array(32, u8)],
          )],
          ["dk",               array(32, u8)],
        )],
        ["diversifier",        array(11, u8)],
        ["note",               noteSchema],
        ["alpha",              array(4, u64)],
        ["merkle_path",        merklePathSchema]
      ))],
      ["converts",             vec(struct(
        ["allowed",            struct(
          ["assets",           i128],
          ["generator",        extendedPointSchema],
        )],
        ["value",              u64],
        ["merkle_path",        merklePathSchema],
      ))],
      ["outputs",              vec(struct(
        ["ovk",                option(array(32, u8))],
        ["to",                 struct(
          ["pk_d",             extendedPointSchema],
          ["diversifier",      array(11, u8)]
        )],
        ["note",               noteSchema],
        ["memo",               array(512, u8)]
      ))],
    )]
  )]
]

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
    Core.assignCamelCase(this, data, maspBuilderSectionFields.map(x=>x[0] as string))
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

export const headerFields: Fields = [
  ["chain_id",          string],
  ["expiration",        option(string)],
  ["timestamp",         string],
  ["code_hash",         hashSchema],
  ["data_hash",         hashSchema],
  ["memo_hash",         hashSchema],
  ["tx_type",           variants(
    ['Raw',             unit],
    ['Wrapper',         struct(...wrapperTransactionFields)],
    ['Decrypted',       variants(
      ['Decrypted',     unit],
      ['Undecryptable', unit],
    )],
    ['Protocol',        struct(...protocolTransactionFields)],
  )]
]

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
    Core.assignCamelCase(this, data, headerFields.map(x=>x[0] as string))
  }
}
