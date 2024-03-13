import { Core } from '@fadroma/agent'
import {
  variant, array, vec, zVec, u8, u32, u64, u128, u256, i128, string, option, variants, unit, struct, map, set,
  bool
} from '@hackbg/borshest'
import type { Fields } from '@hackbg/borshest'
import { addr } from './namada-address'

export class Section {
  print (console = new Core.Console()) {
    console.warn('Tried to print an instance Section base class. Use a subclass instead')
  }
}

export class DataSection extends Section {
  salt: string
  data: string
  constructor ({ salt, data }) {
    super()
    this.salt = salt
    this.data = data
  }
  print (console = new Core.Console()) {
    console
      .log('  Data section')
      .log('    Salt:', this.salt)
      .log('    Data:', this.data)
  }
}

export class ExtraDataSection extends Section {
  salt: string
  code: string
  tag:  string
  constructor ({ salt, code, tag }) {
    super()
    this.salt = salt
    this.code = code
    this.tag  = tag
  }
  print (console = new Core.Console()) {
    console
      .log('  Extra data section')
      .log('    Salt:', this.salt)
      .log('    Code:', this.code)
      .log('    Tag: ', this.tag)
  }
}

export class CodeSection extends Section {
  salt: string
  code: string
  tag:  string
  constructor ({ salt, code, tag }) {
    super()
    this.salt = salt
    this.code = code
    this.tag  = tag
  }
  print (console = new Core.Console()) {
    console
      .log('  Code section')
      .log('    Salt:', this.salt)
      .log('    Code:', this.code)
      .log('    Tag: ', this.tag)
  }
}

export class SignatureSection extends Section {
  targets:    string[]
  signer:     string|string[]
  signatures: string[]
  constructor ({ targets, signer, signatures }) {
    super()
    this.targets    = targets
    this.signer     = signer
    this.signatures = signatures
  }
  print (console = new Core.Console()) {
    console
      .log('  Signature section')
      .log('    Targets:   ')
    for (const target of this.targets) {
      console
        .log('    -', target)
    }
    if (typeof this.signer === 'string') {
      console
        .log('    Signer:    ', this.signer)
    } else {
      console
        .log('    Signer:    ')
      for (const sign of this.signer) {
        console
          .log('    -', sign)
      }
    }
    console
      .log('    Signatures:')
    for (const [key, value] of Object.entries(this.signatures)) {
      console
        .log('    -', key, value)
    }
  }
}

export class CiphertextSection extends Section {
  print (console = new Core.Console()) {
    console.log('  Ciphertext section')
  }
}

export class MaspTxSection extends Section {
  txid:               string
  lockTime:           string
  expiryHeight:       string|null
  transparentBundle:  null|{
    vin:              Array<{
      assetType:      string,
      value:          bigint,
      address:        string 
    }>
    vout:             Array<{
      assetType:      string,
      value:          bigint,
      address:        string
    }>
  }
  saplingBundle:      null|{
    shieldedSpends:   Array<{
      cv:             string
      anchor:         string
      nullifier:      string
      rk:             string
      zkProof:        string
    }>
    shieldedConverts: Array<{
      cv:             string
      anchor:         string
      zkProof:        string
    }>
    shieldedOutputs:  Array<{
      cv:             string,
      cmu:            string,
      ephemeralKey:   string,
      encCiphertext:  string
      outCiphertext:  string
      zkProof:        string
    }>
    valueBalance:     Record<string, bigint>
  }
  constructor ({ txid, lockTime, expiryHeight, transparentBundle, saplingBundle }) {
    super()
    this.txid              = txid
    this.lockTime          = lockTime
    this.expiryHeight      = expiryHeight
    this.transparentBundle = transparentBundle
    this.saplingBundle     = saplingBundle
  }
  print (console = new Core.Console()) {
    console
      .log('  MASP TX section')
      .log('    TX ID:    ', this.txid)
      .log('    Lock time:', this.lockTime)
      .log('    Expiry:   ', this.expiryHeight)
    if (this.transparentBundle) {
      console.log('    Transparent bundle VIN:')
      for (const tx of this.transparentBundle.vin) {
        console
          .log('    -', tx.assetType)
          .log('    -', tx.value)
          .log('    -', tx.address)
      }
      console.log('    Transparent bundle VOUT:')
      for (const tx of this.transparentBundle.vout) {
        console
          .log('    -', tx.assetType)
          .log('    -', tx.value)
          .log('    -', tx.address)
      }
    }
    if (this.saplingBundle) {
      console
        .log('  Sapling bundle:')
        .log('    Shielded spends:')
      for (const tx of this.saplingBundle.shieldedSpends) {
        console
          .log('    - CV:       ', tx.cv)
          .log('      Anchor:   ', tx.anchor)
          .log('      Nullifier:', tx.nullifier)
          .log('      RK:       ', tx.rk)
          .log('      ZKProof:  ', tx.zkProof)
      }
      console.log('    Shielded converts:')
      for (const tx of this.saplingBundle.shieldedConverts) {
        console
          .log('    - CV:     ', tx.cv)
          .log('      Anchor: ', tx.anchor)
          .log('      ZKProof:', tx.zkProof)
      }
      console.log('    Shielded outputs:')
      for (const tx of this.saplingBundle.shieldedOutputs) {
        console
          .log('    - CV:             ', tx.cv)
          .log('      CMU:            ', tx.cmu)
          .log('      Epheremeral key:', tx.ephemeralKey)
          .log('      Enc. ciphertext:', tx.encCiphertext)
          .log('      Out. ciphertext:', tx.outCiphertext)
          .log('      ZKProof:        ', tx.zkProof)
      }
    }
  }
}

export class MaspBuilderSection extends Section {
  target:     string
  assetTypes: Array<{
    token:    string,
    denom:    number,
    position: number,
    epoch?:   number
  }>
  constructor ({ target, assetTypes }) {
    super()
    this.target = target
    this.assetTypes = assetTypes
  }
}

export class HeaderSection extends Section {
  chainId:    string
  expiration: string|null
  timestamp:  string
  codeHash:   string
  dataHash:   string
  memoHash:   string
  txType:     'Raw'|'Wrapper'|'Decrypted'|'Protocol'
  constructor ({ chainId, expiration, timestamp, codeHash, dataHash, memoHash, txType }) {
    super()
    this.chainId    = chainId
    this.expiration = expiration
    this.timestamp  = timestamp
    this.codeHash   = codeHash
    this.dataHash   = dataHash
    this.memoHash   = memoHash
  }
}

export class UnknownSection extends Section {
  data: unknown
  constructor (data: unknown) {
    super()
    this.data = data
  }
  print (console = new Core.Console()) {
    console.warn('Unknown section:', this.data)
  }
}
