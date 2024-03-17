import { Core } from '@fadroma/agent'
import {
  variant, array, vec, zVec, u8, u32, u64, u128, u256, i128, string, option, variants, unit, struct, map, set,
  bool
} from '@hackbg/borshest'
import type { Fields } from '@hackbg/borshest'

export class Section {
  type: null|'Data'|'ExtraData'|'Code'|'Signature'|'Ciphertext'|'MaspTx'|'MaspBuilder'|'Header'
}

export class UnknownSection extends Section {
  type = null
  data: unknown
  constructor (data: unknown) {
    super()
    this.data = data
  }
}

export class DataSection extends Section {
  type = 'Data' as 'Data'
  salt: string
  data: string
  constructor (properties: Partial<DataSection> = {}) {
    super()
    Core.assign(this, properties, [ 'salt', 'data' ])
  }
}

export class ExtraDataSection extends Section {
  type = 'ExtraData' as 'ExtraData'
  salt: string
  code: string
  tag:  string
  constructor (properties: Partial<ExtraDataSection> = {}) {
    super()
    Core.assign(this, properties, [ 'salt', 'code', 'tag' ])
  }
}

export class CodeSection extends Section {
  type = 'Code' as 'Code'
  salt: string
  code: string
  tag:  string
  constructor (properties: Partial<CodeSection> = {}) {
    super()
    Core.assign(this, properties, [ 'salt', 'code', 'tag' ])
  }
}

export class SignatureSection extends Section {
  type = 'Signature' as 'Signature'
  targets:    string[]
  signer:     string|string[]
  signatures: string[]
  constructor (properties: Partial<SignatureSection> = {}) {
    super()
    Core.assign(this, properties, [ 'targets', 'signer', 'signatures' ])
  }
}

export class CiphertextSection extends Section {
  type = 'Ciphertext' as 'Ciphertext'
}

export class MaspTxSection extends Section {
  type = 'MaspTx' as 'MaspTx'
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
  type = 'MaspBuilder' as 'MaspBuilder'
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
  type = 'Header' as 'Header'
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
