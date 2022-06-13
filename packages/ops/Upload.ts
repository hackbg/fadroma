import { fileURLToPath } from 'url'

import { Console, bold } from '@hackbg/konzola'
import $, { BinaryFile, JSONFile, JSONDirectory } from '@hackbg/kabinet'

import type { Agent, Template, Artifact } from '@fadroma/client'

import { codeHashForPath } from './Build'
import type { Source } from './Build'
import { getUploads } from './State'

const console = Console('Fadroma Upload')

/** The part of OperationContext that deals with uploading
  * contract code to the platform. */
export interface UploadContext {
  uploader?: Uploader

  upload: (artifact: Artifact) => Promise<Template>

  uploadMany: (artifacts: Artifact[]) => Promise<Template[]>

  buildAndUpload: (source: Source) => Promise<Template>

  buildAndUploadMany: (sources: Source[]) => Promise<Template[]>
}

export abstract class Uploader {
  constructor (public agent: Agent) {}
  get chain () { return this.agent.chain }
  abstract upload     (artifact:  Artifact, ...args): Promise<Template>
  abstract uploadMany (artifacts: Artifact[]):        Promise<Template[]>
}

export interface UploadReceipt {
  codeHash:           string
  codeId:             number
  compressedChecksum: string
  compressedSize:     string
  logs:               any[]
  originalChecksum:   string
  originalSize:       number
  transactionHash:    string
}

/** Directory collecting upload receipts. */
export class Uploads extends JSONDirectory<UploadReceipt> {}

/** Uploads contracts from the local file system. */
export class FSUploader extends Uploader {

  /** Upload an Artifact from the filesystem, returning a Template. */
  async upload (artifact: Artifact): Promise<Template> {
    console.info(`Uploading:`, bold($(artifact.url).shortPath))
    console.info(`Code hash:`, bold(artifact.codeHash))
    const template = await this.agent.upload($(artifact.url).as(BinaryFile).load())
    await this.agent.nextBlock
    return template
  }

  /** Upload multiple Artifacts from the filesystem.
    * TODO: Optionally bundle them (where is max size defined?) */
  async uploadMany (artifacts: Artifact[]): Promise<Template[]> {
    const templates = []
    for (const i in artifacts) {
      // support "holes" in artifact array
      // (used by caching subclass)
      const artifact = artifacts[i]
      let template
      if (artifact) {
        template = await this.agent.upload($(artifact.url).as(BinaryFile).load())
        this.checkCodeHash(artifact, template)
      }
      templates[i] = template
    }
    return templates
  }

  /** Print a warning if the code hash returned by the upload
    * doesn't match the one specified in the Artifact.
    * This means the Artifact is wrong, and may become
    * a hard error in the future. */
  checkCodeHash (artifact: Artifact, template: Template) {
    if (template.codeHash !== artifact.codeHash) {
      console.warn(
        `Code hash mismatch from upload in TX ${template.uploadTx}:\n`+
        `  Expected ${artifact.codeHash} (from ${$(artifact.url).shortPath})`+
        `  Got      ${template.codeHash} (from codeId#${template.codeId})`
      )
    }
  }

}

/** Uploads contracts from the file system,
  * but only if a receipt does not exist in the chain's uploads directory. */
export class CachingFSUploader extends FSUploader {

  static fromConfig (agent, projectRoot) {
    return new CachingFSUploader(
      agent,
      projectRoot.in('receipts').in(agent.chain.id).in('uploads').as(Uploads)
    )
  }

  constructor (readonly agent: Agent, readonly cache: Uploads) {
    super(agent)
  }

  protected getUploadReceiptPath (artifact: Artifact): string {
    const receiptName = `${this.getUploadReceiptName(artifact)}.json`
    const receiptPath = this.cache.resolve(receiptName)
    return receiptPath
  }

  protected getUploadReceiptName (artifact: Artifact): string {
    return `${$(artifact.url).name}.json`
  }

  /** Upload an artifact from the filesystem if an upload receipt for it is not present. */
  async upload (artifact: Artifact): Promise<Template> {
    const receipt = this.cache.at(this.getUploadReceiptName(artifact)).as(JSONFile)
    if (receipt.exists()) {
      return receipt.load()
    }
    const template = await super.upload(artifact)
    console.info(bold(`Storing:  `), $(receipt.path).shortPath)
    receipt.save(template)
    return template
  }

  async uploadMany (artifacts: Artifact[]): Promise<Template[]> {

    const templates = []
    const artifactsToUpload  = []

    for (const i in artifacts) {

      const artifact = artifacts[i]
      this.ensureCodeHash(artifact)

      const blobName     = $(artifact.url).name
      const receiptPath  = this.getUploadReceiptPath(artifact)
      const relativePath = $(receiptPath).shortPath

      if (!$(receiptPath).exists()) {

        console.info(`Uploading:`, bold($(artifact.url).shortPath))
        artifactsToUpload[i] = artifact

      } else {

        const receiptFile     = $(receiptPath).as(JSONFile) as JSONFile<UploadReceipt>
        const receiptData     = receiptFile.load()
        const receiptCodeHash = receiptData.codeHash || receiptData.originalChecksum

        if (!receiptCodeHash) {
          console.info(
            bold(`No code hash:`), `${relativePath}; reuploading...`
          )
          artifactsToUpload[i] = artifact
          continue
        }

        if (receiptCodeHash !== artifact.codeHash) {
          console.info(
            bold(`Different code hash:`), `${relativePath}; reuploading...`
          )
          artifactsToUpload[i] = artifact
          continue
        }

        console.info(
          '✅', 'Exists, not reuploading (same code hash):', bold(relativePath)
        )

        templates[i] = {
          chainId:         this.chain.id,
          codeId:          receiptData.codeId,
          codeHash:        artifact.codeHash,
          transactionHash: receiptData.transactionHash as string,
        }

      }

    }

    if (artifactsToUpload.length > 0) {
      console.info('Need to upload', bold(String(artifactsToUpload.length)), 'artifacts')
      const uploaded = await super.uploadMany(artifactsToUpload)
      for (const i in uploaded) {
        if (!uploaded[i]) continue // skip empty ones, preserving index
        const receiptName = this.getUploadReceiptName(artifactsToUpload[i])
        const receiptFile = $(this.cache, receiptName).as(JSONFile)
        receiptFile.save(uploaded[i])
        templates[i] = uploaded[i]
      }
    } else {
      console.info('No artifacts need to be uploaded.')
    }

    return templates

  }

  /** Warns if a code hash is missing in the Artifact,
    * and mutates the Artifact to set the code hash. */
  protected ensureCodeHash (artifact: Artifact) {
    if (!artifact.codeHash) {
      console.warn(
        'No code hash in artifact',
        bold($(artifact.url).shortPath)
      )
      console.warn(
        'Computed checksum:',
        bold(artifact.codeHash = codeHashForPath($(artifact.url).path))
      )
    }
  }

}
