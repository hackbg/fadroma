import type {
  BuildOptions,
  ContractUpload, UploadOptions, UploadReceipt,
  Chain, Agent,
} from './Model'
import { DockerizedContractBuild } from './Build'

import {
  Console, basename, bold, relative, existsSync, mkdir, readFile, writeFile
} from '@hackbg/tools'

const console = Console('@fadroma/ops/Upload')

export type ContractUploadOptions = {
  artifact?:      string
  codeHash?:      string
  chain?:         Chain
  uploader?:      Agent
  uploadReceipt?: UploadReceipt
  codeId?:        number
}

export interface ContractUpload extends ContractUploadOptions {
  upload (): Promise<any>
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

export abstract class FSContractUpload
              extends DockerizedContractBuild
           implements ContractUpload
{

  constructor (options: BuildOptions & UploadOptions = {}) {
    super(options)
  }

  // upload inputs
  artifact?:      string
  codeHash?:      string
  chain?:         Chain
  uploader?:      Agent

  // upload outputs
  codeId?:        number
  uploadReceipt?: UploadReceipt

  /** Code ID + code hash pair in Sienna Swap Factory format */
  get template () {
    return {
      id: this.codeId,
      code_hash: this.codeHash
    }
  }

  /** Path to where the result of the upload transaction is stored */
  get uploadReceiptPath () {
    const name = `${basename(this.artifact)}.json`
    return this.chain.uploads.resolve(name)
  }

  async uploadAs (agent: Agent): Promise<this> {
    this.uploader = agent
    return this.uploadTo(agent.chain)
  }

  async uploadTo (chain: Chain): Promise<this> {
    this.chain = chain
    await this.upload()
    return this
  }

  /** Upload the contract to a specified chain as a specified agent. */
  async upload () {
    // if no uploader, bail
    if (!this.uploader) {
      throw new Error(
        `[@fadroma/ops/Contract] contract.upload() requires contract.uploader to be set`
      )
    }
    // if not built, build
    if (!this.artifact) {
      await this.buildInDocker()
    }
    // upload if not already uploaded
    const uploadReceipt = await uploadFromFS(
      this.uploader,
      this.artifact,
      this.uploadReceiptPath
    )
    this.uploadReceipt = uploadReceipt
    // set code it and code hash to allow instantiation of uploaded code
    this.codeId   = uploadReceipt.codeId
    this.codeHash = uploadReceipt.originalChecksum
    return this.uploadReceipt
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
      bold(`Not reuploading:`),
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
