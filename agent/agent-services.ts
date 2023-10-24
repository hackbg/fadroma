/**
  Fadroma: Base Services
  Copyright (C) 2023 Hack.bg

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/
import type {
  Address, TxHash, ChainId, Agent, ClientClass, Hashed, CodeId, Deployment, Class, CodeHash, Chain,
} from './agent'
import { Error, Console, pluralize, bold, hideProperties } from './agent-base'
import { Client, fetchCodeHash, getSourceSpecifier } from './agent-client'
import { assertAgent } from './agent-chain'
import { sha256, base16 } from '@hackbg/4mat'
import { override } from '@hackbg/over'

/** Parameters involved in building a contract. */
export interface Buildable {
  /** Path or URL to source repository for crate/workspace. */
  repository?: string|URL
  /** Commit in source repository which is built. */
  revision?:   string
  /** Whether this build contains uncommitted code. */
  dirty?:      boolean
  /** Path to root directory of crate source or workspace. */
  workspace?:  string
  /** Name of crate. */
  crate:       string
  /** Crate features that need to be enabled. */
  features?:   string[]
  /** Builder class to use for build. */
  builder?:    Builder
}

/** Builders can be specified as ids, class names, or objects. */
/** A constructor for a Builder subclass. */
export type BuilderClass<B extends Builder> = Class<Builder, any>

/** Result of building a contract. */
export interface Built extends Partial<Buildable> {
  /** Path or URL to binary. */
  artifact:   string|URL
  /** SHA256 checksum of binary. */
  codeHash?:  CodeHash
  /** Builder class that produced binary. */
  builder?:   Builder
  /** ID of builder that produced binary. */
  builderId?: string
}

/** Parameters involved in uploading a contract */
export interface Uploadable {
  /** Path or URL to binary. */
  artifact:  string|URL
  /** SHA256 checksum of binary. */
  codeHash?: CodeHash
  /** Chain to upload to. */
  chainId?:  ChainId,
}

/** A constructor for a subclass of Uploader. */
export interface UploaderClass<U extends Uploader> { new (options?: Partial<Uploader>): U }

/** Result of uploading a contract */
export interface Uploaded extends Partial<Uploadable> {
  /** Chain to which the contract was uploaded. */
  chainId:   ChainId
  /** Code ID assigned by the chain. */
  codeId:    CodeId
  /** SHA256 checksum of binary, confirmed by the chain. */
  codeHash:  CodeHash
  /** Uploader class used for the upload. */
  uploader?: Uploader
  /** Address of uploader account. */
  uploadBy?: Address
  /** ID of upload transaction. */
  uploadTx?: TxHash
  /** Gas used by upload tx. */
  uploadGas?: string|number
}

/** Builder: turns `Source` into `Contract`, providing `artifact` and `codeHash` */
export abstract class Builder {
  log = new Console(this.constructor.name)
  /** Whether to enable build caching.
    * When set to false, this builder will rebuild even when
    * binary and checksum are both present in wasm/ directory */
  caching: boolean = true
  /** Global registry of builder variants. Populated downstream. */
  static variants: Record<string, BuilderClass<Builder>> = {}
  /** Unique identifier of this builder implementation. */
  abstract id: string
  /** Up to the implementation.
    * `@hackbg/fadroma` implements dockerized and non-dockerized
    * variants on top of the `build.impl.mjs` script. */
  abstract build (buildable: string|Buildable, ...args: any[]): Promise<Built>
  /** Default implementation of buildMany is parallel.
    * Builder implementations override this, though. */
  abstract buildMany (sources: (string|Buildable)[], ...args: unknown[]): Promise<Built[]>
}
/** Uploader: uploads a `Template`'s `artifact` to a specific `Chain`,
  * binding the `Template` to a particular `chainId` and `codeId`. */
export class Uploader {
  log = new Console('upload (fetch)')
  /** Unique identifier of this uploader implementation. */
  id = 'Fetch'
  /** Agent that will sign the upload transactions(s). */
  agent?: Agent
  /** If set, reuploads even if store is present. */
  reupload: boolean
  /** Map of code hash to `Uploaded` result. */
  cache: Record<CodeHash, Uploaded>

  constructor (options: Partial<Uploader> = {}) {
    this.id       = options.id       ?? this.id
    this.agent    = options.agent    ?? this.agent
    this.cache    = options.cache    ?? {}
    this.reupload = options.reupload ?? false
    hideProperties(this, 'log')
  }
  /** Chain to which this uploader uploads contracts. */
  get chain () {
    return this.agent?.chain
  }
  /** @returns Uploaded from the cache or undefined */
  get (uploadable: Uploadable): Uploaded|undefined {
    if (!uploadable.codeHash) throw new Error.Missing.CodeHash()
    return this.cache[uploadable.codeHash]
  }
  /** Add an Uploaded to the cache. */
  set (uploaded: Uploaded): this {
    if (!uploaded.codeHash) throw new Error.Missing.CodeHash()
    this.cache[uploaded.codeHash] = uploaded
    return this
  }
  /** Upload an Uploadable (such as a Contract or Template).
    * @returns Promise<Uploaded> */
  async upload (contract: Uploadable & Partial<Uploaded>): Promise<Uploaded> {
    type Mocknet = Chain & { uploads: Record<CodeId, { codeHash: CodeHash }> }
    if (contract.codeId) {
      this.log.log('found code id', contract.codeId)
      if (this.reupload) {
        this.log.log('reuploading because reupload is set')
      } else if (this.agent?.chain?.isMocknet && contract.codeHash) {
        const { codeHash } = (this.agent.chain as Mocknet).uploads[contract.codeId] || {}
        if (codeHash === contract.codeHash) return contract as Uploaded
        this.log.log('reuploading because mocknet is not stateful yet')
      } else {
        return contract as Uploaded
      }
    }
    if (!this.agent) throw new Error('no upload agent')
    const cached = this.get(contract)
    if (cached && cached.codeId) {
      this.log.log('found cached code id', cached.codeId, 'for code hash', cached.codeHash)
      if (this.reupload) {
        this.log.log('reuploading because reupload is set')
      } else if (this.agent?.chain?.isMocknet) {
        const { codeHash } = (this.agent.chain as Mocknet).uploads[cached.codeId] || {}
        if (codeHash === contract.codeHash) return cached
        this.log.log('reuploading because mocknet is not stateful yet')
      } else {
        return Object.assign(contract, cached as Uploaded)
      }
    }
    if (!contract.artifact) throw new Error('no artifact to upload')
    this.log.log('fetching', String(contract.artifact))
    const data = await this.fetch(contract.artifact)
    const log = new Console(`${contract.codeHash} -> ${this.agent.chain?.id??'(unknown chain id)'}`)
    log(`from ${bold(contract.artifact)}`)
    log(`${bold(String(data.length))} bytes (uncompressed)`)
    const result = await this.agent.upload(contract)
    this.checkCodeHash(contract, result)
    const { codeId, codeHash, uploadTx } = result
    log(`done, code id`, codeId)
    Object.assign(contract, { codeId, codeHash, uploadTx })
    const receipt = { ...contract, codeId, codeHash, uploadTx, chainId: this.chain!.id }
    this.set(receipt)
    await this.agent.nextBlock
    return receipt
  }
  /** Upload multiple contracts. */
  async uploadMany (inputs: Uploadable[]): Promise<(Uploaded|null)[]> {
    if (!this.agent) throw new Error('No upload agent')
    const outputs: Array<(Uploaded|null)> = []
    for (const i in inputs) {
      const input = inputs[i]
      outputs[i] = input ? await this.upload(input) : null
    }
    return outputs
  }
  protected async fetch (path: string|URL): Promise<Uint8Array> {
    if (!global.fetch) throw new Error.Unsupported.Fetch()
    const url = new URL(path, 'file:')
    if (url.protocol === 'file:') {
      const readFileSync = await import('node:fs').then(x=>x.readFileSync).catch(()=>null)
      if (!readFileSync) {
        throw new Error('Uploading from file:/// URLs is not available in this context.')
      }
      return readFileSync(path)
    }
    const file = await fetch(url)
    return new Uint8Array(await file.arrayBuffer())
  }
  protected checkCodeHash (
    a: { codeHash?: CodeHash, artifact?: string|URL },
    b: { codeHash?: CodeHash }
  ) {
    if (
      a.codeHash && b.codeHash &&
      a.codeHash.toUpperCase() !== b.codeHash.toUpperCase()
    ) {
      throw new Error(
        `Code hash mismatch when uploading ${a.artifact?.toString()}: ` +
        `${a.codeHash} vs ${b.codeHash}`
      )
    }
  }
  /** Panic if the code hash returned by the upload
    * doesn't match the one specified in the Contract. */
  protected checkLocalCodeHash (input: Uploadable & { codeHash: CodeHash }, output: Uploaded) {
    if (input.codeHash !== output.codeHash) {
      throw new Error(`
        The upload transaction ${output.uploadTx}
        returned code hash ${output.codeHash} (of code id ${output.codeId})
        instead of the expected ${input.codeHash} (of artifact ${input.artifact})
      `.trim().split('\n').map(x=>x.trim()).join(' '))
    }
  }
  /** Global registry of Uploader implementations. Populated downstream. */
  static variants: Record<string, UploaderClass<Uploader>> = { Fetch: this }
}
