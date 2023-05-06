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
  async upload (contract: Uploadable): Promise<Uploaded> {
    const cached = this.get(contract)
    if (cached && !this.reupload) return cached
    const { artifact } = contract
    if (!artifact) throw new Error('No artifact to upload')
    if (!this.agent) throw new Error('No upload agent')
    this.log.log('fetching', String(artifact))
    const data = await this.fetch(artifact)
    const log = new Console(`${contract.codeHash} upload`)
    log(`from ${bold(artifact)}`)
    log(`${bold(String(data.length))} bytes (uncompressed)`)
    const result = await this.agent.upload(data, contract)
    this.checkCodeHash(contract, result)
    const { codeId, codeHash, uploadTx } = result
    log(`done, code id`, codeId)
    Object.assign(contract, { codeId, codeHash, uploadTx })
    const receipt = { ...contract, codeId, codeHash, uploadTx }
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

/// ---
/// Legacy code from FSUploader.
/// TODO review for anything useful.

  /** Upload multiple contracts from the filesystem. */
  /*async uploadMany (inputs: Array<Uploadable>): Promise<Array<Uploaded>> {
    // TODO: Optionally bundle the upload messages in one transaction -
    //       this will only work if they add up to less than the max API request size
    //       (which is defined who knows where)
    const self = this
    if (!self.store) {
      this.log.warn('Upload cache disabled. Reuploading.')
      return this.uploadManySansCache(inputs)
    }
    const toUpload: Uploadable[] = []
    const outputs:  Uploaded[]   = []
    inputs.forEach(function collectInput (input: Uploadable, index: number) {
      // Skip empty positions
      if (!input) return
      // Make sure local code hash is available to compare against the result of the upload
      // If these two don't match, the local contract was rebuilt and needs to be reuploaded.
      // If they still don't match after the reupload, there's a problem.
      input = self.ensureLocalCodeHash(input)
      // If there's no upload store, always upload
      if (!self.store) return toUpload[index] = input
      // If there's no local upload receipt, time to reupload.
      const receiptPath = $(self.store.getUploadReceiptPath(input))
      const relativePath = receiptPath.shortPath
      if (!receiptPath.exists()) {
        self.log.log('!!!', receiptPath.path, 'does not exist, uploading')
        return toUpload[index] = input
      }
      // If there's a local upload receipt and it doesn't contain a code hash, time to reupload.
      const receiptData = receiptPath.as(UploadStore_JSON1_Receipt).load()
      const receiptCodeHash = receiptData.codeHash || receiptData.originalChecksum
      if (!receiptCodeHash) {
        self.log.warn(`No code hash in ${bold(relativePath)}; uploading...`)
        return toUpload[index] = input
      }
      // If there's a local upload receipt and it contains a different code hash
      // from the one computed earlier, time to reupload.
      if (receiptCodeHash !== input.codeHash) {
        self.log.warn(`Different code hash from ${bold(relativePath)}; reuploading...`)
        return toUpload[index] = input
      }
      // Otherwise reuse the code ID from the receipt.
      const codeHash = input.codeHash!
      const codeId   = String(receiptData.codeId)
      const uploadTx = receiptData.transactionHash as string
      outputs[index] = Object.assign(input, { codeHash, codeId, uploadTx })
    })
    // If any contracts are marked for uploading:
    // - upload them and save the receipts
    // - update outputs with data from upload results (containing new code ids)
    if (toUpload.length > 0) {
      const uploaded = await this.uploadManySansCache(toUpload)
      for (const i in uploaded) {
        if (!uploaded[i]) continue // skip empty ones, preserving index
        const template = uploaded[i]
        const receipt = $(this.store!, this.store!.getUploadReceiptName(toUpload[i]))
        receipt.as(UploadStore_JSON1_Receipt).save(toUploadReceipt(template))
        outputs[i] = template
      }
    }
    return outputs
  }*/
  /** Ignores the cache. Supports "holes" in artifact array to preserve order of non-uploads. */
  /*async uploadManySansCache (inputs: Array<Uploadable>): Promise<Array<Uploaded>> {
    const agent = assertAgent(this)
    const outputs: Array<Uploaded> = []
    for (const i in inputs) {
      const input = inputs[i]
      if (!input.artifact) throw new Error.Missing.Artifact()
      const path = $(input.artifact!)
      const log = new Console(path.shortPath)
      const data = path.as(BinaryFile).load()
      log(`size (uncompressed): ${data.length} bytes`)
      input.codeHash ??= base16.encode(sha256(data))
      log(`hash ${input.codeHash}`)
      const result = await agent.upload(data, input)
      const output = { ...input, ...result }
      this.checkLocalCodeHash(input as Uploadable & { codeHash: CodeHash }, output)
      outputs[i] = output
      log('uploaded to code id', bold(`${result.codeId}`))
      log.br()
      await agent.nextBlock
    }
    return outputs
  }*/
  /** Make sure that the optional `codeHash` property of an `Uploadable` is populated, by
    * computing the code hash of the locally available artifact that he `Uploadable` specifies.
    * This is used to validate the code hash of the local file against the one returned by the
    * upload transaction. */
  //private ensureLocalCodeHash (input: Uploadable): Uploadable & { codeHash: CodeHash } {
    //if (!input.codeHash) {
      //const artifact = $(input.artifact!)
      //this.log.warn('No code hash in artifact', bold(artifact.shortPath))
      //try {
        //const codeHash = this.hashPath(artifact)
        //this.log.warn('Computed code hash:', bold(input.codeHash!))
        //input = Object.assign(input, { codeHash })
      //} catch (e: any) {
        //this.log.warn('Could not compute code hash:', e.message)
      //}
    //}
    //return input as Uploadable & { codeHash: CodeHash }
  //}
  /** Compute the SHA256 of a local file. */
  //private hashPath (path: string|Path) {
    //return $(path).as(BinaryFile).sha256
  //}
