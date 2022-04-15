import type { Agent } from './Agent'
import { config } from './Config'
import { colors, bold, Console, resolve, readFileSync, existsSync } from '@hackbg/toolbox'
export { toBase64, fromBase64, fromUtf8, fromHex } from '@iov/encoding'
import { toHex } from '@iov/encoding'
import { Sha256 } from '@iov/crypto'

const console = Console('@hackbg/fadroma')

export class Source {
  constructor (
    public readonly workspace: string,
    public readonly crate:     string,
    public readonly ref?:      string
  ) {}

  /** Take a workspace and a list of crates in it and return a function
    * that creates a mapping from crate name to Source object for a particular VCS ref. */
  static collectCrates = (workspace: string, crates: string[]) =>
    (ref?: string): Record<string, Source> =>
      crates.reduce(
        (sources, crate)=>Object.assign(sources, {[crate]: new Source(workspace, crate, ref)}),
        {}
      )

  static collect = (workspace, ref, ...crateLists): Source[] => {
    const sources: Set<string> = new Set()
    for (const crateList of crateLists) {
      for (const crate of crateList) {
        sources.add(crate)
      }
    }
    return [...sources].map(crate=>new Source(workspace, crate, ref))
  }
}

export abstract class Builder {
  abstract build (source: Source, ...args): Promise<Artifact>
  buildMany (sources: Source[], ...args): Promise<Artifact[]> {
    return Promise.all(sources.map(source=>this.build(source, ...args)))
  }
}

export interface Artifact {
  location:  string
  codeHash?: string
}

export function codeHashForPath (location: string) {
  return toHex(new Sha256(readFileSync(location)).digest())
}

export abstract class Uploader {
  constructor (readonly agent: Agent) {}
  get chain () { return this.agent.chain }
  abstract upload (artifact: Artifact, ...args): Promise<Template>
  abstract uploadMany (artifacts: Artifact[]): Promise<Template[]>
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

export async function buildAndUpload (
  builder: Builder, uploader: Uploader, source: Source
): Promise<Template> {
  const artifact = await builder.build(source)
  const template = await uploader.upload(artifact)
  return template
}

export async function buildAndUploadMany (
  builder: Builder, uploader: Uploader, sources: Source[]
): Promise<Template[]> {
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

export function parallel (...commands) {
  return function parallelCommands (input) {
    return Promise.all(commands.map(command=>command(input)))
  }
}
