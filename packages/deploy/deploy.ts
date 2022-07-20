/**

  Fadroma Ops and Fadroma Mocknet
  Copyright (C) 2022 Hack.bg

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.

**/

import { basename, resolve, dirname, relative, extname } from 'path'

import { readFileSync, writeFileSync, readdirSync, readlinkSync, lstatSync, existsSync,
         symlinkSync } from 'fs'

import { toHex, Sha256 } from '@hackbg/formati'
import { Console, bold } from '@hackbg/konzola'
import $, { BinaryFile, JSONDirectory, JSONFile, YAMLFile } from '@hackbg/kabinet'

import {
  Address,
  Agent,
  AgentOpts,
  Artifact,
  Bundle,
  Chain,
  ChainMode,
  Client,
  ClientCtor,
  ClientOpts,
  DevnetHandle,
  Instance,
  Label,
  Message,
  Template,
} from '@fadroma/client'

import TOML from 'toml'
import YAML from 'js-yaml'
import alignYAML from 'align-yaml'
import { cwd } from 'process'
import { freePort, waitPort } from '@hackbg/portali'
import * as http from 'http'

export { TOML, YAML }

export const console          = Console('Fadroma Deploy')

export const HEAD             = 'HEAD'

export const addPrefix        = (prefix, name) => `${prefix}/${name}`

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
    const data = $(artifact.url).as(BinaryFile).load()
    const template = await this.agent.upload(data)
    await this.agent.nextBlock
    return template
  }
  /** Upload multiple Artifacts from the filesystem.
    * TODO: Optionally bundle them (where is max size defined?) */
  async uploadMany (artifacts: Artifact[]): Promise<Template[]> {
    //console.log('uploadMany', artifacts)
    const templates = []
    for (const i in artifacts) {
      // support "holes" in artifact array
      // (used by caching subclass)
      const artifact = artifacts[i]
      let template
      if (artifact) {
        const path = $(artifact.url)
        const data = path.as(BinaryFile).load()
        //console.info('Uploading', bold(path.shortPath), `(${data.length} bytes uncompressed)`)
        template = await this.agent.upload(data)
        //console.info('Uploaded:', bold(path.shortPath))
        //console.debug(template)
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
        `   Expected ${artifact.codeHash} (from ${$(artifact.url).shortPath})\n`+
        `   Got      ${template.codeHash} (from codeId#${template.codeId})`
      )
    }
  }
}

export class UploadReceipt extends JSONFile<{ chainId, codeId, codeHash, uploadTx, artifact? }> {
  toTemplate (): Template {
    const { chainId, codeId, codeHash, uploadTx, artifact } = this.load()
    return new Template(
      chainId,
      codeId,
      codeHash,
      uploadTx,
      artifact
    )
  }
}

/** Uploads contracts from the file system,
  * but only if a receipt does not exist in the chain's uploads directory. */
export class CachingFSUploader extends FSUploader {
  static fromConfig (agent, projectRoot) {
    return new CachingFSUploader(
      agent,
      $(projectRoot).in('receipts').in(agent.chain.id).in('uploads').as(Uploads)
    )
  }
  constructor (readonly agent: Agent, readonly cache: Uploads) {
    super(agent)
  }
  protected getUploadReceiptPath (artifact: Artifact): string {
    const receiptName = `${this.getUploadReceiptName(artifact)}`
    const receiptPath = this.cache.resolve(receiptName)
    return receiptPath
  }
  protected getUploadReceiptName (artifact: Artifact): string {
    return `${$(artifact.url).name}.json`
  }
  /** Upload an artifact from the filesystem if an upload receipt for it is not present. */
  async upload (artifact: Artifact): Promise<Template> {
    const name    = this.getUploadReceiptName(artifact)
    const receipt = this.cache.at(name).as(UploadReceipt)
    if (receipt.exists()) {
      return receipt.toTemplate()
    }
    const data = $(artifact.url).as(BinaryFile).load()
    //console.info(
      //`Uploading:`, bold($(artifact.url).shortPath),
      //'with code hash', bold(artifact.codeHash),
      //'uncompressed', bold(String(data.length)), 'bytes'
    //)
    const template = await this.agent.upload(data)
    //console.info(`Storing:  `, bold($(receipt.path).shortPath))
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
        artifactsToUpload[i] = artifact
      } else {
        const receiptFile     = $(receiptPath).as(JSONFile) as JSONFile<UploadReceipt>
        const receiptData     = receiptFile.load()
        const receiptCodeHash = receiptData.codeHash || receiptData.originalChecksum
        if (!receiptCodeHash) {
          //console.info(bold(`No code hash:`), `${relativePath}; reuploading...`)
          artifactsToUpload[i] = artifact
          continue
        }
        if (receiptCodeHash !== artifact.codeHash) {
          console.warn(
            bold(`Different code hash:`), `${relativePath}; reuploading...`
          )
          artifactsToUpload[i] = artifact
          continue
        }
        //console.info('✅', 'Exists, not reuploading (same code hash):', bold(relativePath))
        templates[i] = new Template(
          this.chain.id,
          String(receiptData.codeId),
          artifact.codeHash,
          receiptData.transactionHash as string,
          artifact
        )
      }
    }
    if (artifactsToUpload.length > 0) {
      const uploaded = await super.uploadMany(artifactsToUpload)
      for (const i in uploaded) {
        if (!uploaded[i]) continue // skip empty ones, preserving index
        const receiptName = this.getUploadReceiptName(artifactsToUpload[i])
        const receiptFile = $(this.cache, receiptName).as(JSONFile)
        receiptFile.save(uploaded[i])
        templates[i] = uploaded[i]
      }
    } else {
      //console.info('No artifacts need to be uploaded.')
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
      try {
        const codeHash = codeHashForPath($(artifact.url).path)
        Object.assign(artifact, { codeHash })
        console.warn(
          'Computed code hash:',
          bold(artifact.codeHash)
        )
      } catch (e) {
        console.warn('Could not compute code hash:', e.message)
      }
    }
  }
}

const codeHashForBlob = (blob: Uint8Array) => toHex(new Sha256(blob).digest())
const codeHashForPath = (location: string) => codeHashForBlob(readFileSync(location))

/** Deployments for a chain, represented by a directory with 1 YAML file per deployment. */
export class Deployments extends JSONDirectory<unknown> {
  static fromConfig (chain, projectRoot) {
    return $(projectRoot).in('receipts').in(chain.id).in('deployments').as(Deployments)
  }
  KEY = '.active'
  async create (deployment: string) {
    const path = this.at(`${deployment}.yml`)
    if (path.exists()) {
      throw new Error(`${deployment} already exists`)
    }
    return path.makeParent().as(YAMLFile).save(undefined)
    return new Deployment(path.path)
  }
  async select (deployment: string) {
    const selection = this.at(`${deployment}.yml`)
    if (!selection.exists) {
      throw new Error(`${deployment} does not exist`)
    }
    const active = this.at(`${this.KEY}.yml`).as(YAMLFile)
    try { active.delete() } catch (e) {}
    await symlinkSync(selection.path, active.path)
  }
  get active (): Deployment|null {
    return this.get(this.KEY)
  }
  get (id: string): Deployment|null {
    const path = resolve(this.path, `${id}.yml`)
    if (!existsSync(path)) {
      return null
    }
    let prefix: string
    return new Deployment(path)
  }
  list () {
    if (!existsSync(this.path)) {
      return []
    }
    return readdirSync(this.path)
      .filter(x=>x!=this.KEY)
      .filter(x=>x.endsWith('.yml'))
      .map(x=>basename(x,'.yml'))
  }
  save <D> (name: string, data: D) {
    const file = this.at(`${name}.json`).as(JSONFile) as JSONFile<D>
    //console.info('Deployments writing:', bold(file.shortPath))
    return file.save(data)
  }
}

export type DeployReceipt = Instance & { name: string }

/** An individual deployment, represented as a multi-document YAML file. */
export class Deployment {
  constructor (public readonly path: string) {
    this.load()
  }
  /** This is the name of the deployment.
    * It's used as a prefix to contract labels
    * (which need to be globally unique). */
  prefix: string
  /** These are the items contained by the Deployment.
    * They correspond to individual contract instances. */
  receipts: Record<string, DeployReceipt> = {}
  /** Load deployment state from YAML file. */
  load (path = this.path) {
    while (lstatSync(path).isSymbolicLink()) {
      path = resolve(dirname(path), readlinkSync(path))
    }
    this.prefix    = basename(path, extname(path))
    const data     = readFileSync(path, 'utf8')
    const receipts = YAML.loadAll(data) as DeployReceipt[]
    for (const receipt of receipts) {
      const [contractName, _version] = receipt.name.split('+')
      this.receipts[contractName] = receipt
    }
  }
  has (name: string): boolean {
    return !!this.receipts[name]
  }
  /** Get the receipt for a contract, containing its address, codeHash, etc. */
  get (name: string, suffix?: string): DeployReceipt {
    const receipt = this.receipts[name]
    if (!receipt) {
      const msg = `@fadroma/ops/Deploy: ${name}: no such contract in deployment`
      throw new Error(msg)
    }
    receipt.name = name
    return receipt
  }
  /** Chainable. Add to deployment, replacing existing receipts. */
  set (name: string, data: Partial<DeployReceipt> & any): this {
    this.receipts[name] = { name, ...data }
    return this.save()
  }
  /** Chainable. Add multiple to the deployment, replacing existing. */
  setMany (receipts: Record<string, any>) {
    for (const [name, receipt] of Object.entries(receipts)) {
      this.receipts[name] = receipt
    }
    return this.save()
  }
  /** Chainable. Add to deployment, merging into existing receipts. */
  add (name: string, data: any): this {
    return this.set(name, { ...this.receipts[name] || {}, ...data })
  }
  /** Chainable: Serialize deployment state to YAML file. */
  save (): this {
    let output = ''
    for (let [name, data] of Object.entries(this.receipts)) {
      output += '---\n'
      output += alignYAML(YAML.dump({ name, ...data }, { noRefs: true }))
    }
    writeFileSync(this.path, output)
    return this
  }
  /** Resolve a path relative to the deployment directory. */
  resolve (...fragments: Array<string>) {
    return resolve(this.path, ...fragments)
  }
  getClient <C extends Client, O extends ClientOpts> (
    agent:  Agent,
    Client: ClientCtor<C, O>,
    name:   string
  ): C {
    return new Client(agent, this.get(name) as O)
  }
  /** Instantiate one contract and save its receipt to the deployment. */
  async init (
    deployAgent: Agent,
    template:    Template,
    name:        Label,
    msg:         Message
  ): Promise<Instance> {
    const label = addPrefix(this.prefix, name)
    const instance = await deployAgent.instantiate(template, label, msg)
    this.set(name, instance)
    return instance
  }
  /** Instantiate multiple contracts from the same Template with different parameters. */
  async initMany (
    deployAgent: Agent,
    template:    Template,
    configs:     [Label, Message][] = []
  ): Promise<Instance[]> {
    // this adds just the template - prefix is added in initVarious
    return this.initVarious(deployAgent, configs.map(([name, msg])=>[template, name, msg]))
  }
  /** Instantiate multiple contracts from different Templates with different parameters. */
  async initVarious (
    deployAgent: Agent,
    configs:     [Template, Label, Message][] = []
  ): Promise<Instance[]> {
    // Validate
    for (const index in configs) {
      const config = configs[index]
      if (config.length !== 3) {
        throw Object.assign(
          new Error('initVarious: configs must be [Template, Name, Message] triples'),
          { index, config }
        )
      }
    }
    // Add prefixes
    const initConfigs = configs.map(([template, name, msg])=>
      [template, addPrefix(this.prefix, name), msg]) as [Template, Label, Message][]
    // Deploy
    const instances = await deployAgent.instantiateMany(initConfigs)
    // Store receipt
    for (const [label, receipt] of Object.entries(instances)) {
      const name = label.slice(this.prefix.length+1)
      this.set(name, { name, ...receipt })
    }
    return Object.values(instances)
  }
}
