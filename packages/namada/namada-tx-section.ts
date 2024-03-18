import { Core } from '@fadroma/agent'
import type { Fields } from '@hackbg/borshest'
import { Section } from './namada-tx-section-base'

class UnknownSection extends Section {
  static noun = 'Unknown Section'
  type = null
  data: unknown
  constructor (data: unknown) {
    super()
    this.data = data
  }
}

class DataSection extends Section {
  static noun = 'Data'
  type = 'Data' as 'Data'
  salt: string
  data: string
  constructor (properties: Partial<DataSection> = {}) {
    super()
    Core.assign(this, properties, [ 'salt', 'data' ])
  }
}

class ExtraDataSection extends Section {
  static noun = 'Extra Data'
  type = 'ExtraData' as 'ExtraData'
  salt: string
  code: string
  tag:  string
  constructor (properties: Partial<ExtraDataSection> = {}) {
    super()
    Core.assign(this, properties, [ 'salt', 'code', 'tag' ])
  }
}

class CodeSection extends Section {
  static noun = 'Code'
  type = 'Code' as 'Code'
  salt: string
  code: string
  tag:  string
  constructor (properties: Partial<CodeSection> = {}) {
    super()
    Core.assign(this, properties, [ 'salt', 'code', 'tag' ])
  }
}

class SignatureSection extends Section {
  static noun = 'Signature'
  type = 'Signature' as 'Signature'
  targets:    string[]
  signer:     string|string[]
  signatures: string[]
  constructor (properties: Partial<SignatureSection> = {}) {
    super()
    Core.assign(this, properties, [ 'targets', 'signer', 'signatures' ])
  }
}

class CiphertextSection extends Section {
  static noun = 'Ciphertext'
  type = 'Ciphertext' as 'Ciphertext'
}

class MaspTxSection extends Section {
  static noun = 'MASP Transaction'
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

class MaspBuilderSection extends Section {
  static noun = 'MASP Builder'
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

class HeaderSection extends Section {
  static noun = 'Header'
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

export {
  Section,
  UnknownSection     as Unknown,
  DataSection        as Data,
  CodeSection        as Code,
  ExtraDataSection   as ExtraData,
  SignatureSection   as Signature,
  CiphertextSection  as Ciphertext,
  MaspTxSection      as MaspTx,
  MaspBuilderSection as MaspBuilder,
  HeaderSection      as Header
}
