export { toBase64, fromBase64, fromUtf8 } from '@iov/encoding'

import { toHex } from '@iov/encoding'
import { Sha256 } from '@iov/crypto'
import { readFileSync } from '@hackbg/tools'
export function codeHashForPath (location: string) {
  return toHex(new Sha256(readFileSync(location)).digest())
}

export interface Source {
  workspace: string
  crate:     string
  ref?:      string
}

export interface Builder {
  build (source: Source, ...args): Promise<Artifact>
}

export interface Artifact {
  location:  string
  codeHash?: string
}

export interface Uploader {
  upload (artifact: Artifact, ...args): Promise<Template>
}

export interface Template {
  chainId:          string
  transactionHash?: string
  codeId:           string
  codeHash?:        string
}

export interface UploadReceipt {
  codeId:             number
  compressedChecksum: string
  compressedSize:     string
  logs:               any[]
  originalChecksum:   string
  originalSize:       number
  transactionHash:    string
}

export interface Instance {
  prefix?:   string
  name?:     string
  suffix?:   string
  label?:    string

  address:   string
  codeHash?: string

  receipt?:  InitReceipt
}

export interface InitReceipt {
  label:    string
  codeId:   number
  codeHash: string
  address:  string
  initTx:   string
  gasUsed:  string
}

export interface InitTX {
  txhash:          string
  contractAddress: string
  data:            string
  logs:            Array<any>
  transactionHash: string
  gas_used:        string
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

export function getMethod (msg: Message) {
  if (typeof msg === 'string') {
    return msg
  } else {
    const keys = Object.keys(msg)
    if (keys.length !== 1) {
      throw new Error(
        `@fadroma/scrt: message must be either an object `+
        `with one root key, or a string. Found: ${keys}`
      )
    }
    return Object.keys(msg)[0]
  }
}

export type Gas = {
  amount: Array<{amount: string, denom: string}>
  gas:    string
}

export type Fees = {
  upload: Gas
  init:   Gas
  exec:   Gas
  send:   Gas
}

import { colors, bold, Console } from '@hackbg/tools'

const console = Console('@hackbg/fadroma')

export const join = (...x:any[]) => x.map(String).join(' ')

export const print = {

  aligned (obj: Record<string, any>) {
    const maxKey = Math.max(...Object.keys(obj).map(x=>x.length), 15)
    for (let [key, val] of Object.entries(obj)) {
      if (typeof val === 'object') val = JSON.stringify(val)
      val = String(val)
      if ((val as string).length > 60) val = (val as string).slice(0, 60) + '...'
      console.info(bold(`  ${key}:`.padEnd(maxKey+3)), val)
    }
  },

  contracts (contracts) {
    contracts.forEach(print.contract)
  },

  contract (contract) {
    console.info(
      String(contract.codeId).padStart(12),
      contract.address,
      contract.name
    )
  },

  async token (TOKEN) {
    if (typeof TOKEN === 'string') {
      console.info(
        `   `,
        bold(TOKEN.padEnd(10))
      )
    } else {
      const {name, symbol} = await TOKEN.info
      console.info(
        `   `,
        bold(symbol.padEnd(10)),
        name.padEnd(25).slice(0, 25),
        TOKEN.address
      )
    }
  },

  receipt (name, receipt) {
    if (receipt.address) {
      console.info(
        `${receipt.address}`.padStart(45),
        String(receipt.codeId||'n/a').padStart(6),
        bold(name.padEnd(35)),
      )
    } else {
      console.warn(
        '(non-standard receipt)'.padStart(45),
        'n/a'.padEnd(6),
        bold(name.padEnd(35)),
      )
    }
  }

}
