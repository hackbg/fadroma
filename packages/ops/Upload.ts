import { cwd } from 'process'
import { relative, basename } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { fileURLToPath } from 'url'

import { Console, bold } from '@hackbg/konzola'
import { JSONDirectory } from '@hackbg/kabinet'

import type { Agent, Template, Artifact } from '@fadroma/client'

import { config } from './Config'
import { codeHashForPath } from './Build'
import { getUploads } from './State'

const console = Console('Fadroma Upload')

export abstract class Uploader {
  constructor (public agent: Agent) {}
  get chain () { return this.agent.chain }
  abstract upload     (artifact:  Artifact, ...args): Promise<Template>
  abstract uploadMany (artifacts: Artifact[]):        Promise<Template[]>
}

export interface UploadReceipt {
  codeId:             number
  compressedChecksum: string
  compressedSize:     string
  logs:               any[]
  originalChecksum:   string
  originalSize:       number
  transactionHash:    string
}

/** Directory collecting upload receipts. */
export class Uploads extends JSONDirectory {}

/** Uploads contracts from the local file system. */
export class FSUploader extends Uploader {

  /** Upload an Artifact from the filesystem, returning a Template. */
  async upload (artifact: Artifact): Promise<Template> {
    console.info(bold(`Uploading:`), relative(cwd(), fileURLToPath(artifact.url)))
    console.info(bold(`Code hash:`), artifact.codeHash)
    const template = await this.agent.upload(await readFile(fileURLToPath(artifact.url)))
    await this.agent.chain.nextBlock
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
        template = await this.agent.upload(await readFile(fileURLToPath(artifact.url)))
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
        `  Expected ${artifact.codeHash} (from ${fileURLToPath(artifact.url)})`+
        `  Got      ${template.codeHash} (from codeId#${template.codeId})`
      )
    }
  }

}

/** Uploads contracts from the file system,
  * but only if a receipt does not exist in the chain's uploads directory. */
export class CachingFSUploader extends FSUploader {

  constructor (
    readonly agent: Agent,
    readonly cache: Uploads = getUploads(agent.chain)
  ) {
    super(agent)
  }

  protected getUploadReceiptPath (artifact: Artifact): string {
    const receiptName = `${basename(fileURLToPath(artifact.url))}.json`
    const receiptPath = this.cache.resolve(receiptName)
    return receiptPath
  }

  /** Upload an artifact from the filesystem if an upload receipt for it is not present. */
  async upload (artifact: Artifact): Promise<Template> {
    const receiptPath = this.getUploadReceiptPath(artifact)
    if (existsSync(receiptPath)) {
      const receiptData = await readFile(receiptPath, 'utf8')
      return JSON.parse(receiptData)
    }
    const template = await super.upload(artifact)
    console.info(bold(`Storing:  `), relative(cwd(), receiptPath))
    await writeFile(receiptPath, JSON.stringify(template, null, 2), 'utf8')
    return template
  }

  async uploadMany (artifacts: Artifact[]): Promise<Template[]> {

    const templates = []
    const toUpload  = []

    for (const i in artifacts) {

      const artifact = artifacts[i]
      this.ensureCodeHash(artifact)

      const blobName     = basename(fileURLToPath(artifact.url))
      const receiptPath  = this.getUploadReceiptPath(artifact)
      const relativePath = relative(cwd(), receiptPath)

      if (!existsSync(receiptPath)) {

        console.info(bold(`Uploading:`), `${relative(cwd(), fileURLToPath(artifact.url))}`)
        toUpload[i] = artifact

      } else {

        const receiptData     = JSON.parse(readFileSync(receiptPath, 'utf8'))
        const receiptCodeHash = receiptData.codeHash || receiptData.originalChecksum

        if (!receiptCodeHash) {
          console.info(
            bold(`No code hash:`), `${relativePath}; reuploading...`
          )
          toUpload[i] = artifact
          continue
        }

        if (receiptCodeHash !== artifact.codeHash) {
          console.info(
            bold(`Different code hash:`), `${relativePath}; reuploading...`
          )
          toUpload[i] = artifact
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

    if (toUpload.length > 0) {
      console.info('Need to upload', bold(String(toUpload.length)), 'artifacts')
      const uploaded = await super.uploadMany(toUpload)
      for (const i in uploaded) {
        if (!uploaded[i]) continue // skip empty ones, preserving index
        const receiptName = `${basename(toUpload[i].location)}.json`
        const receiptPath = this.cache.make().resolve(receiptName)
        writeFileSync(receiptPath, JSON.stringify(uploaded[i], null, 2))
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
        bold('No code hash in artifact'),
        fileURLToPath(artifact.url)
      )
      console.warn(
        bold('Computed checksum:'),
        artifact.codeHash = codeHashForPath(fileURLToPath(artifact.url))
      )
    }
  }
}
