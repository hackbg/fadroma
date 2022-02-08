import { Console, bold, cwd, readFileSync, writeFileSync } from '@hackbg/tools'

const console = Console('@fadroma/ops/Upload')

import { Uploader, codeHashForPath } from './Core'
import type { Agent } from './Agent'
import type { Contract } from './Contract'
export class BaseUploader implements Uploader {
  constructor (readonly agent: Agent) {}
  upload = uploadFromFS
}

export class CachingUploader extends BaseUploader {

  constructor (
    readonly agent:   Agent,
    readonly uploads: Uploads
  ) {
    super(agent)
  }

  /* TODO support individual cached uploads */
  /* TODO support bundling for binaries under a certain size */
  /* TODO find where the max request size is defined */

  async uploadAll (agent: Agent, contracts: Contract<any>[]): Promise<void> {

    const chainId = agent.chain.id
    const contractsToUpload = []
    for (const contract of contracts) {
      if (!contract.artifact) {
        throw new Error('@fadroma/ops/Upload: Missing contract.artifact')
      }
      if (!contract.artifact.codeHash) {
        console.warn(
          bold('No code hash in artifact'),
          contract.artifact.location
        )
        console.warn(
          bold('Computed checksum:'),
          contract.artifact.codeHash = codeHashForPath(contract.artifact.location)
        )
      }
      const blobName = basename(contract.artifact.location)
      const receiptPath = this.uploads.resolve(`${blobName}.json`)
      const relativePath = relative(cwd(), receiptPath)
      if (existsSync(receiptPath)) {
        const content = readFileSync(receiptPath, 'utf8')
        const data = JSON.parse(content)
        const receiptCodeHash = data.codeHash || data.originalChecksum
        if (!receiptCodeHash) {
          console.info(bold(`No code hash:`), `${relativePath}; reuploading...`)
          contractsToUpload.push(contract)
        } else if (receiptCodeHash !== contract.artifact.codeHash) {
          console.info(bold(`Different code hash:`), `${relativePath}; reuploading...`)
          contractsToUpload.push(contract)
        } else {
          console.info('✅', bold(relativePath), `exists - not reuploading (code hash matches)`)
          contract.template = {
            chainId,
            codeId:          data.codeId,
            codeHash:        contract.artifact.codeHash,
            transactionHash: data.transactionHash as string,
          }
        }
      } else {
        console.info(bold(`No upload receipt:`), `${relativePath}; uploading...`)
        contractsToUpload.push(contract)
      }
    }

    if (contractsToUpload.length > 0) {
      console.info('Need to upload', bold(String(contractsToUpload.length)), 'contracts')
      for (const contract of contractsToUpload) {
        const receipt = await agent.upload(contract.artifact.location)
        const { transactionHash, codeId, originalChecksum } = receipt
        if (originalChecksum !== contract.artifact.codeHash) {
          console.warn(
            `Code hash mismatch from TX ${transactionHash}:\n`+
            `  ${contract.artifact.location}=${contract.artifact.codeHash}`+
            `  codeId#${codeId}=${originalChecksum}`
          )
        }
        contract.template = {
          chainId,
          codeId,
          codeHash: originalChecksum,
          transactionHash
        }
        const receiptName = `${basename(contract.artifact.location)}.json`
        const receiptPath = this.uploads.make().resolve(receiptName)
        writeFileSync(receiptPath, JSON.stringify(contract.template, null, 2))
      }
      // TODO optionally bundle depending on total size (where is maximum defined?)')
      /*let bundle = agent.bundle()
      for (const contract of contractsToUpload) {
        bundle = bundle.upload(contract.artifact)
      }
      const uploadResult = await bundle.run()*
      const { transactionHash } = uploadResult
      for (const i in contractsToUpload) {
        const contract = contractsToUpload[i]
        const chainId  = agent.chain.id
        const logs     = uploadResult.logs[i]
        const codeId   = logs.events[0].attributes[3].value
        const codeHash = contract.artifact.codeHash
        contract.template = { chainId, codeId, codeHash, transactionHash }
        const receiptName = `${basename(contractsToUpload[i].artifact.location)}.json`
        const receiptPath = this.uploads.make().resolve(receiptName)
        writeFileSync(receiptPath, JSON.stringify(contractsToUpload[i].template, null, 2))
      }*/
    }
  }
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
    chainId:         agent.chain.id,
    codeId:          receipt.codeId,
    codeHash:        receipt.originalChecksum,
    transactionHash: receipt.transactionHash
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
