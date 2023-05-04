import { Config,  Console, colors, bold, Error, hideProperties as hide } from './util'
import type { UploadConfig } from './util'
import { Contract, Uploader, assertAgent, toUploadReceipt, base16, sha256 } from '@fadroma/agent'
import type {
  Agent, CodeHash, ChainId, CodeId, Uploadable, Uploaded, UploadStore, AnyContract
} from '@fadroma/agent'
import $, { Path, BinaryFile, JSONFile, JSONDirectory } from '@hackbg/file'

/** @returns Uploader configured as per environment and options */
export function getUploader (options: Partial<UploadConfig> = {}): Uploader {
  return new Config({ upload: options }).getUploader()
}

/** Upload a single contract with default settings. */
export function upload (artifact: Uploadable): Promise<Uploaded> {
  return getUploader().upload(artifact)
}

/** Upload multiple contracts with default settings. */
export function uploadMany (artifacts: Uploadable[]): Promise<Uploaded[]> {
  return getUploader().uploadMany(artifacts)
}

/** Directory collecting upload receipts.
  * Upload receipts are JSON files of the format `$CRATE@$REF.wasm.json`
  * and are kept so that we don't reupload the same contracts. */
export class UploadStore_JSON1
extends JSONDirectory<UploadStore_JSON1_Receipt>
implements UploadStore {
  log = new Console('Upload')
  tryGet (contract: Uploadable, _chainId?: ChainId): Uploaded|null {
    const name = this.getUploadReceiptName(contract)
    const receiptFile = this.at(name)
    if (!receiptFile.exists()) return null
    const receipt = receiptFile.as(UploadStore_JSON1_Receipt)
    this.log.sub(name).log(`Already uploaded, see`, bold(receiptFile.shortPath))
    const { chainId = _chainId, codeId, codeHash, uploadTx, } = receipt.toContract()
    const props = { chainId, codeId, codeHash, uploadTx }
    return Object.assign(contract, props) as Uploaded & {
      artifact: URL,
      codeHash: CodeHash,
      codeId:   CodeId
    }
  }
  /** Generate the filename for an upload receipt. */
  getUploadReceiptName ({ artifact }: Uploadable): string {
    return `${$(artifact!).name}.json`
  }
  /** Generate the full path for an upload receipt. */
  getUploadReceiptPath (contract: Uploadable): string {
    const receiptName = `${this.getUploadReceiptName(contract)}`
    const receiptPath = this.resolve(receiptName)
    return receiptPath
  }
}

/** Class that convert itself to a Contract, from which contracts can be instantiated. */
export class UploadStore_JSON1_Receipt extends JSONFile<UploadReceiptData> {
  /** Create a Contract object with the data from the receipt. */
  toContract (defaultChainId?: string) {
    let { chainId, codeId, codeHash, uploadTx, artifact } = this.load()
    chainId ??= defaultChainId
    codeId  = String(codeId)
    return new Contract({ artifact, codeHash, chainId, codeId, uploadTx })
  }
}

export interface UploadReceiptData {
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

/** Uploads contracts from the local filesystem, with optional caching:
  * if provided with an Uploads directory containing upload receipts,
  * allows for uploaded contracts to be reused. */
export class FSUploader extends Uploader {
  log = new Console('FSUploader')

  /** Unique identifier of this uploader implementation. */
  id = 'FS'

  declare store: UploadStore_JSON1

  get [Symbol.toStringTag] () { return this.store?.shortPath ?? '(*)' }

  /** Upload an artifact from the filesystem if an upload receipt for it is not present. */
  async upload (contract: Uploadable): Promise<Uploaded> {
    let receipt: UploadStore_JSON1_Receipt|null = null
    const cached = this.store?.tryGet(contract, this.agent?.chain?.id)
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
      (receipt as UploadStore_JSON1_Receipt).save(toUploadReceipt(contract as AnyContract))
    }
    return { ...contract, codeId, codeHash, uploadTx }
  }
  /** Upload multiple contracts from the filesystem. */
  async uploadMany (inputs: Array<Uploadable>): Promise<Array<Uploaded>> {
    // TODO: Optionally bundle the upload messages in one transaction -
    //       this will only work if they add up to less than the max API request size
    //       (which is defined who knows where) */
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
      // If there's no local upload receipt, time to reupload.
      if (self.store) {
        const receiptPath  = self.store.getUploadReceiptPath(input)
        const relativePath = $(receiptPath).shortPath
        if (!$(receiptPath).exists()) {
          toUpload[index] = input
          return
        }
        // If there's a local upload receipt and it doesn't contain a code hash, time to reupload.
        const receiptData = $(receiptPath).as(UploadStore_JSON1_Receipt).load()
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
        const receipt = $(this.store!, this.store!.getUploadReceiptName(toUpload[i]))
        receipt.as(UploadStore_JSON1_Receipt).save(toUploadReceipt(template))
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
      const log = new Console(path.shortPath)
      const data = path.as(BinaryFile).load()
      log(`size (uncompressed): ${data.length} bytes`)

      input.codeHash ??= base16.encode(sha256(data))
      log(`hash ${input.codeHash}`)

      const result = await agent.upload(data)
      const output = { ...input, ...result }
      this.checkLocalCodeHash(input as Uploadable & { codeHash: CodeHash }, output)
      outputs[i] = output

      log('uploaded to code id', bold(`${result.codeId}`))
      log.br()

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
