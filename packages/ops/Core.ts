import { config } from './Config'
import { colors, bold, Console, resolve, readFileSync, existsSync } from '@hackbg/toolbox'
import { Sha256 } from '@iov/crypto'

const console = Console('Fadroma Ops')

export type Label = string

export type InitMsg = string|Record<string, any>

export interface Instance {
  chainId:          string
  transactionHash?: string
  codeId:           string
  codeHash?:        string
  label:            string
  address:          string
}

export interface InitTX {
  txhash:          string
  contractAddress: string
  data:            string
  logs:            Array<any>
  transactionHash: string
  gas_used:        string
}

export interface InitReceipt {
  label:    string
  codeId:   number
  codeHash: string
  address:  string
  initTx:   string
  gasUsed:  string
}

export interface Identity {
  chainId?:  string,
  address?:  string
  name?:     string,
  type?:     string,
  pubkey?:   string
  mnemonic?: string
  keyPair?:  any
  pen?:      any
  fees?:     any
}

export type Message = string|Record<string, any>

export const join = (...x:any[]) => x.map(String).join(' ')

export const overrideDefaults = (obj, defaults, options = {}) => {
  for (const k of Object.keys(defaults)) {
    obj[k] = obj[k] || ((k in options) ? options[k] : defaults[k].apply(obj))
  }
}

export { toBase64, fromBase64, fromUtf8, fromHex } from '@iov/encoding'
export type { Coin, Fees } from '@fadroma/client'
export { Gas } from '@fadroma/client'
