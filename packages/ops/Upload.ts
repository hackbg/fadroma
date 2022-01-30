import {
  Console, basename, bold, relative,
  existsSync, mkdir, readFile, writeFile, JSONDirectory
} from '@hackbg/tools'

const console = Console('@fadroma/ops/Upload')

import type { Chain } from './Chain'
import type { Agent } from './Agent'

export type UploadEnv     = { chain?: Chain; uploader?: Agent }
export type UploadInputs  = { artifact?: string; codeHash?: string }
export type UploadOutputs = {
  uploadReceipt?: UploadReceipt
  codeHash?:      string
  codeId?:        number
}

export type UploadInfo = UploadEnv & UploadInputs & UploadOutputs

export interface Upload extends UploadInfo {
  (): Promise<UploadReceipt>
}

export interface Uploadable extends UploadInfo {
  upload (): Promise<UploadReceipt>
}

export type UploadReceipt = {
  codeId:             number
  compressedChecksum: string
  compressedSize:     string
  logs:               any[]
  originalChecksum:   string
  originalSize:       number
  transactionHash:    string
}

import { Buildable } from './Build'
export class Uploader implements Uploadable {

  #contract: Buildable & Uploadable

  constructor (contract: Buildable & Uploadable) {
    this.#contract = contract
  }

  get chain         () { return this.#contract.chain }
  get uploader      () { return this.#contract.uploader }
  get artifact      () { return this.#contract.artifact }
  get codeId        () { return this.#contract.codeId }
  get uploadReceipt () { return this.#contract.uploadReceipt }
  get codeHash      () { return this.#contract.codeHash }

  /** Upload the contract to a specified chain as a specified agent. */
  async upload (
    chain:    Chain,
    uploader: Agent,
  ): Promise<UploadReceipt> {
    this.#contract.chain    = chain
    this.#contract.uploader = uploader

    // if no uploader, bail
    if (!this.uploader) {
      throw new Error(
        `[@fadroma/ops/Contract] contract.upload() requires contract.uploader to be set`
      )
    }

    // if not built, build
    if (!this.artifact) {
      await this.#contract.build()
    }

    // upload if not already uploaded
    const uploadReceipt = this.#contract.uploadReceipt = await uploadFromFS(
      this.uploader,
      this.artifact,
      this.uploadReceiptPath
    )

    // set code it and code hash to allow instantiation of uploaded code
    this.#contract.codeId   = uploadReceipt.codeId
    if (
      this.#contract.codeHash &&
      this.#contract.codeHash !== uploadReceipt.originalChecksum
    ) {
      console.warn(
        `@fadroma/ops/Upload: contract already had codeHash set `+
        `and did not match the result from the upload`
      )
    }
    this.#contract.codeHash = uploadReceipt.originalChecksum

    return this.uploadReceipt
  }

  /** Path to where the result of the upload transaction is stored */
  get uploadReceiptPath () {
    const name = `${basename(this.artifact)}.json`
    return this.chain.uploads.resolve(name)
  }
}

async function uploadFromFS (
  uploader:          Agent,
  artifact:          string,
  uploadReceiptPath: string,
  forceReupload = false
  // TODO: flag to force reupload
) {
  if (existsSync(uploadReceiptPath) && !forceReupload) {
    const receiptData = await readFile(uploadReceiptPath, 'utf8')
    console.info(
      bold(`Exists:`),
      relative(process.cwd(), uploadReceiptPath)
    )
    return JSON.parse(receiptData)
  } else {
    console.info(bold(`Uploading`), artifact)
    const uploadResult = await uploader.upload(artifact)
    const receiptData  = JSON.stringify(uploadResult, null, 2)
    const elements     = uploadReceiptPath.slice(1, uploadReceiptPath.length).split('/');
    let path = `/`
    for (const item of elements) {
      if (!existsSync(path)) mkdir(path)
      path += `/${item}`
    }
    await writeFile(uploadReceiptPath, receiptData, 'utf8')
    await uploader.nextBlock
    return uploadResult
  }
}

export class Uploads extends JSONDirectory {
  /** List of code blobs in human-readable form */
  table () {
    const rows = []
    // uploads table - lists code blobs
    rows.push([bold('  code id'), bold('name\n'), bold('size'), bold('hash')])
    if (this.exists()) {
      for (const name of this.list()) {
        const {
          codeId,
          originalSize,
          compressedSize,
          originalChecksum,
          compressedChecksum,
        } = this.load(name)
        rows.push([
          `  ${codeId}`,
          `${bold(name)}\ncompressed:\n`,
          `${originalSize}\n${String(compressedSize).padStart(String(originalSize).length)}`,
          `${originalChecksum}\n${compressedChecksum}`
        ])
      }
    }
    return rows.sort((x,y)=>x[0]-y[0])
  }
}
