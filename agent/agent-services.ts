import type {
  Address, TxHash, ChainId, Agent, ClientClass, Hashed, CodeId, Deployment, Class, CodeHash
} from './agent'
import { Error, Console, pluralize, bold, hideProperties } from './agent-base'
import { Client, fetchCodeHash, getSourceSpecifier } from './agent-client'
import { assertAgent } from './agent-chain'

import { sha256, base16 } from '@hackbg/4mat'
import { override } from '@hackbg/over'

/** Parameters involved in building a contract. */
export interface Buildable {
  /** Name of crate. */
  crate:       string
  /** Crate features that need to be enabled. */
  features?:   string[]
  /** Path to workspace to which the crate belongs. */
  workspace?:  string
  /** Path or URL to source repository for crate/workspace. */
  repository?: string|URL
  /** Commit in source repository which is built. */
  revision?:   string
  /** Whether this build contains uncommitted code. */
  dirty?:      boolean
  /** Builder class to use for build. */
  builder?:    Builder
}

/** Builders can be specified as ids, class names, or objects. */
/** A constructor for a Builder subclass. */
export type BuilderClass<B extends Builder> = Class<Builder, any>

/** Builder: turns `Source` into `Contract`, providing `artifact` and `codeHash` */
export abstract class Builder {
  log = new Console(this.constructor.name)
  /** Global registry of builder variants. Populated downstream. */
  static variants: Record<string, BuilderClass<Builder>> = {}
  /** Unique identifier of this builder implementation. */
  abstract id: string
  /** Up to the implementation.
    * `@hackbg/fadroma` implements dockerized and non-dockerized
    * variants on top of the `build.impl.mjs` script. */
  abstract build (source: Buildable, ...args: any[]): Promise<Built>
  /** Default implementation of buildMany is parallel.
    * Builder implementations override this, though. */
  abstract buildMany (sources: Buildable[], ...args: unknown[]): Promise<Built[]>
}

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
  chainId:   ChainId,
}

/** A constructor for a subclass of Uploader. */
export interface UploaderClass<U extends Uploader> {
  new (options?: Partial<Uploader>): U
}

/** Uploader: uploads a `Template`'s `artifact` to a specific `Chain`,
  * binding the `Template` to a particular `chainId` and `codeId`. */
export class Uploader {
  log = new Console('Uploader')
  /** Unique identifier of this uploader implementation. */
  id = 'Fetch'
  /** Agent that will sign the upload transactions(s). */
  agent?: Agent
  /** If present, upload receipts are stored here and reused to save reuploads. */
  store?: UploadStore
  /** If set, reuploads even if store is present. */
  reupload?: boolean

  constructor (options: Partial<Uploader> = {}) {
    Object.assign(this, options)
    hideProperties(this, 'log')
  }

  /** Chain to which this uploader uploads contracts. */
  get chain () {
    return this.agent?.chain
  }

  /** Upload an Uploadable (such as a Contract or Template).
    * @returns Promise<Uploaded> */
  async upload (contract: Uploadable): Promise<Uploaded> {
    const cached = this.store?.get(contract, this.agent?.chain?.id)
    if (!this.reupload && cached) return cached
    const { artifact } = contract
    if (!artifact) throw new Error('No artifact to upload')
    if (!this.agent) throw new Error('No upload agent')
    this.log.log('Uploading:', String(artifact))
    const data = await this.fetch(artifact)
    const log = new Console(`Upload: ${bold(artifact)}`)
    log(`hash ${contract.codeHash}`)
    log(`size (uncompressed): ${data.length} bytes`)
    const result = await this.agent.upload(data, contract)
    this.checkCodeHash(contract, result)
    const { codeId, codeHash, uploadTx } = result
    log(`done, code id`, codeId)
    Object.assign(contract, { codeId, codeHash, uploadTx })
    const receipt = { ...contract, codeId, codeHash, uploadTx }
    this.store?.set(receipt)
    return receipt
  }
  /** Upload multiple contracts. */
  async uploadMany (inputs: Uploadable[]): Promise<Uploaded[]> {
    if (!this.agent) throw new Error('No upload agent')
    const outputs: Array<Uploaded> = []
    for (const i in inputs) {
      const input = inputs[i]
      outputs[i] = await this.upload(input)
      await this.agent.nextBlock
    }
    return outputs
  }
  protected async fetch (path: string|URL): Promise<Uint8Array> {
    if (!global.fetch) throw new Error.NoFetch()
    const file = await fetch(new URL(path, 'file:'))
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

export interface UploadStore {
  get (contract: Uploadable, _chainId?: ChainId): Uploaded|null
  set (receipt: Uploaded): void
}

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
}
