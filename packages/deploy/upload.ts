import { bold } from '@hackbg/konzola'
import $, { Path, JSONFile, JSONDirectory, BinaryFile } from '@hackbg/kabinet'
import { Agent, Contract, Uploader } from '@fadroma/client'
import { CustomConsole } from '@hackbg/konzola'
import { codeHashForPath } from '@fadroma/build'

export class UploadConsole extends CustomConsole {
  constructor (name = 'Fadroma Upload') {
    super(name)
  }
}

/** Uploads contracts from the local filesystem, with optional caching:
  * if provided with an Uploads directory containing upload receipts,
  * allows for uploaded contracts to be reused. */
export class FSUploader extends Uploader {

  /** This defines the default path for the upload receipt cache. */
  static fromConfig (
    agent:        Agent,
    projectRoot?: string|Path|false,
    cacheRoot?:   string|Path|false
  ) {
    if (projectRoot) {
      cacheRoot ??= $(projectRoot).in('receipts').in(agent.chain.id).in('uploads').as(Uploads)
    }
    return new this(agent, cacheRoot ? $(cacheRoot).as(Uploads) : undefined)
  }

  constructor (
    /** Agent that will sign the upload transactions(s). */
    readonly agent?: Agent|null,
    /** If present, upload receipts are stored in it and reused to save reuploads. */
    readonly cache?: Uploads
  ) {
    super(agent)
  }

  readonly id = 'fs'

  log = new UploadConsole('Fadroma.FSUploader')

  /** Upload an artifact from the filesystem if an upload receipt for it is not present. */
  async upload (template: Contract<any>): Promise<Contract<any>> {
    console.trace(template)
    let receipt: UploadReceipt|null = null
    if (this.cache) {
      const name = this.getUploadReceiptName(template)
      receipt = this.cache.at(name).as(UploadReceipt)
      if (receipt.exists()) {
        this.log.info('Found    ', bold(this.cache.at(name).shortPath))
        return receipt.toContract()
      }
    }
    if (!template.artifact) {
      throw new Error('No artifact specified in template')
    }
    const data = $(template.artifact).as(BinaryFile).load()
    const result = await this.agent.upload(data)
    if (template.codeHash && result.codeHash && template.codeHash !== result.codeHash) {
      throw new Error(
        `Code hash mismatch when uploading ${template.artifact?.toString()}: ` +
        `${template.codeHash} vs ${result.codeHash}`
      )
    }
    template = new Contract(template, result)
    if (receipt) {
      receipt.save(template)
    }
    //await this.agent.nextBlock
    return template
  }

  getUploadReceiptName (template: Contract<any>): string {
    return `${$(template.artifact!).name}.json`
  }

  getUploadReceiptPath (template: Contract<any>): string {
    const receiptName = `${this.getUploadReceiptName(template)}`
    const receiptPath = this.cache!.resolve(receiptName)
    return receiptPath
  }

  /** Upload multiple templates from the filesystem.
    * TODO: Optionally bundle multiple templates in one transaction,
    * if they add up to less than the max API request size (which is defined... where?) */
  async uploadMany (inputs: Array<Contract<any>>): Promise<Array<Contract<any>>> {

    if (!this.cache) return this.uploadManySansCache(inputs)

    const outputs:  Contract<any>[] = []
    const toUpload: Contract<any>[] = []

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
        this.log.warn(bold(`No receipt:`), `${relativePath}; uploading...`)
        toUpload[i] = input
        continue
      }

      // If there's a local upload receipt and it doesn't contain a code hash, time to reupload.
      const receiptData = $(receiptPath).as(UploadReceipt).load()
      const receiptCodeHash = receiptData.codeHash || receiptData.originalChecksum
      if (!receiptCodeHash) {
        this.log.warn(bold(`No code hash in receipt:`), `${relativePath}; reuploading...`)
        toUpload[i] = input
        continue
      }

      // If there's a local upload receipt and it contains a different code hash
      // from the one computed earlier, time to reupload.
      if (receiptCodeHash !== input.codeHash) {
        this.log.warn(bold(`Different code hash from receipt:`), `${relativePath}; reuploading...`)
        toUpload[i] = input
        continue
      }

      // Otherwise reuse the code ID from the receipt.
      outputs[i] = new Contract(input, {
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
        const receiptName = this.getUploadReceiptName(toUpload[i])
        $(this.cache, receiptName).as(UploadReceipt).save(uploaded[i])
        outputs[i] = uploaded[i] as Contract<any>
      }
    } else {
      this.log.info('No artifacts were uploaded.')
    }

    return outputs

  }

  /** Ignores the cache. Supports "holes" in artifact array to preserve order of non-uploads. */
  async uploadManySansCache (inputs: Array<Contract<any>>): Promise<Array<Contract<any>>> {
    const outputs: Array<Contract<any>> = []
    for (const i in inputs) {
      const input = inputs[i]
      if (input?.artifact) {
        const path = $(input.artifact!)
        const data = path.as(BinaryFile).load()
        this.log.info('Uploading', bold(path.shortPath), `(${data.length} bytes uncompressed)`)
        const output = new Contract({ ...input, ...await this.agent.upload(data) })
        this.checkLocalCodeHash(input, output)
        outputs[i] = output
      } else {
        outputs[i] = input
      }
    }
    return outputs
  }

  private ensureLocalCodeHash (input: Contract<any>): Contract<any> {
    if (!input.codeHash) {
      const artifact = $(input.artifact!)
      this.log.warn('No code hash in artifact', bold(artifact.shortPath))
      try {
        const codeHash = codeHashForPath($(input.artifact!).path)
        this.log.warn('Computed code hash:', bold(input.codeHash!))
        input = new Contract({ ...input,  codeHash })
      } catch (e: any) {
        this.log.warn('Could not compute code hash:', e.message)
      }
    }
    return input
  }

  /** Panic if the code hash returned by the upload
    * doesn't match the one specified in the Contract. */
  private checkLocalCodeHash (input: Contract<any>, output: Contract<any>) {
    if (input.codeHash !== output.codeHash) {
      throw new Error(`
        The upload transaction ${output.uploadTx}
        returned code hash ${output.codeHash} (of code id ${output.codeId})
        instead of the expected ${input.codeHash} (of artifact ${input.artifact})
      `.trim().split('\n').map(x=>x.trim()).join(' '))
    }
  }

}

/** Directory collecting upload receipts.
  * Upload receipts are JSON files of the format `$CRATE@$REF.wasm.json`
  * and are kept so that we don't reupload the same contracts. */
export class Uploads extends JSONDirectory<UploadReceipt> {}

/** Class that convert itself to a Contract, from which contracts can be instantiated. */
export class UploadReceipt extends JSONFile<UploadReceiptFormat> {

  toContract (defaultChainId?: string) {
    let { chainId, codeId, codeHash, uploadTx, artifact } = this.load()
    chainId ??= defaultChainId
    codeId  = String(codeId)
    return new Contract({ artifact, codeHash, chainId, codeId, uploadTx })
  }

}

/** Fields in the upload receipt. */
export interface UploadReceiptFormat {
  artifact?:          any
  chainId?:           string
  codeHash:           string
  codeId:             number|string
  compressedChecksum: string
  compressedSize:     string
  logs:               any[]
  originalChecksum:   string
  originalSize:       number
  transactionHash:    string
  uploadTx?:          string
}
