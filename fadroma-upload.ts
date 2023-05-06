import type {
  Agent, CodeHash, ChainId, CodeId, Uploadable, Uploaded, AnyContract,
  UploadConfig
} from './fadroma'
import {
  Config, Console, colors, bold, Error, hideProperties as hide
} from './fadroma-base'
import {
  Template, Uploader, assertAgent, toUploadReceipt, base16, sha256
} from '@fadroma/agent'
import $, { Path, BinaryFile, JSONFile, JSONDirectory } from '@hackbg/file'
import { fileURLToPath } from 'node:url'

/** @returns Uploader configured as per environment and options */
export function getUploader (options: Partial<UploadConfig> = {}): Uploader {
  return new Config({ upload: options }).getUploader()
}
/** Upload a single contract with default settings. */
export function upload (artifact: Uploadable): Promise<Uploaded> {
  return getUploader().upload(artifact)
}
/** Upload multiple contracts with default settings. */
export function uploadMany (artifacts: Uploadable[]): Promise<(Uploaded|null)[]> {
  return getUploader().uploadMany(artifacts)
}

/** Uploads contracts from the local filesystem, with optional caching:
  * if provided with an Uploads directory containing upload receipts,
  * allows for uploaded contracts to be reused. */
export class FSUploader extends Uploader {
  log = new Console('upload (node:fs)')
  /** Unique identifier of this uploader implementation. */
  id = 'FS'
  /** Directory with JSON files */
  store = new JSONDirectory<UploadReceipt_v1>()

  get [Symbol.toStringTag] () { return this.store?.shortPath ?? '(*)' }

  /** @returns Uploaded from the cache or store or undefined */
  get (uploadable: Uploadable): Uploaded|undefined {
    this.addCodeHash(uploadable)
    const cached = super.get(uploadable)
    if (cached) return cached
    const { codeHash } = uploadable
    if (!this.agent) throw new Error.Missing.Agent()
    if (!this.agent.chain) throw new Error.Missing.Chain()
    const receipt = this.store
      .in('state')
      .in(this.agent.chain.id)
      .in('upload')
      .at(`${codeHash!.toLowerCase()}.json`)
      .as(JSONFile<Uploaded>)
    this.log('trying', receipt.shortPath)
    if (receipt.exists()) {
      const uploaded = receipt.load() as unknown as Uploaded
      if (uploaded.codeId) {
        this.log('found code id', uploaded.codeId)
        return this.cache[codeHash!] = uploaded
      } else {
        this.log.warn(receipt.shortPath, 'contained no "codeId"')
      }
    }
  }

  /** Add an Uploaded to the cache and store. */
  set (uploaded: Uploaded): this {
    this.addCodeHash(uploaded)
    super.set(uploaded)
    if (!this.agent) throw new Error.Missing.Agent()
    if (!this.agent.chain) throw new Error.Missing.Chain()
    const receipt = this.store
      .in('state')
      .in(this.agent.chain.id)
      .in('upload')
      .at(`${uploaded.codeHash!.toLowerCase()}.json`)
      .as(JSONFile<Uploaded>)
    this.log('writing', receipt.shortPath)
    receipt.save({
      artifact: String(uploaded.artifact),
      chainId:  uploaded.chainId || this.agent.chain.id,
      codeId:   uploaded.codeId,
      codeHash: uploaded.codeHash,
      uploadTx: uploaded.uploadTx
    })
    return this
  }

  protected addCodeHash (uploadable: Partial<Uploadable>) {
    if (!uploadable.codeHash) {
      if (uploadable.artifact) {
        uploadable.codeHash = base16.encode(sha256(this.fetchSync(uploadable.artifact)))
        this.log(`hashed ${String(uploadable.artifact)}:`, uploadable.codeHash)
      } else {
        this.log(`no artifact, can't compute code hash`)
      }
    }
  }
  protected async fetch (path: string|URL): Promise<Uint8Array> {
    return await Promise.resolve(this.fetchSync(path))
  }
  protected fetchSync (path: string|URL): Uint8Array {
    return $(fileURLToPath(new URL(path, 'file:'))).as(BinaryFile).load()
  }
}

Uploader.variants['FS'] = FSUploader


/** Class that convert itself to a `Template`,
  * from which `Contract`s can subsequently be instantiated. */
export class UploadReceipt_v1 extends JSONFile<UploadReceiptData> {
  /** Create a Template object with the data from the receipt. */
  toTemplate (defaultChainId?: string) {
    let { chainId, codeId, codeHash, uploadTx, artifact } = this.load()
    chainId ??= defaultChainId
    codeId  = String(codeId)
    return new Template({ artifact, codeHash, chainId, codeId, uploadTx })
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
