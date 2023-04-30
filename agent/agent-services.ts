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

/** The default Git ref when not specified. */
export const HEAD = 'HEAD'

/** Builders can be specified as ids, class names, or objects. */
/** A constructor for a Builder subclass. */
export type BuilderClass<B extends Builder> = Class<Builder, any>

/** Builder: turns `Source` into `Contract`, providing `artifact` and `codeHash` */
export abstract class Builder {
  log = new Console(this.constructor.name)

  /** Populated by @fadroma/ops */
  static variants: Record<string, BuilderClass<Builder>> = {}
  /** Unique identifier of this builder implementation. */
  abstract id: string
  /** Up to the implementation.
    * `@fadroma/ops` implements dockerized and non-dockerized
    * variants on top of the `build.impl.mjs` script. */
  async build (source: Buildable, ...args: any[]): Promise<Built> {
    this.log.warn('Builder#build: stub')
    return { artifact: 'unimplemented' }
  }
  /** Default implementation of buildMany is parallel.
    * Builder implementations override this, though. */
  buildMany (sources: Buildable[], ...args: unknown[]): Promise<Built[]> {
    return Promise.all(sources.map(source=>this.build(source, ...args)))
  }
}

/** Throw appropriate error if not buildable. */
export function assertBuilder ({ builder }: { builder?: Builder }): Builder {
  //if (!this.crate) throw new Error.NoCrate()
  if (!builder) throw new Error.NoBuilder()
  //if (typeof builder === 'string') throw new Error.ProvideBuilder(builder)
  return builder
}

/** Parameters involved in uploading a contract */
export interface Uploadable extends Partial<Built> {
  /** Path or URL to binary. */
  artifact:  string|URL
  /** SHA256 checksum of binary. */
  codeHash?: CodeHash
  /** Chain to upload to. */
  chainId:   ChainId,
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

/** A constructor for a subclass of Uploader. */
export interface UploaderClass<U extends Uploader> { new (agent?: Agent|null): U }

/** Uploader: uploads a `Contract`'s `artifact` to a specific `Chain`,
  * binding the `Contract` to a particular `chainId` and `codeId`. */
export abstract class Uploader {
  /** Global registry of Uploader implementations.
    * Populated by @fadroma/ops */
  static variants: Record<string, UploaderClass<Uploader>> = {}

  /** Unique identifier of this uploader implementation. */
  abstract id: string
 
  constructor (
    public agent?: Agent|null
  ) {}

  /** Chain to which this uploader uploads contracts. */
  get chain () { return this.agent?.chain }

  checkCodeHash (
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
  /** Upload a contract.
    * @returns the contract with populated codeId and codeHash */
  abstract upload (source: Uploadable): Promise<Uploaded>
  /** Upload multiple contracts. */
  abstract uploadMany (sources: Uploadable[]): Promise<Uploaded[]>

}

export class FetchUploader extends Uploader {
  log = new Console('@fadroma/agent: FetchUploader' )

  constructor (
    /** Agent that will sign the upload transactions(s). */
    public agent?: Agent|null,
  ) {
    super(agent)
    this.log.warn('FetchUploader caching not implemented: reuploading')
    hideProperties(this, 'log')
  }

  get id () { return 'Fetch' }

  protected async fetch (path: string|URL): Promise<Uint8Array> {
    const file = await fetch(new URL(path, 'file:'))
    return new Uint8Array(await file.arrayBuffer())
  }

  async upload (contract: Uploadable): Promise<Uploaded> {
    if (!global.fetch) throw new Error.NoFetch()
    if (!contract.artifact) throw new Error('No artifact to upload')
    if (!this.agent) throw new Error('No upload agent')
    this.log.log('Uploading', contract.artifact)
    const data   = await this.fetch(contract.artifact)
    const result = await this.agent.upload(data)
    this.checkCodeHash(contract, result)
    const { codeId, codeHash, uploadTx } = result
    Object.assign(contract, { codeId, codeHash, uploadTx })
    return { ...contract, codeId, codeHash, uploadTx }
  }

  async uploadMany (inputs: Array<Uploadable>): Promise<Array<Uploaded>> {
    const agent = assertAgent(this)
    const outputs: Array<Uploaded> = []
    for (const i in inputs) {
      const input = inputs[i]
      if (!input.artifact) throw new Error.NoArtifact()
      const data = await this.fetch(input.artifact)
      input.codeHash ??= base16.encode(sha256(data))
      this.log.log('Uploading', String(input.artifact), `(${data.length} bytes uncompressed)`)
      const result = await agent.upload(data)
      const output = override(input, result) as unknown as Uploaded
      this.checkLocalCodeHash(input as Uploadable & { codeHash: CodeHash }, output)
      outputs[i] = output
    }
    return outputs
  }

}

Uploader.variants['Fetch'] = FetchUploader
