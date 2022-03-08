import type { Agent } from './Agent'
import { colors, bold, Console, resolve, readFileSync, existsSync } from '@hackbg/tools'
export { toBase64, fromBase64, fromUtf8, fromHex } from '@iov/encoding'
import { toHex } from '@iov/encoding'
import { Sha256 } from '@iov/crypto'

const console = Console('@hackbg/fadroma')

export function codeHashForPath (location: string) {
  return toHex(new Sha256(readFileSync(location)).digest())
}

export class Source {
  constructor (
    public readonly workspace: string,
    public readonly crate:     string,
    public readonly ref?:      string
  ) {}
}

export abstract class Builder {
  caching = true
  protected prebuild ({ workspace, crate, ref = 'HEAD' }: Source): Artifact|null {
    // For now, workspace-less crates are not supported.
    if (!workspace) {
      const msg = `[@fadroma/ops] Missing workspace path (for crate ${crate} at ${ref})`
      throw new Error(msg)
    }
    // Don't rebuild existing artifacts
    // TODO make this optional
    if (this.caching) {
      const outputDir = resolve(workspace, 'artifacts')
      const location  = resolve(outputDir, `${crate}@${ref}.wasm`)
      if (existsSync(location)) {
        console.info('✅', bold(location), 'exists, not rebuilding.')
        return { location, codeHash: codeHashForPath(location) }
      }
    }
    return null
  }
  abstract build (source: Source, ...args): Promise<Artifact>
  buildMany (sources: Source[], ...args): Promise<Artifact[]> {
    return Promise.all(sources.map(source=>this.build(source, ...args)))
  }
}

export interface Artifact {
  location:  string
  codeHash?: string
}

export abstract class Uploader {
  constructor (readonly agent: Agent) {}
  get chain () { return this.agent.chain }
  abstract upload (artifact: Artifact, ...args): Promise<Template>
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

export interface Template {
  chainId:          string
  transactionHash?: string
  codeId:           string
  codeHash?:        string
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

export type Coin = {
  amount: string
  denom:  string
}

export abstract class Gas {
  amount: Coin[] = []
  gas:    string
  constructor (x: number) {
    const amount = String(x)
    this.gas = amount
  }
}

export type Fees = {
  upload: Gas
  init:   Gas
  exec:   Gas
  send:   Gas
}

export const join = (...x:any[]) => x.map(String).join(' ')

export const overrideDefaults = (obj, defaults, options = {}) => {
  for (const k of Object.keys(defaults)) {
    obj[k] = obj[k] || ((k in options) ? options[k] : defaults[k].apply(obj))
  }
}
