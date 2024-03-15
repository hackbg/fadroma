import { Core } from '@fadroma/agent'
import {
  variant, array, vec, zVec, u8, u32, u64, u128, u256, i128, string, option, variants, unit, struct, map, set,
  bool
} from '@hackbg/borshest'
import type { Fields } from '@hackbg/borshest'
import { addr } from './namada-address'

export class Section {
  print (console = new Core.Console()) {
    console.warn('Tried to print an instance of the Section base class. Use a subclass instead')
  }
}

export class UnknownSection extends Section {
  data: unknown
  constructor (data: unknown) {
    super()
    this.data = data
  }
}

export class DataSection extends Section {
  salt: string
  data: string
  constructor (properties: Partial<DataSection> = {}) {
    super()
    Core.assign(this, properties, [ 'salt', 'data' ])
  }
}

export class ExtraDataSection extends Section {
  salt: string
  code: string
  tag:  string
  constructor (properties: Partial<ExtraDataSection> = {}) {
    super()
    Core.assign(this, properties, [ 'salt', 'code', 'tag' ])
  }
}

export class CodeSection extends Section {
  salt: string
  code: string
  tag:  string
  constructor (properties: Partial<CodeSection> = {}) {
    super()
    Core.assign(this, properties, [ 'salt', 'code', 'tag' ])
  }
}

export class SignatureSection extends Section {
  targets:    string[]
  signer:     string|string[]
  signatures: string[]
  constructor (properties: Partial<SignatureSection> = {}) {
    super()
    Core.assign(this, properties, [ 'targets', 'signer', 'signatures' ])
  }
}

export class CiphertextSection extends Section {}

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
  constructor (properties: Partial<MaspTxSection> = {}) {
    super()
    Core.assign(this, properties, [
      'txid',
      'lockTime',
      'expiryHeight',
      'transparentBundle',
      'saplingBundle'
    ])
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
  constructor (properties: Partial<MaspBuilderSection> = {}) {
    super()
    Core.assign(this, properties, [
      'target',
      'assetTypes'
    ])
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
  constructor (properties: Partial<HeaderSection> = {}) {
    super()
    Core.assign(this, properties, [
      'chainId',
      'expiration',
      'timestamp',
      'codeHash',
      'dataHash',
      'memoHash',
      'txType'
    ])
  }
}
