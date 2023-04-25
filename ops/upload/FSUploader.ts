import { Console } from '../util'

import UploadStore, { UploadReceipt } from './UploadStore'

import {
  Uploader, assertAgent, override, toUploadReceipt, Error, colors, bold,  base16, sha256
} from '@fadroma/agent'
import type { 
  Agent, CodeHash, CodeId, Uploadable, Uploaded, AnyContract
} from '@fadroma/agent'

import $, { Path, BinaryFile } from '@hackbg/file'

/** Uploads contracts from the local filesystem, with optional caching:
  * if provided with an Uploads directory containing upload receipts,
  * allows for uploaded contracts to be reused. */
export default class FSUploader extends Uploader {

  get id () { return 'FS' }

  log = new Console('@fadroma/ops: FSUploader' )

  get [Symbol.toStringTag] () { return this.cache?.shortPath ?? '(no cache)' }

  cache?: UploadStore

  constructor (
    /** Agent that will sign the upload transactions(s). */
    public agent?: Agent|null,
    /** If present, upload receipts are stored in it and reused to save reuploads. */
    cache?: string|Path|UploadStore
  ) {
    super(agent)
    if (cache) this.cache = $(cache).as(UploadStore)
    for (const hide of [
      'log',
    ]) Object.defineProperty(this, hide, { enumerable: false, writable: true })
  }

  /** Upload an artifact from the filesystem if an upload receipt for it is not present. */
  async upload (contract: Uploadable): Promise<Uploaded> {
    let receipt: UploadReceipt|null = null
    const cached: Uploaded|undefined = this.cache?.tryGet(contract, this.agent?.chain?.id)
    if (cached) return cached
    if (!contract.artifact) throw new Error('No artifact to upload')
    if (!this.agent) throw new Error('No upload agent')
    const data = $(contract.artifact).as(BinaryFile).load()
    const log = new Console(`Upload: ${bold($(contract.artifact).shortPath)}`)
    log(`hash ${contract.codeHash}`)
    log(`size (uncompressed): ${data.length} bytes`)
    const result = await this.agent.upload(data)
    this.checkCodeHash(contract, result)
    const { codeId, codeHash, uploadTx } = result
    log(`done, code id`, codeId)
    Object.assign(contract, { codeId, codeHash, uploadTx })
    if (receipt && !this.agent?.chain?.isMocknet) {
      // don't save receipts for mocknet because it's not stateful yet
      (receipt as UploadReceipt).save(toUploadReceipt(contract as AnyContract))
    }
    return { ...contract, codeId, codeHash, uploadTx }
  }

  /** Upload multiple contracts from the filesystem. */
  async uploadMany (inputs: Array<Uploadable>): Promise<Array<Uploaded>> {
    // TODO: Optionally bundle the upload messages in one transaction -
    //       this will only work if they add up to less than the max API request size
    //       (which is defined who knows where) */
    const self = this
    if (!self.cache) {
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
      // If there's no local upload receipt, time to reupload.
      if (self.cache) {
        const receiptPath  = self.cache.getUploadReceiptPath(input)
        const relativePath = $(receiptPath).shortPath
        if (!$(receiptPath).exists()) {
          toUpload[index] = input
          return
        }
        // If there's a local upload receipt and it doesn't contain a code hash, time to reupload.
        const receiptData = $(receiptPath).as(UploadReceipt).load()
        const receiptCodeHash = receiptData.codeHash || receiptData.originalChecksum
        if (!receiptCodeHash) {
          self.log.warn(`No code hash in ${bold(relativePath)}; uploading...`)
          toUpload[index] = input
          return
        }
        // If there's a local upload receipt and it contains a different code hash
        // from the one computed earlier, time to reupload.
        if (receiptCodeHash !== input.codeHash) {
          self.log.warn(`Different code hash from ${bold(relativePath)}; reuploading...`)
          toUpload[index] = input
          return
        }
        // Otherwise reuse the code ID from the receipt.
        outputs[index] = Object.assign(input, {
          codeHash: input.codeHash!,
          codeId:   String(receiptData.codeId),
          uploadTx: receiptData.transactionHash as string
        })
      }
    })
    // If any contracts are marked for uploading:
    // - upload them and save the receipts
    // - update outputs with data from upload results (containing new code ids)
    if (toUpload.length > 0) {
      const uploaded = await this.uploadManySansCache(toUpload)
      for (const i in uploaded) {
        if (!uploaded[i]) continue // skip empty ones, preserving index
        const template = uploaded[i]
        const receipt = $(this.cache!, this.cache!.getUploadReceiptName(toUpload[i]))
        receipt.as(UploadReceipt).save(toUploadReceipt(template))
        outputs[i] = template
      }
    }
    return outputs
  }

  /** Ignores the cache. Supports "holes" in artifact array to preserve order of non-uploads. */
  async uploadManySansCache (inputs: Array<Uploadable>): Promise<Array<Uploaded>> {
    const agent = assertAgent(this)
    const outputs: Array<Uploaded> = []
    for (const i in inputs) {
      const input = inputs[i]
      if (!input.artifact) throw new Error.NoArtifact()
      const path = $(input.artifact!)
      const data = path.as(BinaryFile).load()
      input.codeHash ??= base16.encode(sha256(data))
      const log = new Console(`Upload (no cache): ${bold(path.shortPath)}`)
      log(`hash ${input.codeHash}`)
      log(`size (uncompressed): ${data.length} bytes`)
      const result = await agent.upload(data)
      const output = override(input, result) as unknown as Uploaded
      this.checkLocalCodeHash(input as Uploadable & { codeHash: CodeHash }, output)
      outputs[i] = output
      log('code id:', bold(`${result.codeId}`))
      await agent.nextBlock
    }
    return outputs
  }

  /** Make sure that the optional `codeHash` property of an `Uploadable` is populated, by
    * computing the code hash of the locally available artifact that he `Uploadable` specifies.
    * This is used to validate the code hash of the local file against the one returned by the
    * upload transaction. */
  private ensureLocalCodeHash (input: Uploadable): Uploadable & { codeHash: CodeHash } {
    if (!input.codeHash) {
      const artifact = $(input.artifact!)
      this.log.warn('No code hash in artifact', bold(artifact.shortPath))
      try {
        const codeHash = this.hashPath(artifact)
        this.log.warn('Computed code hash:', bold(input.codeHash!))
        input = Object.assign(input, { codeHash })
      } catch (e: any) {
        this.log.warn('Could not compute code hash:', e.message)
      }
    }
    return input as Uploadable & { codeHash: CodeHash }
  }

  /** Compute the SHA256 of a local file. */
  private hashPath (path: string|Path) {
    return $(path).as(BinaryFile).sha256
  }

}

Uploader.variants['FS'] = FSUploader
