import { base16, sha256 } from '@hackbg/4mat'
import { colors, bold } from '@hackbg/logs'
import $, { Path, BinaryFile } from '@hackbg/file'
import { Uploader, assertAgent, override, toUploadReceipt, ClientError } from '@fadroma/core'
import type { Agent, CodeHash, CodeId, Uploadable, Uploaded, AnyContract } from '@fadroma/core'

import Console from './UploadConsole'
import UploadStore, { UploadReceipt } from './UploadStore'

/** Uploads contracts from the local filesystem, with optional caching:
  * if provided with an Uploads directory containing upload receipts,
  * allows for uploaded contracts to be reused. */
export default class FSUploader extends Uploader {

  get id () { return 'FS' }

  log = new Console()

  get [Symbol.toStringTag] () { return this.cache?.shortPath ?? '-' }

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
    if (this.cache) {
      const name = this.getUploadReceiptName(contract)
      const receiptFile = this.cache.at(name)
      if (receiptFile.exists()) {
        receipt = receiptFile.as(UploadReceipt)
        this.log.log(`${colors.green('Found:')}   `, bold(colors.green(receiptFile.shortPath)))
        const {
          chainId = this.agent?.chain?.id,
          codeId,
          codeHash,
          uploadTx,
        } = receipt.toContract()
        const props = { chainId, codeId, codeHash, uploadTx }
        return Object.assign(contract, props) as Uploaded & {
          artifact: URL, codeHash: CodeHash, codeId: CodeId
        }
      }
    }

    if (!contract.artifact) throw new Error('No artifact to upload')
    if (!this.agent) throw new Error('No upload agent')
    this.log.log('Uploading', bold($(contract.artifact).shortPath))

    const result = await this.agent.upload($(contract.artifact).as(BinaryFile).load())
    if (
      contract.codeHash && result.codeHash &&
      contract.codeHash.toUpperCase() !== result.codeHash.toUpperCase()
    ) {
      throw new Error(
        `Code hash mismatch when uploading ${contract.artifact?.toString()}: ` +
        `${contract.codeHash} vs ${result.codeHash}`
      )
    }
    const { codeId, codeHash, uploadTx } = result
    Object.assign(contract, { codeId, codeHash, uploadTx })

    // don't save receipts for mocknet because it's not stateful yet
    if (receipt && !this.agent?.chain?.isMocknet) {
      (receipt as UploadReceipt).save(toUploadReceipt(contract as AnyContract))
    }

    //await this.agent.nextBlock
    return contract as Uploaded & { artifact: URL, codeHash: CodeHash, codeId: CodeId }
  }

  /** Generate the filename for an upload receipt. */
  getUploadReceiptName ({ artifact }: Uploadable): string {
    return `${$(artifact!).name}.json`
  }

  /** Generate the full path for an upload receipt. */
  getUploadReceiptPath (contract: Uploadable): string {
    const receiptName = `${this.getUploadReceiptName(contract)}`
    const receiptPath = this.cache!.resolve(receiptName)
    return receiptPath
  }

  /** Upload multiple contracts from the filesystem. */
  async uploadMany (inputs: Array<Uploadable>): Promise<Array<Uploaded>> {

    // TODO: Optionally bundle the upload messages in one transaction -
    //       this will only work if they add up to less than the max API request size
    //       (which is defined who knows where) */

    if (!this.cache) {
      return this.uploadManySansCache(inputs)
    }

    const outputs:  Uploaded[] = []
    const toUpload: Uploadable[] = []

    for (const i in inputs) {

      // Skip empty positions
      let input = inputs[i]
      if (!input) {
        continue
      }

      // Make sure local code hash is available to compare against the result of the upload
      // If these two don't match, the local contract was rebuilt and needs to be reuploaded.
      // If they still don't match after the reupload, there's a problem.
      input = this.ensureLocalCodeHash(input)

      // If there's no local upload receipt, time to reupload.
      const blobName     = $(input.artifact!).name
      const receiptPath  = this.getUploadReceiptPath(input)
      const relativePath = $(receiptPath).shortPath
      if (!$(receiptPath).exists()) {
        toUpload[i] = input
        continue
      }

      // If there's a local upload receipt and it doesn't contain a code hash, time to reupload.
      const receiptData = $(receiptPath).as(UploadReceipt).load()
      const receiptCodeHash = receiptData.codeHash || receiptData.originalChecksum
      if (!receiptCodeHash) {
        this.log.warn(`No code hash in ${bold(relativePath)}; uploading...`)
        toUpload[i] = input
        continue
      }

      // If there's a local upload receipt and it contains a different code hash
      // from the one computed earlier, time to reupload.
      if (receiptCodeHash !== input.codeHash) {
        this.log.warn(`Different code hash from ${bold(relativePath)}; reuploading...`)
        toUpload[i] = input
        continue
      }

      // Otherwise reuse the code ID from the receipt.
      outputs[i] = Object.assign(input, {
        codeHash: input.codeHash!,
        codeId:   String(receiptData.codeId),
        uploadTx: receiptData.transactionHash as string
      })

    }

    // If any contracts are marked for uploading:
    // - upload them and save the receipts
    // - update outputs with data from upload results (containing new code ids)
    if (toUpload.length > 0) {
      const uploaded = await this.uploadManySansCache(toUpload)
      for (const i in uploaded) {
        if (!uploaded[i]) continue // skip empty ones, preserving index
        const template = uploaded[i]
        $(this.cache, this.getUploadReceiptName(toUpload[i]))
          .as(UploadReceipt)
          .save(toUploadReceipt(template))
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
      if (!input.artifact) throw new ClientError.NoArtifact()
      const path = $(input.artifact!)
      const data = path.as(BinaryFile).load()
      input.codeHash ??= base16.encode(sha256(data))
      this.log.log('Uploading', bold(path.shortPath), `(${data.length} bytes uncompressed)`)
      const result = await agent.upload(data)
      const output = override(input, result) as unknown as Uploaded
      this.checkLocalCodeHash(input as Uploadable & { codeHash: CodeHash }, output)
      outputs[i] = output
    }
    return outputs
  }

  /** Panic if the code hash returned by the upload
    * doesn't match the one specified in the Contract. */
  private checkLocalCodeHash (input: Uploadable & { codeHash: CodeHash }, output: Uploaded) {
    if (input.codeHash !== output.codeHash) {
      throw new Error(`
        The upload transaction ${output.uploadTx}
        returned code hash ${output.codeHash} (of code id ${output.codeId})
        instead of the expected ${input.codeHash} (of artifact ${input.artifact})
      `.trim().split('\n').map(x=>x.trim()).join(' '))
    }
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
