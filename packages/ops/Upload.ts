import { Console, bold } from '@hackbg/tools'

const console = Console('@fadroma/ops/Upload')

import type { Uploader } from './Core'
import type { Agent } from './Agent'
export class BaseUploader implements Uploader {
  constructor (readonly agent: Agent) {}
  upload = uploadFromFS
}

import { existsSync, mkdir, readFile, writeFile, relative, basename } from '@hackbg/fadroma'
import { Artifact, Template, UploadReceipt } from './Core'
async function uploadFromFS (
  artifact: Artifact,
  context = this
): Promise<Template> {

  const {
    agent,
    receiptName = `${basename(artifact.location)}.json`,
    receiptPath = agent.chain.uploads.resolve(receiptName),
    alwaysReupload = false
  } = context

  if (existsSync(receiptPath) && !alwaysReupload) {
    const receiptData = await readFile(receiptPath, 'utf8')
    //console.info(bold(`Exists:`), relative(process.cwd(), receiptPath))
    return JSON.parse(receiptData)
  }

  console.info(bold(`Uploading:`), artifact)
  const receipt = await agent.upload(artifact)

  console.info(bold(`Storing:`), receiptPath)
  await writeFile(receiptPath, JSON.stringify(receipt, null, 2), 'utf8')

  await agent.nextBlock

  return {
    chainId:  agent.chain.id,
    codeId:   receipt.codeId,
    codeHash: receipt.originalChecksum,
    receipt
  }

}

import { JSONDirectory } from '@hackbg/fadroma'
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

/*
    // set code id and code hash to allow instantiation of uploaded code
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
    */
