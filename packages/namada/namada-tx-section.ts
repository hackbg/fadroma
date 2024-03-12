import { Core } from '@fadroma/agent'
import {
  variant, array, vec, zVec, u8, u32, u64, u128, u256, i128, string, option, variants, unit, struct, map, set,
  bool
} from '@hackbg/borshest'
import type { Fields } from '@hackbg/borshest'
import { addr } from './namada-address'

const hashSchema = array(32, u8)

export const toHash = (x: Array<number|bigint>) =>
  Core.base16.encode(new Uint8Array(x.map(y=>Number(y))))

export const pubkey = variants(
  ['Ed25519',   array(32, u8)],
  ['Secp256k1', array(33, u8)],
)

export const wrapperTransactionFields: Fields = [
  ["fee",                 struct(
    ["amountPerGasUnit",  struct(
      ["amount",          u256],
      ["denomination",    u8],
    )],
    ["token",             addr],
  )],
  ["pk",                  pubkey],
  ["epoch",               u64],
  ["gasLimit",            u64],
  ["unshieldSectionHash", option(hashSchema)],
]

export const protocolTransactionFields: Fields = [
  ["pk",                   pubkey],
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
    this.salt = toHash(salt)
    this.data = new Uint8Array(salt.map(x=>Number(x)))
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
  code: Uint8Array
  tag:  string
  constructor ({ salt, code, tag }: { salt: number[], code: number[], tag: string }) {
    super()
    this.salt = toHash(salt)
    this.code = new Uint8Array(code)
    this.tag  = tag
  }
  print (console) {
    console
      .log('   ', Core.bold('Extra code section:'))
      .log('    Salt:', Core.bold(this.salt))
      .log('    Data:', Core.bold(Core.base64.encode(this.code)))
      .log('    Tag: ', Core.bold(this.tag))
  }
}

export class CodeSection extends Section {
  salt: string
  code: Uint8Array
  tag:  string
  constructor ({ salt, code, tag }: { salt: number[], code: number[], tag: string }) {
    super()
    this.salt = toHash(salt)
    this.code = new Uint8Array(code)
    this.tag  = tag
  }
  print (console) {
    console
      .log('   ', Core.bold('Code section:'))
      .log('    Salt:', Core.bold(this.salt))
    if (this.code.length > 0) {
      console
        .log('    Data:', Core.base64.encode(this.code))
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
    this.targets    = targets.map(target=>toHash(target))
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
    ['Address',   addr],
    ['PubKeys',   vec(pubkey)],
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

const transferTx = {
  encode () {
    throw new Error('encode transferTx: not implemented')
  },
  decode (buffer) {
    const assetType = array(32, u8).decode(buffer)
    const value     = array(8,  u8).decode(buffer)
    const address   = array(20, u8).decode(buffer)
    return { assetType, value, address }
  }
}

const spend_v5 = {
  encode () {
    throw new Error('spend_v5: encode: not implemented')
  },
  decode (buffer) {
    const cv        = array(32, u8).decode(buffer)
    const nullifier = array(32, u8).decode(buffer)
    const rk        = array(32, u8).decode(buffer)
    return { cv, nullifier, rk }
  }
}

const convert_v5 = {
  encode () {
    throw new Error('convert_v5: encode: not implemented')
  },
  decode (buffer) {
    const cv = array(32, u8).decode(buffer)
    return { cv }
  }
}

const output_v5 = {
  encode () {
    throw new Error('output_v5: encode: not implemented')
  },
  decode (buffer) {
    const cv            = array(32,  u8).decode(buffer)
    const cmu           = array(32,  u8).decode(buffer)
    const ephemeralKey  = array(32,  u8).decode(buffer)
    const encCiphertext = array(612, u8).decode(buffer)
    const outCiphertext = array(80,  u8).decode(buffer)
    return { cv, cmu, ephemeralKey, encCiphertext, outCiphertext }
  }
}

const saplingBase = array(32, u8)

const zkproof = array(192, u8)

const signature = struct(
  ['rbar', array(32, u8)],
  ['sbar', array(32, u8)],
)

export const maspTxSection = {
  encode () {
    throw new Error('maspTxSection: encode: not implemented')
  },
  decode (buffer) {
    console.log({maspTxSection:buffer.buffer})
    const data = {}
    console.debug('Reading version')
    const version           = array(2, u32).decode(buffer)
    console.debug('Reading consensusBranchId')
    const consensusBranchId = u32.decode(buffer)
    console.debug('Reading lockTime')
    const lockTime          = u32.decode(buffer)
    console.debug('Reading expiryHeight')
    const expiryHeight      = u32.decode(buffer)
    console.debug('Reading transparentVin')
    const transparentVin    = zVec(transferTx).decode(buffer)
    console.debug('Reading transparentVout')
    const transparentVout   = zVec(transferTx).decode(buffer)
    console.debug('Reading spends')
    const spends            = zVec(spend_v5).decode(buffer)
    console.debug('Reading converts')
    const converts          = zVec(convert_v5).decode(buffer)
    console.debug('Reading outputs')
    const outputs           = zVec(output_v5).decode(buffer)
    console.debug('Reading balance')
    const balance           = ((spends.length > 0) || (outputs.length > 0)) 
                            ? i128sum.decode(buffer)
                            : 0n
    console.debug('Reading spendAnchor')
    const spendAnchor       = (spends.length > 0)
                            ? saplingBase.decode(buffer)
                            : null
    console.debug('Reading convertAnchor')
    const convertAnchor     = (spends.length > 0)
                            ? saplingBase.decode(buffer)
                            : null
    console.debug('Reading vSpendProofs')
    const vSpendProofs      = array(spends.length, zkproof).decode(buffer)
    console.debug('Reading vSpendAuthSigs')
    const vSpendAuthSigs    = array(spends.length, signature).decode(buffer)
    console.debug('Reading vConvertProofs')
    const vConvertProofs    = array(converts.length, zkproof).decode(buffer)
    console.debug('Reading vOutputProofs')
    const vOutputProofs     = array(outputs.length, zkproof).decode(buffer)
    console.debug('Reading bindingSig')
    const bindingSig        = ((spends.length > 0) || (outputs.length > 0))
                            ? signature.decode(buffer)
                            : null
    return {
      version,
      consensusBranchId,
      lockTime,
      expiryHeight,
      transparentVin,
      transparentVout,
      spends,
      converts,
      outputs,
      balance,
      spendAnchor,
      convertAnchor,
      vSpendProofs,
      vSpendAuthSigs,
      vConvertProofs,
      vOutputProofs,
      bindingSig
    }
  }
}

const transactionDataFields: Fields = [
  ['version',           array(2, u32)],
  ['consensusBranchId', u32],
  ['lockTime',          u32],
  ['expiryHeight',      u32],
  ['transparentVin',    option(zVec(transferTx))],
  ['transparentVout',   option(zVec(transferTx))],
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

const assetType = array(32, u8)

const i128sum = map(assetType, u128)

const noteSchema = struct(
  ['asset_type',   assetType],
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
    ["token",                  addr],
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
        ["coin",               transferTx]
      ))],
      ["vout",                 vec(transferTx)]
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
  ["chainId",           string],
  ["expiration",        option(string)],
  ["timestamp",         string],
  ["codeHash",          hashSchema],
  ["dataHash",          hashSchema],
  ["memoHash",          hashSchema],
  ["txType",            variants(
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
