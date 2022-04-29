import { config } from './Config'
import { colors, bold, Console, resolve, readFileSync, existsSync } from '@hackbg/toolbox'
import { toHex } from '@iov/encoding'
import { Sha256 } from '@iov/crypto'

const console = Console('Fadroma Ops')

import type { Agent } from '@fadroma/client'
import type { Artifact } from './Build'

export function codeHashForPath (location: string) {
  return toHex(new Sha256(readFileSync(location)).digest())
}

export async function buildAndUpload (
  builder: Builder, uploader: Uploader, source: Source
): Promise<Template> {
  const artifact = await builder.build(source)
  const template = await uploader.upload(artifact)
  return template
}

export async function buildAndUploadMany (
  builder: Builder, uploader: Uploader, ...sourceSets: Source[][]
): Promise<Template[]> {
  const sources   = sourceSets.reduce((sources, sourceSet)=>sources.concat(sourceSet), [])
  const artifacts = await builder.buildMany(sources)
  const templates = await uploader.uploadMany(artifacts)
  return templates
}

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
export { Coin, Gas, Fees } from '@fadroma/client'
