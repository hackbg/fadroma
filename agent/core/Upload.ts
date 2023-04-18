import type {
  Address, TxHash, ChainId, Agent, ClientClass, Deployment, Buildable, Built,
  Hashed, CodeHash, CodeId
} from '../index'
import {
  Error, Console, bold, pluralize, hideProperties
} from '../util'

import { assertAgent } from './Agent'
import { Client, fetchCodeHash, getSourceSpecifier } from './Client'

import { sha256, base16 } from '@hackbg/4mat'
import { override } from '@hackbg/over'

/** Parameters involved in uploading a contract */
export interface Uploadable extends Partial<Built> {
  artifact:  string|URL
  chainId:   ChainId,
  codeHash?: CodeHash
}

/** Result of uploading a contract */
export interface Uploaded extends Partial<Uploadable> {
  chainId:   ChainId
  codeId:    CodeId
  codeHash:  CodeHash
  uploader?: Uploader
  uploadBy?: Address
  uploadTx?: TxHash
}

/** A constructor for an Uploader subclass. */
export interface UploaderClass<U extends Uploader> {
  new (agent?: Agent|null): U
}

/** Uploader: uploads a `Contract`'s `artifact` to a specific `Chain`,
  * binding the `Contract` to a particular `chainId` and `codeId`. */
export abstract class Uploader {

  /** Global registry of Uploader implementations.
    * Populated by @fadroma/ops */
  static variants: Record<string, UploaderClass<Uploader>> = {}
 
  constructor (
    public agent?: Agent|null
  ) {}

  /** Unique identifier of this uploader implementation. */
  abstract id: string

  /** Upload a contract.
    * @returns the contract with populated codeId and codeHash */
  abstract upload (source: Uploadable): Promise<Uploaded>

  /** Upload multiple contracts. */
  abstract uploadMany (sources: Uploadable[]): Promise<Uploaded[]>

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

}

/** @returns the uploader of the thing
  * @throws  NoUploader if missing or NoUploaderAgent if the uploader has no agent. */
export function assertUploader ({ uploader }: { uploader?: Uploader }): Uploader {
  if (!uploader) throw new Error.NoUploader()
  //if (typeof uploader === 'string') throw new Error.ProvideUploader(uploader)
  if (!uploader.agent) throw new Error.NoUploaderAgent()
  return uploader
}

export class FetchUploader extends Uploader {

  get id () { return 'Fetch' }

  log = new Console('@fadroma/agent: FetchUploader' )

  constructor (
    /** Agent that will sign the upload transactions(s). */
    public agent?: Agent|null,
  ) {
    super(agent)
    this.log.warn('FetchUploader caching not implemented: reuploading')
    hideProperties(this, 'log')
  }

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
