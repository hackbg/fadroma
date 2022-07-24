/*

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

import { Address, Agent, AgentOpts, Artifact, Bundle, Chain, ChainMode, Client, ClientCtor,
         ClientOpts, DevnetHandle, Instance, Label, Message, Template } from '@fadroma/client'
import { Source, IntoArtifact, getBuildContext } from '@fadroma/build'
import { ChainContext, knownChains, ChainLogger, AgentConfig, getAgentConfig, getChainContext,
         getAgentContext, AgentContext } from '@fadroma/connect'

import { toHex, Sha256 } from '@hackbg/formati'
import { Console, bold } from '@hackbg/konzola'
import { Commands, CommandContext, envConfig, Lazy,
         runOperation, Step, StepOrInfo } from '@hackbg/komandi'
import { freePort, waitPort } from '@hackbg/portali'
import $, { BinaryFile, JSONDirectory, JSONFile, YAMLFile } from '@hackbg/kabinet'

import { basename, resolve, dirname, relative, extname } from 'path'
import { readFileSync, writeFileSync, readdirSync, readlinkSync, lstatSync, existsSync,
         symlinkSync } from 'fs'
import {fileURLToPath} from 'url'

import TOML from 'toml'
import YAML from 'js-yaml'
import alignYAML from 'align-yaml'
import { cwd } from 'process'
import * as http from 'http'

const console = Console('Fadroma Deploy')

/** Getting builder settings from process runtime environment. */
export const getDeployConfig = envConfig(
  ({Str, Bool}, cwd, env): DeployConfig => ({
    ...getAgentConfig(cwd, env),
    reupload: Bool('FADROMA_REUPLOAD', ()=>false)
  }))

/** Deploy settings definitions. */
export interface DeployConfig extends AgentConfig {
  /** Whether to ignore upload receipts and upload contracts anew. */
  reupload?: boolean
}

/** Template or a type that can be uploaded. */
export type IntoTemplate = Template|TemplateSlot|Into<Template>|IntoArtifact

/** The thing T, or a function that returns the thing, synchronously or asynchronously. */
export type Into<T> = T|(()=>T)|(()=>Promise<T>)

export interface UploadContext extends AgentContext {
  config?:      DeployConfig
  /** Specify a template. Populate with its get/upload/getOrUpload methods. */
  template      (source: IntoTemplate):        TemplateSlot
  /** Get an object representing a template (code id + hash)
    * or upload the template from source if it's not already uploaded. */
  getOrUploadTemplate (source: IntoTemplate):  Promise<Template>
  /** Upload a template, cache receipt under `receipts/$CHAIN/uploads`. */
  upload:       (artifact:  IntoTemplate)   => Promise<Template>
  /** Upload multiple templates, cache receipts under `receipts/$CHAIN/uploads`. */
  uploadMany:   (artifacts: IntoTemplate[]) => Promise<Template[]>
  /** Knows how to upload contracts to a blockchain. */
  uploader:     Uploader
  /** Whether to skip reuploading of known uploaded contracts. */
  uploadCache?: boolean
  /** Which agent to use for uploading. */
  uploadAgent?: Agent
}

/** Add an uploader to the operation context. */
export function getUploadContext (context: AgentContext & Partial<UploadContext>): UploadContext {
  context.config      ??= getDeployConfig()
  context.uploadAgent ??= context.agent
  context.uploadCache ??= !context.config.reupload
  context.uploader    ??= (!context.isMocknet && context.uploadCache)
    ? CachingFSUploader.fromConfig(context.uploadAgent, context.config.project)
    : new FSUploader(context.uploadAgent)
  return {
    ...context,
    uploader: context.uploader,
    async upload (code: IntoTemplate): Promise<Template> {
      if (code instanceof Template) {
        return code
      }
      if (typeof code === 'string') {
        code = this.workspace.crate(code) as Source
        if (!this.build) throw new Error(`Upload ${code}: building is not enabled`)
        code = await this.build(code) as Artifact
      } else {
        const { url, codeHash, source } = code as Artifact
        code = new Artifact(url, codeHash, source)
      }
      const rel = bold($((code as Artifact).url).shortPath)
      console.info(`Upload ${bold(rel)}: hash`, bold(code.codeHash))
      code = await this.uploader.upload(code as Artifact) as Template
      console.info(`Upload ${bold(rel)}: id  `, bold(code.codeId),)
      return code
      throw Object.assign(
        new Error(`Fadroma: can't upload ${code}: must be crate name, Source, Artifact, or Template`),
        { code }
      )
    },
    async uploadMany (code: IntoTemplate[]): Promise<Template[]> {
      const templates = []
      for (const contract of code) {
        templates.push(await this.upload(contract))
      }
      return templates
    },
    template (code: IntoTemplate): TemplateSlot {
      return new TemplateSlot(this, code)
    },
    async getOrUploadTemplate (code: IntoTemplate): Promise<Template> {
      return await new TemplateSlot(this, code).getOrUpload()
    }
  }
}

/** Directory collecting upload receipts. */
export class Uploads extends JSONDirectory<UploadReceipt> {}

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

export abstract class Uploader {
  constructor (public agent: Agent) {}
  get chain () { return this.agent.chain }
  abstract upload     (artifact:  Artifact, ...args): Promise<Template>
  abstract uploadMany (artifacts: Artifact[]):        Promise<Template[]>
}

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

/** Uploads contracts from the file system,
  * but only if a receipt does not exist in the chain's uploads directory. */
export class CachingFSUploader extends FSUploader {
  static fromConfig (agent: Agent, projectRoot) {
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

export interface DeployContext extends UploadContext {
  /** Optional global suffix of all smart contracts deployed.
    * Useful for discerning multiple instanCan be usedces or versions of a contract. */
  suffix?:      string
  /** Currently selected collection of interlinked contracts. */
  deployment:   Deployment|null
  /** Who'll deploy new contracts */
  creator:     Agent
  /** Specify a contract instance. Populate with its get/deploy/getOrDeploy methods. */
  contract <C extends Client, O extends ClientOpts> (
    reference:  Name|Instance,
    APIClient?: ClientCtor<C, O>
  ): ContractSlot<C>
  /** Get a client interface to a contract. */
  /** Get a contract or fail with a user-defined message. */
  getContract <C extends Client> (
    reference:  Name|Instance,
    APIClient?: ClientCtor<C, any>,
    msgOrFn?:   StepOrInfo<any, C>,
  ): Promise<C>
  /** Get a contract or deploy it. */
  getOrDeployContract <C extends Client> (
    name:       Name,
    template:   IntoTemplate,
    initMsg:    Message,
    APIClient?: ClientCtor<C, any>
  ): Promise<C>
  /** Deploy a contract and fail if name already taken. */
  deployContract <C extends Client> (
    name:       Name,
    template:   IntoTemplate,
    initMsg:    Message,
    APIClient?: ClientCtor<C, any>
  ): Promise<C>
  /** Deploy multiple contracts from the same template. */
  deployMany <C extends Client, O extends ClientOpts> (
    template:   IntoTemplate,
    contracts:  [Name, Message][],
    APIClient?: ClientCtor<C, O>
  ): Promise<C[]>
  /** Deploy multiple different contracts. */
  deployVarious (
    contracts:  [IntoTemplate, Name, ClientCtor<Client, ClientOpts>]
  ): Promise<Client[]>
}

export const addPrefix = (prefix, name) => `${prefix}/${name}`
export type  Name      = string

export function getDeployContext (context: UploadContext & Partial<DeployContext>): DeployContext {
  context.creator ??= context.agent
  type Fn<T, U> = (...t: T[]) => U
  function needsActiveDeployment <T, U> (fn: Fn<T, U>): Fn<T, U> {
    if (!context.deployment) return () => { throw new Error('Fadroma Ops: no active deployment') }
    return fn
  }
  return {
    ...context,
    creator: context.creator,
    contract <C extends Client> (
      reference: string|{ address: string },
      APIClient: ClientCtor<C, any>
    ): ContractSlot<C> {
      return new ContractSlot(this, reference, APIClient)
    },
    async getContract <C extends Client> (
      reference: string|{ address: string },
      APIClient: ClientCtor<C, any> = Client as ClientCtor<C, any>,
      msgOrFn?:  StepOrInfo<any, C>
    ): Promise<C> {
      return await new ContractSlot(this, reference, APIClient).get(msgOrFn) as C
    },
    async getOrDeployContract <C extends Client> (
      name:      string,
      template:  IntoTemplate,
      initMsg:   Message,
      APIClient: ClientCtor<C, any> = Client as ClientCtor<C, any>,
    ): Promise<C> {
      return await new ContractSlot(this, name, APIClient).getOrDeploy(template, initMsg)
    },
    async deployContract <C extends Client> (
      name:      string,
      template:  IntoTemplate,
      initMsg:   Message,
      APIClient: ClientCtor<C, any> = Client as ClientCtor<C, any>,
    ): Promise<C> {
      return await new ContractSlot(this, name, APIClient).deploy(template, initMsg)
    },
    async deployMany <C extends Client> (
      template:  IntoTemplate,
      contracts: [string, Message][],
      APIClient: ClientCtor<C, any> = Client as ClientCtor<C, any>
    ) {
      template = await this.upload(template) as Template
      try {
        return await this.deployment.initMany(this.creator, template, contracts)
      } catch (e) {
        console.error(`Deploy of multiple contracts failed: ${e.message}`)
        console.error(`Deploy of multiple contracts failed: Configs were:`)
        console.log(JSON.stringify(contracts, null, 2))
        throw e
      }
    },
    async deployVarious () {
      throw 'TODO'
    }
  }

}

export class DeployTask<X> extends Lazy<X> {
  constructor (public readonly context: DeployContext, getResult: ()=>X) {
    super(getResult)
  }
  gitRef: string = 'HEAD'
  get chain      () { return this.context.chain }
  get deployment () { return this.context.deployment }
  get creator    () { return this.context.creator }
  instance = (name: string): Instance|null => {
    return this.deployment?.has(name) ? this.deployment.get(name) : null
  }
  template = (t: IntoTemplate): TemplateSlot => {
    if (t instanceof Function) {
      return new TemplateSlot(this, t)
    }
    if (typeof t === 'string') {
      if (t.indexOf('@')===-1 && this.gitRef) {
        t = `${name}@${this.gitRef}`
      }
      return new TemplateSlot(this.context, t as string)
    }
    if (t instanceof TemplateSlot && t.context === this.context) {
      return t
    }
    console.warn(t)
    throw new Error(`template: unknown argument ${t}`)
  }
  contract = <C extends Client> (
    name:    string,
    _Client: ClientCtor<C, ClientOpts> = Client as ClientCtor<C, ClientOpts>
  ): ContractSlot<C> => {
    return new ContractSlot(this.context, name, _Client)
  }
  deploy = async <C extends Client> (
    name: string,
    code: IntoTemplate,
    init: Message,
    Client?: ClientCtor<C, ClientOpts>
  ): Promise<C> => {
    code = await this.template(code)
    if (code instanceof Function) code = await Promise.resolve(code()) as Template
    const instance = await this.deployment.init(this.creator, code, name, init)
    const client   = new Client(this.creator, instance)
    return client as C
  }
  deployMany = async <C extends Client> (
    template: IntoTemplate,
    configs:  [string, Message][],
    Client?:  ClientCtor<C, ClientOpts>
  ): Promise<C[]> => {
    return (await this.deployment.initMany(
      this.creator,
      await this.template(template).getOrUpload(),
      configs
    )).map(instance=>this.creator.getClient(Client, instance))
  }
}

export abstract class Slot<X, C> extends Lazy<X> {
  constructor (
    public readonly context: C,
  ) {
    super(async ()=>await Promise.resolve(this.get()))
  }
  value: X|null = null
  get (): X {
    if (!this.value) throw new Error('Missing slot value')
    return this.value
  }
  expect (msg: string|Error, orElse?: ()=>Promise<X>): Promise<X> {
    if (this.value) return Promise.resolve(this.value)
    if (orElse) { console.info(msg); return orElse() }
    if (typeof msg === 'string') msg = new Error(msg)
    throw msg
  }
}

export class TemplateSlot extends Slot<Template, , IntoTemplate> {
  constructor (
    public readonly context:   UploadContext,
    public readonly reference: IntoTemplate
  ) {
    super(context, async ()=>await Promise.resolve(this.get()))
  }
  /** If the contract was found in the deployment, return it.
    * Otherwise, deploy it under the specified name. */
  async getOrUpload (): Promise<Template> {
    if (this.value) return this.value
    return await this.upload()
  }
  async upload () {
    return await this.context.upload(this.code)
  }
}

/** Object returned by context.contract() helper.
  * `getOrDeploy` method enables resumable deployments. */
export class ContractSlot<C extends Client> extends Slot<C, DeployContext,> {
  constructor (
    public readonly context:   Partial<DeployContext>,
    public readonly reference: string|{ address: Address },
    /** By default, contracts are returned as the base Client class.
      * Caller can pass a specific API class constructor as 2nd arg. */
    public readonly APIClient: ClientCtor<C, any> = Client as ClientCtor<C, any>
  ) {
    super()
    if (typeof reference === 'string') {
      // When arg is string, look for contract by name in deployment
      if (this.context.deployment.has(reference)) {
        console.info('Found contract:', bold(reference))
        this.value = this.context.creator.getClient(
          this.APIClient,
          this.context.deployment.get(reference)
        )
      }
    } else if (reference.address) {
      // When arg has `address` property, just get client by address.
      this.value = this.context.creator.getClient(APIClient, reference)
    }
  }
  /** Get the specified contract. If it's not in the deployment,
    * try fetching it from a subroutine or throw an error with a custom message. */
  async get (msgOrFn: StepOrInfo<any, C> = ''): Promise<C> {
    if (this.value) return this.value
    if (msgOrFn instanceof Function) {
      console.info('Finding contract:', bold(this.reference as string))
      this.value = await Promise.resolve(msgOrFn(this.context))
      if (this.value) return this.value
      throw new Error(`No such contract: ${this.reference}.`)
    } else {
      msgOrFn = `No such contract: ${this.reference}. ${msgOrFn||''}`
      throw new Error(msgOrFn)
    }
  }
  /** If the contract was found in the deployment, return it.
    * Otherwise, deploy it under the specified name. */
  async getOrDeploy (code: IntoTemplate, init: Message): Promise<C> {
    if (this.value) return this.value
    return await this.deploy(code, init)
  }
  /** Always deploy the specified contract. If a contract with the same name
    * already exists in the deployment, it will fail - use suffixes */
  async deploy (code: IntoTemplate, init: Message): Promise<C> {
    const name     = this.reference as string
    const template = await this.context.upload(code)
    console.info(`Deploy ${bold(name)}:`, 'from code id:', bold(template.codeId))
    try {
      const instance = await this.context.deployment.init(this.context.creator, template, name, init)
      return this.context.creator.getClient(this.APIClient, instance) as C
    } catch (e) {
      console.error(`Deploy ${bold(name)}: Failed: ${e.message}`)
      console.error(`Deploy ${bold(name)}: Failed: Init message was:`)
      console.log(JSON.stringify(init, null, 2))
      throw e
    }
  }
}
class ContractSlot2<C extends Client> extends Slot<C> {

  constructor (
    public readonly context: DeployTask<unknown>,
    public readonly name:    string,
    public readonly Client:  ClientCtor<C, ClientOpts> = Client as ClientCtor<C, ClientOpts>
  ) { super() }

  get (): C|null {
    const instance = this.context.instance(this.name)
    if (instance) {
      return new this.Client(this.context.creator, instance)
    } else {
      return null
    }
  }

  async getOrDeploy (
    template: IntoTemplate,
    init:     Message
  ): Promise<C> {
    return this.get() || await this.deploy(template, init)
  }

  async deploy (
    template: IntoTemplate,
    init:     Message
  ): Promise<C> {
    const instance = this.context.instance(this.name)
    if (instance) {
      console.error(`Name ${this.name} already corresponds to:`)
      console.trace(instance)
      throw new Error(`Already exists: ${this.name}`)
    }
    return this.context.deploy(this.name, template, init, this.Client)
  }

}

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
    contracts:   [Label, Message][] = []
  ): Promise<Instance[]> {
    // this adds just the template - prefix is added in initVarious
    return this.initVarious(deployAgent, contracts.map(([name, msg])=>[template, name, msg]))
  }
  /** Instantiate multiple contracts from different Templates with different parameters. */
  async initVarious (
    deployAgent: Agent,
    contracts:     [Template, Label, Message][] = []
  ): Promise<Instance[]> {
    // Validate
    for (const index in contracts) {
      const triple = contracts[index]
      if (triple.length !== 3) {
        throw Object.assign(
          new Error('initVarious: contracts must be [Template, Name, Message] triples'),
          { index, contract: triple }
        )
      }
    }
    // Add prefixes
    const initConfigs = contracts.map(([template, name, msg])=>
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

const expectDeployments = (context: { deployments: Deployments|null }): Deployments => {
  if (!(context.deployments instanceof Deployments)) {
    //console.error('context.deployments was not populated')
    //console.log(context)
    throw new Error('Deployments were not enabled')
  }
  return context.deployments
}

export class DeployCommands <C extends AgentContext> extends Commands <C> {

  constructor (name: string = 'deploy', before = [], after = []) {
    super(name, [
      getBuildContext,
      getChainContext,
      ChainLogger(console).ChainStatus,
      getAgentContext,
      ...before
    ], after)
    this.command('list',    'print a list of all deployments', DeployCommands.list)
    this.command('select',  'select a new active deployment',  DeployCommands.select)
    this.command('new',     'create a new empty deployment',   DeployCommands.create)
    this.command('status',  'show the current deployment',     DeployCommands.status)
    this.command('nothing', 'check that the script runs', () => console.log('So far so good'))
  }

  /** Add the currently active deployment to the command context. */
  static get = async function getDeployment (
    context: AgentContext & Partial<DeployContext>
  ): Promise<DeployContext> {
    const deployments = expectDeployments(context)
    if (!deployments.active) {
      console.info('No selected deployment on chain:', bold(context.chain.id))
    }
    context.deployment = deployments.active
    return getDeployContext(getUploadContext(context))
  }

  /** Create a new deployment and add it to the command context. */
  static create = async function createDeployment (
    context: AgentContext & Partial<DeployContext>
  ): Promise<DeployContext> {
    const deployments = expectDeployments(context)
    const [ prefix = context.timestamp ] = context.cmdArgs
    await deployments?.create(prefix)
    await deployments?.select(prefix)
    return await DeployCommands.get(context)
  }

  /** Add either the active deployment, or a newly created one, to the command context. */
  static getOrCreate = async function getOrCreateDeployment (
    context: AgentContext & Partial<DeployContext>
  ): Promise<DeployContext> {
    const deployments = expectDeployments(context)
    if (deployments?.active) {
      return DeployCommands.get(context)
    } else {
      return await DeployCommands.create(context)
    }
  }

  static list = async function listDeployments (context: ChainContext): Promise<void> {
    const deployments = expectDeployments(context)
    const { chain } = context
    const list = deployments.list()
    if (list.length > 0) {
      console.info(`Deployments on chain ${bold(chain.id)}:`)
      for (let deployment of list) {
        if (deployment === deployments.KEY) continue
        const count = Object.keys(deployments.get(deployment)!.receipts).length
        if (deployments.active && deployments.active.prefix === deployment) {
          deployment = `${bold(deployment)} (selected)`
        }
        deployment = `${deployment} (${count} contracts)`
        console.info(` `, deployment)
      }
    } else {
      console.info(`No deployments on chain`, bold(chain.id))
    }
  }

  static select = async function selectDeployment (
    context: ChainContext
  ): Promise<void> {
    const deployments = expectDeployments(context)
    const { cmdArgs: [id] = [undefined] } = context
    const list = deployments.list()
    if (list.length < 1) {
      console.info('\nNo deployments. Create one with `deploy new`')
    }
    if (id) {
      console.info(bold(`Selecting deployment:`), id)
      await deployments.select(id)
    }
    if (list.length > 0) {
      DeployCommands.list(context)
    }
    if (deployments.active) {
      console.info(`Currently selected deployment:`, bold(deployments.active.prefix))
    } else {
      console.info(`No selected deployment.`)
    }
  }

  /** Print the status of a deployment. */
  static status = async function showDeployment (
    context: ChainContext,
    id = context.cmdArgs[0]
  ): Promise<void> {
    const deployments = expectDeployments(context)
    const deployment  = id ? deployments.get(id) : deployments.active
    if (deployment) {
      DeployLogger(console).showDeployment({ deployment })
    } else {
      console.info('No selected deployment on chain:', bold(context.chain.id))
    }
  }

  /** For iterating on would-be irreversible mutations. */
  iteration (name: string, info: string, ...steps: Step<DeployContext, unknown>[]) {
    return this.command(name, info, deploymentIteration, ...steps)
    function deploymentIteration (context) {
      if (context.devMode) {
        return DeployCommands.create(context)
      } else {
        return context
      }
    }
  }

}

export const DeployLogger = ({ info, warn }: Console) => ({

  Deployment ({ deployment }: DeployContext) {
    if (deployment) {
      const { receipts, prefix } = deployment
      let contracts: string|number = Object.values(receipts).length
      contracts = contracts === 0 ? `(empty)` : `(${contracts} contracts)`
      console.info('Active deployment:', bold(prefix), bold(contracts))
      const count = Object.values(receipts).length
      if (count > 0) {
        for (const name of Object.keys(receipts).sort()) {
          this.Receipt(name, receipts[name])
        }
      } else {
        info('This deployment is empty.')
      }
    } else {
      info('There is no selected deployment.')
    }
  },

  Receipt (name: string, receipt: any) {
    name = bold(name.padEnd(35))
    if (receipt.address) {
      const address = `${receipt.address}`.padStart(45)
      const codeId  = String(receipt.codeId||'n/a').padStart(6)
      info(address, codeId, name)
    } else {
      warn('(non-standard receipt)'.padStart(45), 'n/a'.padEnd(6), name)
    }
  }

})

//@ts-ignore
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  runOperation('deploy status', 'show deployment status', [
    getAgentContext,  ChainLogger(console).ChainStatus,
    getDeployContext, DeployLogger(console).Deployment
  ], process.argv.slice(2))
}
