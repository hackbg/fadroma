#!/usr/bin/env node

/*
  Fadroma Deployment and Operations System
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

import {
  Chain, ChainMode, Agent, AgentOpts, Bundle, Client, ClientCtor, ClientOpts, DevnetHandle,
  Artifact, Template, Instance, Label, Message, Address
} from '@fadroma/client'
import {
  Workspace, Source, IntoArtifact,
  BuildContext, getBuildContext,
  BuilderConfig, getBuilderConfig,
  Builder,
} from '@fadroma/build'
import {
  knownChains,
  ConnectLogger,
  ChainContext, getChainContext,
  AgentConfig, getAgentConfig, ChainConfig,
  AgentContext, getAgentContext
} from '@fadroma/connect'
import { toHex, Sha256 } from '@hackbg/formati'
import { Console, bold, timestamp } from '@hackbg/konzola'
import {
  Commands, CommandContext, envConfig, Lazy,
  runOperation, Step, StepOrInfo
} from '@hackbg/komandi'
import { freePort, waitPort } from '@hackbg/portali'
import $, {
  BinaryFile,
  JSONDirectory, JSONFile,
  YAMLDirectory, YAMLFile, alignYAML
} from '@hackbg/kabinet'
import { basename, resolve, dirname, relative, extname } from 'path'
import {
  readFileSync, writeFileSync, readdirSync, lstatSync, existsSync,
  readlinkSync, symlinkSync
} from 'fs'
import {fileURLToPath} from 'url'
import YAML from 'js-yaml'
import { cwd } from 'process'
import * as http from 'http'
/// WHEN YOUR IMPORTS ARE MORE THAN A SCREENFUL, WORRY
const console = Console('Fadroma Deploy')
/// # ENVIRONMENT CONFIGURATION ///////////////////////////////////////////////////////////////////
/** TypeScript made me do it! */
type AgentBuilderConfig = (AgentConfig & BuilderConfig)
/** Deploy settings definitions. */
export interface DeployConfig extends AgentBuilderConfig {
  /** Whether to ignore upload receipts and upload contracts anew. */
  reupload?: boolean
  /** Whether to generate unsigned transactions for manual multisig signing. */
  multisig?: boolean
}
/** Get deploy settings from process runtime environment. */
export const getDeployConfig = envConfig(({Str, Bool}, cwd, env): DeployConfig => ({
  ...getBuilderConfig(cwd, env),
  ...getAgentConfig(cwd, env),
  reupload: Bool('FADROMA_REUPLOAD', ()=>false),
  multisig: Bool('FADROMA_MULTISIG', ()=>false)
}))
/// # DEPLOY COMMANDS /////////////////////////////////////////////////////////////////////////////
/** Command runner. Instantiate one in your script then use the
  * **.command(name, info, ...steps)**. Export it as default and
  * run the script with `npm exec fadroma my-script.ts` for a CLI. */
export class DeployCommands <C extends AgentAndBuildContext> extends Commands <C> {
  constructor (name: string = 'deploy', before = [], after = []) {
    // Deploy commands are like regular commands but
    // they already have a whole lot of deploy handles
    // pre-populated in the context.
    super(name, [
      getBuildContext,
      getChainContext,
      ConnectLogger(console).chainStatus,
      getAgentContext,
      //@ts-ignore
      getDeployContext,
      ...before
    ], after)
    this.command('list',    'print a list of all deployments', DeployCommands.list)
    this.command('select',  'select a new active deployment',  DeployCommands.select)
    //@ts-ignore
    this.command('new',     'create a new empty deployment',   DeployCommands.create)
    this.command('status',  'show the current deployment',     DeployCommands.status)
    this.command('nothing', 'check that the script runs', () => console.log('So far so good'))
  }
  parse (args: string[]) {
    let resume = false
    if (args.includes('--resume')) {
      console.warn('Experimental: Resuming last deployment')
      resume = true
      args = args.filter(x=>x!=='--resume')
    }
    const parsed = super.parse(args)
    if (!parsed) return null
    if (resume) {
      // replace create with get
      const toResume = (x: Step<any, any>): Step<any, any> =>
        (x === DeployCommands.create) ? DeployCommands.get : x
      parsed[1].steps = parsed[1].steps.map(toResume)
    }
    return parsed
  }
  /** Add the currently active deployment to the command context. */
  static get = async function getDeployment (
    context: AgentAndBuildContext & Partial<DeployContext>
  ): Promise<DeployContext> {
    const deployments = expectDeployments(context)
    if (!deployments.active) {
      console.info('No selected deployment on chain:', bold(context.chain.id))
    }
    context.deployment = deployments.active
    return getDeployContext(context)
  }
  /** Create a new deployment and add it to the command context. */
  static create = async function createDeployment (
    context: AgentAndBuildContext & Partial<DeployContext>
  ): Promise<DeployContext> {
    const deployments = expectDeployments(context)
    const [ prefix = context.timestamp ] = context.cmdArgs
    await deployments?.create(prefix)
    await deployments?.select(prefix)
    return await DeployCommands.get(context)
  }
  /** Add either the active deployment, or a newly created one, to the command context. */
  static getOrCreate = async function getOrCreateDeployment (
    context: AgentAndBuildContext & Partial<DeployContext>
  ): Promise<DeployContext> {
    const deployments = expectDeployments(context)
    if (deployments?.active) {
      return DeployCommands.get(context)
    } else {
      return await DeployCommands.create(context)
    }
  }
  /** Print a list of deployments on the selected chain. */
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
  /** Make a new deployment the active one. */
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
      DeployLogger(console).deployment({ deployment })
    } else {
      console.info('No selected deployment on chain:', bold(context.chain.id))
    }
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
/// # RUDIMENTS OF STRUCTURED LOGGING by Meshuggah (now playing) //////////////////////////////////
export const DeployLogger = ({ info, warn }: Console) => {
  return { deployment, receipt, deployFailed, deployManyFailed, deployFailedTemplate }
  function deployment ({ deployment }: { deployment: Deployment }) {
    if (deployment) {
      const { receipts, prefix } = deployment
      let contracts: string|number = Object.values(receipts).length
      contracts = contracts === 0 ? `(empty)` : `(${contracts} contracts)`
      const len = Math.min(40, Object.keys(receipts).reduce((x,r)=>Math.max(x,r.length),0))
      info('│ Active deployment:'.padEnd(len+2), bold($(deployment.path!).shortPath), contracts)
      const count = Object.values(receipts).length
      if (count > 0) {
        for (const name of Object.keys(receipts)) {
          receipt(name, receipts[name], len)
        }
      } else {
        info('│ This deployment is empty.')
      }
    } else {
      info('│ There is no selected deployment.')
    }
  }
  function receipt (name: string, receipt: any, len = 35) {
    name = bold(name.padEnd(len))
    if (receipt.address) {
      const address = `${receipt.address}`.padStart(45)
      const codeId  = String(receipt.codeId||'n/a').padStart(6)
      info('│', name, address, codeId)
    } else {
      warn('│ (non-standard receipt)'.padStart(45), 'n/a'.padEnd(6), name)
    }
  }
  function deployFailed (e: Error, template: Template, name: Label, msg: Message) {
    console.error()
    console.error(`  Deploy of ${bold(name)} failed:`)
    console.error(`    ${e.message}`)
    deployFailedTemplate(template)
    console.error()
    console.error(`  Init message: `)
    console.error(`    ${JSON.stringify(msg)}`)
    console.error()
  }
  function deployManyFailed (e: Error, template: Template, contracts: DeployArgs[]) {
    console.error()
    console.error(`  Deploy of multiple contracts failed:`)
    console.error(`    ${e.message}`)
    deployFailedTemplate(template)
    console.error()
    console.error(`  Configs: `)
    for (const [name, init] of contracts) {
      console.error(`    ${bold(name)}: `, JSON.stringify(init))
    }
    console.error()
  }
  function deployFailedTemplate (template?: Template) {
    console.error()
    if (template) {
      console.error(`  Template:   `)
      console.error(`    Chain ID: `, bold(template.chainId ||''))
      console.error(`    Code ID:  `, bold(template.codeId  ||''))
      console.error(`    Code hash:`, bold(template.codeHash||''))
    } else {
      console.error(`  No template was providede.`)
    }
  }
}
/// # DEPLOY CONTEXT ///////////////////////////////////////////////////////////////////////////////
/** TypeScript made me do it! */
type AgentAndBuildContext = AgentContext & BuildContext
/** The full list of deployment procedures that open up
  * once you're authenticated and can compile code locally */
export interface DeployContext extends AgentAndBuildContext {
  /** All the environment config so far. */
  config:     ChainConfig & AgentConfig & BuilderConfig & DeployConfig
  /** Currently selected deployment. */
  deployment: Deployment|null
  /** Knows how to upload contracts to a blockchain. */
  uploader:   Uploader
  /** Specify a template. */
  template    (source: IntoTemplateSlot):    TemplateSlot
  /** Specify multiple templates. */
  templates   (sources: IntoTemplateSlot[]): MultiTemplateSlot
  /** Agent that will instantiate the templates. */
  creator:    Agent
  /** Specify a contract. */
  contract <C extends Client, O extends ClientOpts> (
    reference: Name|Instance, APIClient?: ClientCtor<C, O>
  ): ContractSlot<C>
  /** Specify multiple contracts of the same kind. */
  contracts <C extends Client, O extends ClientOpts> (
    APIClient?: ClientCtor<C, O>
  ): MultiContractSlot<C>
}
/** Taking merged Agent and Build context as a basis, populate deploy context. */
export function getDeployContext (
  context: AgentAndBuildContext & Partial<DeployContext>,
  agent:   Agent = context.agent
): DeployContext {
  // Make sure we're operating in a deployment
  context.deployment ??= context.deployments?.active
  if (!context.deployment) {
    console.warn('No active deployment. Most commands will fail.')
    console.warn('You can create a deployment using `fadroma-deploy new`')
    console.warn('or select a deployment using `fadroma-deploy select`')
    console.warn('among the ones listed by `fadroma-deploy list`')
  }
  // Make sure we have an operating identitiy
  context.creator ??= agent
  if (!context.creator) {
    throw new Error('No deploy agent. Authenticate by exporting FADROMA_MNEMONIC in your shell.')
  }
  // Get configuration
  const config = getDeployConfig()
  // Setup code uploader
  const uploader = (!context.isMocknet && !config.reupload)
      ? CachingFSUploader.fromConfig(agent, config.project)
      : new FSUploader(agent)
  // Hooks for template upload
  const template = (arg: IntoTemplateSlot): TemplateSlot =>
    new TemplateSlot(arg, context as DeployContext)
  const templates = (arg: IntoTemplateSlot[]): MultiTemplateSlot =>
    new MultiTemplateSlot(arg, context as DeployContext)
  // Hook for contract instantiation and retrieval
  const contract = <C extends Client> (
    arg: Name|Instance, _Client: ClientCtor<C, ClientOpts> = Client as ClientCtor<C, ClientOpts>
  ): ContractSlot<C> =>
    new ContractSlot(arg, _Client, context as DeployContext) as ContractSlot<C>
  const contracts = <C extends Client> (
    _Client: ClientCtor<C, ClientOpts> = Client as ClientCtor<C, ClientOpts>
  ): MultiContractSlot<C> =>
    new MultiContractSlot(_Client, context as DeployContext) as MultiContractSlot<C>
  context = {
    ...context,
    config,
    uploader,
    template, templates,
    deployment: context.deployment!, creator: agent,
    contract, contracts
  }
  return context as DeployContext
}
/** Base class for class-based deploy procedure. Adds progress logging. */
export class DeployTask<X> extends Lazy<X> {
  log = Console(this.constructor.name)
  constructor (public readonly context: DeployContext, getResult: ()=>X) {
    let self: this
    super(()=>{
      this.log.info()
      this.log.info('Task     ', this.constructor.name ? bold(this.constructor.name) : '')
      return getResult.bind(self)()
    })
    self = this
  }
  subtask <X> (cb: ()=>X|Promise<X>): Promise<X> {
    const self = this
    return new Lazy(()=>{
      this.log.info()
      this.log.info('Subtask  ', cb.name ? bold(cb.name) : '')
      return cb.bind(self)()
    })
  }
}
/// # UPLOADING ///////////////////////////////////////////////////////////////////////////////////
export type IntoTemplateSlot = string|Source|Artifact|Template|TemplateSlot
export class TemplateSlot extends Template {
  constructor (value: IntoTemplateSlot, context: DeployContext) {
    if (value instanceof Template) {
      super(value.artifact, value.codeHash, value.chainId, value.codeId, value.uploadTx)
    } else if (value instanceof Artifact) {
      if (!context.uploader) throw TemplateSlot.E01()
      super(value, context.uploader?.agent?.chain?.id)
    } else if (value instanceof Source) {
      if (!context.builder || !context.uploader) throw TemplateSlot.E02()
      super(new Artifact(value), context.uploader?.agent?.chain?.id)
    } else if (typeof value === 'string') {
      if (!context.workspace || !context.builder || !context.uploader) throw TemplateSlot.E03()
      let workspace = context.workspace
      const [crate, ref] = value.split('@')
      if (ref) workspace = workspace.at(ref)
      super(new Artifact(new Source(workspace, crate)), undefined, context.uploader?.agent?.chain?.id)
    } else {
      super(undefined, undefined, context.uploader?.agent?.chain?.id)
      throw TemplateSlot.E04(value)
    }
    this.context ??= context
  }
  readonly context: DeployContext
  /** Depending on what pre-Template type we start from, this function
    * invokes builder and uploader to produce a Template from it. */
  async getOrUpload (): Promise<Template> {
    // Repopulate
    this.chainId ??= this.context.uploader?.agent?.chain?.id
    if (!this.chainId) throw TemplateSlot.E05()
    if (this.codeId && this.codeHash) return this
    if (this.codeId) {
      this.codeHash ??= await this.context.uploader?.agent?.getHash(Number(this.codeId))
      if (this.codeHash) { return this } else throw TemplateSlot.E06()
    } else {
      if (!this.artifact) throw TemplateSlot.E07()
      if (!this.context.uploader) throw TemplateSlot.E01()
      const upload = async () => {
        const template = await this.artifact!.upload(this.context.uploader!)
        this.codeId = template.codeId
        if (this.codeHash && this.codeHash !== template.codeHash) TemplateSlot.W01(this, template)
        this.codeHash = template.codeHash
        return this
      }
      if (this.artifact.url) {
        return await upload()
      } else if (this.artifact.source) {
        if (!this.context.builder) throw TemplateSlot.E09()
        this.artifact = await this.artifact.build(this.context.builder)
        if (!this.artifact.url) throw TemplateSlot.E10()
        return await upload()
      }
      throw TemplateSlot.E08()
    }
  }
  declare codeId;
  declare chainId;
  declare codeHash;
  declare artifact;
  static E01 = () => new Error("Can't pass artifact into template slot with no uploader")
  static E02 = () => new Error("Can't pass artifact into template slot with no builder and uploader")
  static E03 = () => new Error("Can't pass string into template slot with no workspace, builder and uploader")
  static E04 = (value: any) => { return new Error(`TemplateSlot: unsupported value: ${value}`) } // sh fux
  static E05 = () => new Error("No chain ID specified")
  static E06 = () => new Error("Still no code hash")
  static E07 = () => new Error("No code id and no artifact to upload")
  static E08 = () => new Error("No artifact url and no source to build")
  static E09 = () => new Error("No builder")
  static E10 = () => new Error("Still no artifact url")
  static W01 = (a:any, b:any) => console.warn(`codeHash mismatch: ${a.codeHash} vs ${b.codeHash}`)
}
export class MultiTemplateSlot {
  constructor (
    slots: IntoTemplateSlot[] = [],
    public readonly context: DeployContext
  ) {
    this.slots = slots.map(value=>new TemplateSlot(value, context))
  }
  public readonly slots: TemplateSlot[]
  async getOrUploadMany (): Promise<Template[]> {
    const templates: Template[] = []
    for (const template of this.slots) {
      templates.push(await template.getOrUpload())
    }
    return templates
  }
}
/** Directory collecting upload receipts.
  * Upload receipts are JSON files of the format `$CRATE@$REF.wasm.json`
  * and are kept so that we don't reupload the same contracts. */
export class Uploads extends JSONDirectory<UploadReceipt> {}
/** Content of upload receipt. */
export interface IUploadReceipt {
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
  artifact?:          Artifact
}
/** Class that convert itself to a Template, from which contracts can be instantiated. */
export class UploadReceipt extends JSONFile<IUploadReceipt> {
  toTemplate (defaultChainId?: string): Template {
    let { chainId, codeId, codeHash, uploadTx, artifact } = this.load()
    chainId ??= defaultChainId
    codeId  = String(codeId)
    return new Template(artifact, codeHash, chainId, codeId, uploadTx)
  }
}
/// # UPLOADERS (THESE WORK, LEAVE EM ALONE) //////////////////////////////////////////////////////
export abstract class Uploader {
  constructor (public agent: Agent) {}
  get chain () { return this.agent.chain }
  abstract upload     (artifact:  Artifact):   Promise<Template>
  abstract uploadMany (artifacts: Artifact[]): Promise<Template[]>
}
/** Uploads contracts from the local file system. */
export class FSUploader extends Uploader {
  /** Upload an Artifact from the filesystem, returning a Template. */
  async upload (artifact: Artifact): Promise<Template> {
    console.info('Upload   ', bold($(artifact.url!).shortPath))
    const data     = $(artifact.url!).as(BinaryFile).load()
    const template = await this.agent.upload(data)
    await this.agent.nextBlock
    return template
  }
  /** Upload multiple Artifacts from the filesystem.
    * TODO: Optionally bundle them (where is max size defined?) */
  async uploadMany (artifacts: Artifact[]): Promise<Template[]> {
    //console.log('uploadMany', artifacts)
    const templates: Template[] = []
    for (const i in artifacts) {
      // support "holes" in artifact array
      // (used by caching subclass)
      const artifact = artifacts[i]
      let template
      if (artifact) {
        const path = $(artifact.url!)
        const data = path.as(BinaryFile).load()
        //console.info('Uploading', bold(path.shortPath), `(${data.length} bytes uncompressed)`)
        template = await this.agent.upload(data)
        //console.info('Uploaded:', bold(path.shortPath))
        //console.debug(template)
        this.checkCodeHash(artifact, template)
        templates[i] = template
      }
    }
    return templates
  }
  /** Print a warning if the code hash returned by the upload
    * doesn't match the one specified in the Artifact.
    * This means the Artifact is wrong, and may become
    * a hard error in the future. */
  private checkCodeHash (artifact: Artifact, template: Template) {
    if (template.codeHash !== artifact.codeHash) {
      console.warn(
        `Code hash mismatch from upload in TX ${template.uploadTx}:\n`+
        `   Expected ${artifact.codeHash} (from ${$(artifact.url!).shortPath})\n`+
        `   Got      ${template.codeHash} (from codeId#${template.codeId})`
      )
    }
  }
}
/** Uploads contracts from the file system,
  * but only if a receipt does not exist in the chain's uploads directory. */
export class CachingFSUploader extends FSUploader {
  static fromConfig (agent: Agent, projectRoot: string) {
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
    return `${$(artifact.url!).name}.json`
  }
  /** Upload an artifact from the filesystem if an upload receipt for it is not present. */
  async upload (artifact: Artifact): Promise<Template> {
    const name    = this.getUploadReceiptName(artifact)
    const receipt = this.cache.at(name).as(UploadReceipt)
    if (receipt.exists()) {
      console.info('Reuse    ', bold(this.cache.at(name).shortPath))
      return receipt.toTemplate()
    }
    const data = $(artifact.url!).as(BinaryFile).load()
    const template = await this.agent.upload(data)
    receipt.save(template)
    return template
  }
  async uploadMany (artifacts: Artifact[]): Promise<Template[]> {
    const templates:         Template[] = []
    const artifactsToUpload: Artifact[] = []
    for (const i in artifacts) {
      const artifact = artifacts[i]
      this.ensureCodeHash(artifact)
      const blobName     = $(artifact.url!).name
      const receiptPath  = this.getUploadReceiptPath(artifact)
      const relativePath = $(receiptPath).shortPath
      if (!$(receiptPath).exists()) {
        artifactsToUpload[i] = artifact
      } else {
        const receiptFile = $(receiptPath).as(JSONFile) as JSONFile<IUploadReceipt>
        const receiptData: IUploadReceipt = receiptFile.load()
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
          artifact,
          artifact.codeHash,
          this.chain.id,
          String(receiptData.codeId),
          receiptData.transactionHash as string,
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
  private ensureCodeHash (artifact: Artifact) {
    if (!artifact.codeHash) {
      console.warn(
        'No code hash in artifact',
        bold($(artifact.url!).shortPath)
      )
      try {
        const codeHash = codeHashForPath($(artifact.url!).path)
        Object.assign(artifact, { codeHash })
        console.warn('Computed code hash:', bold(artifact.codeHash!))
      } catch (e) {
        console.warn('Could not compute code hash:', e.message)
      }
    }
  }
}
/// # DEPLOYING ///////////////////////////////////////////////////////////////////////////////////
export type IntoContractSlot = Name|Partial<Instance>
export class ContractSlot<C extends Client> {
  static E00 = () =>
    new Error("Tried to create ContractSlot with nullish value")
  static E01 = (value: string) =>
    new Error("No deployment, can't find contract by name: "+value)
  static E02 = (prefix: string, value: string) =>
    new Error("Deployment "+prefix+" doesn't have "+value)
  static E03 = () =>
    new Error("Contract not found. Try .getOrDeploy(template, init)")
  static E04 = () =>
    new Error("Expected an identity to be selected.")
  static E05 = () =>
    new Error("Expected a deployment to be selected.")
  static E07 = () =>
    new Error("Value is not Client and not a name.")
  static E08 = () =>
    new Error("No name.")
  constructor (
    value:   IntoContractSlot,
    $Client: ClientCtor<C, any> = Client as ClientCtor<C, any>,
    context: DeployContext
  ) {
    if (!value) throw ContractSlot.E00
    if (typeof value === 'string') {
      this.name = value
      if (!context.deployment) throw ContractSlot.E01(value)
      if (context.deployment.has(value)) this.value = context.deployment.get(value)!
    } else {
      this.value = value
    }
    this.Client ??= $Client
    if (this.value && (this.value as { address: Address }).address) {
      this.value = new this.Client(context.creator, this.value)
    }
    this.context ??= context
  }
  name?:   string
  Client:  ClientCtor<C, any>
  context: DeployContext
  /** Info about the contract that we have so far. */
  value:   Partial<Instance> = {}
  /** Here the ContractSlot pretends to be a Promise. That way,
    * a fully populated Instance is available synchronously if possible,
    * and a ContractSlot can also be awaited to populate itself. */
  then <Y> (
    resolved: (c: C)=>Y,
    rejected: (e: Error)=>never
  ): Promise<Y> {
    if (!(this.value instanceof this.Client)) throw ContractSlot.E03()
    return Promise.resolve(this.value).then(resolved, rejected)
  }
  async deploy (template: Template|TemplateSlot|IntoTemplateSlot, msg: Message): Promise<C> {
    const { creator, deployment } = this.context
    if (!deployment) throw ContractSlot.E05()
    if (!this.name)  throw ContractSlot.E08()
    template = await new TemplateSlot(template, this.context).getOrUpload()
    console.info(
      'Deploy   ',    bold(this.name!),
      'from code id', bold(String(template.codeId  ||'(unknown)')),
      'hash',         bold(String(template.codeHash||'(unknown)'))
    )
    const instance = await this.context.deployment!.init(creator, template, this.name,  msg)
    const client = new this.Client(this.context.creator, instance)
    console.info(
      'Deployed ',    bold(this.name!), 'is', bold(client.address),
      'from code id', bold(String(template.codeId  ||'(unknown)'))
    )
    return this.value = client
  }
  async getOrDeploy (template: Template|TemplateSlot|IntoTemplateSlot, msg: Message): Promise<C> {
    if (this.value instanceof this.Client) {
      console.info('Found    ', bold(this.name||'(unnamed)'), 'at', bold(this.value.address))
      return this.value
    } else if (this.value && this.value.address) {
      this.value = new this.Client(this.context.creator, this.value)
      console.info('Found    ', bold(this.name||'(unnamed)'), 'at', bold((this.value as C).address))
      return this.value as C
    } else if (this.name) {
      if (!this.context.creator)    throw ContractSlot.E04()
      if (!this.context.deployment) throw ContractSlot.E05()
      return await this.deploy(template, msg)
    }
    throw ContractSlot.E07()
  }
  async getOr (getter: ()=>C|Promise<C>): Promise<C> {
    return await Promise.resolve(getter())
  }
  get (message: string = `Contract not found: ${this.name}`): C {
    if (this.name && this.context.deployment && this.context.deployment.has(this.name)) {
      const instance = this.context.deployment.get(this.name)
      const client   = new this.Client(this.context.creator, instance!)
      return client
    } else if (this.value) {
      const client = new this.Client(this.context.creator, this.value)
      return client
    } else {
      throw new Error(message)
    }
  }
}
/** Instantiates multiple contracts of the same type in one transaction.
  * For instantiating different types of contracts in 1 tx, see deployment.initVarious */
export class MultiContractSlot<C extends Client> {
  constructor (
    $Client: ClientCtor<C, any> = Client as ClientCtor<C, any>,
    public readonly context: DeployContext,
  ) {
    this.Client = $Client
  }
  public readonly Client: ClientCtor<C, any>
  async deployMany (
    template:  Template|TemplateSlot|IntoTemplateSlot,
    contracts: DeployArgs[] = []
  ): Promise<C[]> {
    if (!this.context.creator)    throw ContractSlot.E04()
    if (!this.context.deployment) throw ContractSlot.E05()
    // Provide the template
    template = await new TemplateSlot(template, this.context).getOrUpload() as Template
    // Deploy multiple contracts from the same template with 1 tx
    let instances: Instance[]
    try {
      const creator = this.context.creator
      instances = await this.context.deployment.initMany(creator, template, contracts)
    } catch (e) {
      DeployLogger(console).deployManyFailed(e, template, contracts)
      throw e
    }
    // Return API client to each contract
    return instances.map(instance=>this.context.creator!.getClient(this.Client, instance))
  }
}
export type DeployArgs       = [Name, Message]
export type DeployArgsTriple = [Template, Name, Message]
/// # DEPLOY RECEIPTS DIRECTORY ///////////////////////////////////////////////////////////////////
/** Directory containing deploy receipts, e.g. `receipts/$CHAIN/deployments`.
  * Each deployment is represented by 1 multi-document YAML file, where every
  * document is delimited by the `\n---\n` separator and represents a deployed
  * smart contract. */
export class Deployments extends YAMLDirectory<DeployReceipt[]> {
  /** Get a Path instance for `$projectRoot/receipts/$chainId/deployments`
    * and convert it to a Deployments instance. See: @hackbg/kabinet */
  static fromConfig = (chainId: string, projectRoot: string) =>
    $(projectRoot).in('receipts').in(chainId).in('deployments').as(Deployments)
  /** Name of symlink pointing to active deployment, without extension. */
  KEY = '.active'
  /** Create a deployment with a specific name. */
  async create (name: string = timestamp()) {
    const path = this.at(`${name}.yml`)
    if (path.exists()) {
      throw new Error(`${name} already exists`)
    }
    return path.makeParent().as(YAMLFile).save(undefined)
    return new Deployment(path.path)
  }
  /** Make the specified deployment be the active deployment. */
  async select (name: string) {
    const selection = this.at(`${name}.yml`)
    if (!selection.exists) {
      throw new Error(`Deployment ${name} does not exist`)
    }
    const active = this.at(`${this.KEY}.yml`).as(YAMLFile)
    try { active.delete() } catch (e) {}
    await symlinkSync(selection.path, active.path)
  }
  /** Get the contents of the active deployment, or null if there isn't one. */
  get active (): Deployment|null {
    return this.get(this.KEY)
  }
  /** Get the contents of the named deployment, or null if it doesn't exist. */
  get (name: string): Deployment|null {
    const path = resolve(this.path, `${name}.yml`)
    if (!existsSync(path)) {
      return null
    }
    return new Deployment(path)
  }
  /** List the deployments in the deployments directory. */
  list () {
    if (!existsSync(this.path)) {
      return []
    }
    return readdirSync(this.path)
      .filter(x=>x!=this.KEY)
      .filter(x=>x.endsWith('.yml'))
      .map(x=>basename(x,'.yml'))
  }
  /** DEPRECATED: Save some extra data into the deployments directory. */
  save <D> (name: string, data: D) {
    const file = this.at(`${name}.json`).as(JSONFile) as JSONFile<D>
    //console.info('Deployments writing:', bold(file.shortPath))
    return file.save(data)
  }
}
/** Each deploy receipt contains, as a minimum, name, address, and codeHash. */
export interface DeployReceipt extends Instance {
  name: string
}
/// # DEPLOYMENT / DEPLOYMENT RECEIPT /////////////////////////////////////////////////////////////
/** An individual deployment, represented as a multi-document YAML file.
  * Each entry in the file is a Receipt, representing a deployed contract.
  * You can deploy contracts with a Deployment using **deployment.init...**
  * and get Clients for interacting with existing contracts using **deployment.get...**. */
export class Deployment {
  /// ## BUSINESS END OF DEPLOYMENT ///////////////////////////////////////////////////////////////
  /** This is the unique identifier of the deployment.
    * It's used as a prefix to contract labels
    * (which need to be globally unique). */
  prefix: string = timestamp()
  /** These are the entries contained by the Deployment.
    * They correspond to individual contract instances. */
  receipts: Record<string, DeployReceipt> = {}
  /** Check if the deployment contains a certain entry. */
  has (name: string): boolean {
    return !!this.receipts[name]
  }
  /** Get the receipt for a contract, containing its address, codeHash, etc. */
  get (name: string): DeployReceipt|null {
    const receipt = this.receipts[name]
    if (!receipt) return null
    receipt.name = name
    return receipt
  }
  expect (
    name: string, message: string = `${name}: no such contract in deployment`
  ): DeployReceipt {
    const receipt = this.get(name)
    if (receipt) return receipt
    throw new Error(message)
  }
  /** Get a handle to the contract with the specified name. */
  getClient <C extends Client, O extends ClientOpts> (
    name: string, $Client: ClientCtor<C, O> = Client as ClientCtor<C, O>, agent = this.agent,
  ): C {
    return new $Client(agent, this.get(name) as O)
  }
  /** Chainable. Add multiple to the deployment, replacing existing. */
  setMany (receipts: Record<string, any>) {
    for (const [name, receipt] of Object.entries(receipts)) {
      this.receipts[name] = receipt
    }
    return this.save()
  }
  /** Resolve a path relative to the deployment directory. */
  resolve (...fragments: Array<string>) {
    // Expect path to be present
    if (!this.path) throw new Error('Deployment: no path to resolve by')
    return resolve(this.path, ...fragments)
  }
  /** Instantiate one contract and save its receipt to the deployment. */
  async init (agent: Agent, template: Template, name: Label, msg: Message): Promise<Instance> {
    const label = addPrefix(this.prefix, name)
    try {
      const instance = await agent.instantiate(template, label, msg)
      this.set(name, instance)
      return instance
    } catch (e) {
      DeployLogger(console).deployFailed(e, template, name, msg)
      throw e
    }
  }
  /** Instantiate multiple contracts from the same Template with different parameters. */
  async initMany (
    agent: Agent, template: Template, contracts: DeployArgs[] = []
  ): Promise<Instance[]> {
    // this adds just the template - prefix is added in initVarious
    try {
      return this.initVarious(agent, contracts.map(([name, msg])=>[template, name, msg]))
    } catch (e) {
      DeployLogger(console).deployManyFailed(e, template, contracts)
      throw e
    }
  }
  /** Instantiate multiple contracts from different Templates with different parameters. */
  async initVarious (
    agent: Agent, contracts: DeployArgsTriple[] = []
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
    const toInitConfig = ([t, n, m]: DeployArgsTriple)=>[t, addPrefix(this.prefix, n), m]
    const initConfigs = contracts.map(toInitConfig)
    // Deploy
    const instances = await agent.instantiateMany(initConfigs as [Template, Label, Message][])
    // Store receipts
    for (const instance of Object.values(instances)) {
      const name = (instance.label as string).slice(this.prefix.length+1)
      this.receipts[name] = { name, ...instance}
      this.save()
    }
    return Object.values(instances)
  }
  /// ## CREATING AND LOADING DEPLOYMENT //////////////////////////////////////////////////////////
  constructor (
    /** Path to the file containing the receipts. */
    public readonly path?:  string,
    /** The default identity to use when interacting with this deployment. */
    public readonly agent?: Agent,
  ) {
    if (this.path) this.load()
  }
  /** Load deployment state from YAML file. */
  load (path = this.path) {
    // Expect path to be present
    if (!path) throw new Error('Deployment: no path to load from')
    // Resolve symbolic links to file
    while (lstatSync(path).isSymbolicLink()) path = resolve(dirname(path), readlinkSync(path))
    // Set own prefix from name of file
    this.prefix    = basename(path, extname(path))
    // Load the receipt data
    const data     = readFileSync(path, 'utf8')
    const receipts = YAML.loadAll(data) as DeployReceipt[]
    for (const receipt of receipts) {
      const [contractName, _version] = receipt.name.split('+')
      this.receipts[contractName] = receipt
    }
    // TODO: Automatically convert receipts to Client subclasses
    // by means of an identifier shared between the deploy and client libraries
  }
  /// ## UPDATING DEPLOYMENT //////////////////////////////////////////////////////////////////////
  /** Chainable. Add entry to deployment, replacing existing receipt. */
  set (name: string, data: Partial<DeployReceipt> & any): this {
    this.receipts[name] = { name, ...data }
    return this.save()
  }
  /** Chainable. Add to deployment, merging into existing receipts. */
  add (name: string, data: any): this {
    return this.set(name, { ...this.receipts[name] || {}, ...data })
  }
  /** Chainable: Serialize deployment state to YAML file. */
  save (path = this.path): this {
    // Expect path to be present
    if (!path) throw new Error('Deployment: no path to save to')
    // Serialize data to multi-document YAML
    let output = ''
    for (let [name, data] of Object.entries(this.receipts)) {
      output += '---\n'
      data.name ??= name
      const obj = { ...data }
      // convert Template to serializable plain object
      if (obj.template instanceof Template) {
        obj.template = JSON.parse(JSON.stringify(new Template(
          obj.template.artifact,
          obj.template.codeHash,
          obj.template.chainId,
          obj.template.codeId,
          obj.template.uploadTx
        )))
      }
      delete obj.template?.artifact?.source?.workspace?.path
      output += alignYAML(YAML.dump(obj, { noRefs: true }))
    }
    // Write the data to disk.
    writeFileSync(path, output)
    return this
  }
}
const codeHashForBlob  = (blob: Uint8Array) => toHex(new Sha256(blob).digest())
const codeHashForPath  = (location: string) => codeHashForBlob(readFileSync(location))
export const addPrefix = (prefix: string, name: string) => `${prefix}/${name}`
export type  Name      = string

if (
  //@ts-ignore
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  if (process.argv.length > 2) {
    console.info('Using deploy script:', bold(process.argv[2]))
    //@ts-ignore
    import(resolve(process.argv[2])).then(deployScript=>{
      const deployCommands = deployScript.default
      if (!deployCommands) {
        console.error(`${process.argv[2]} has no default export.`)
        console.info(
          `Export an instance of DeployCommands `+
          `to make this file a deploy script:`
        )
        console.info(
          `\n\n`                                                     +
          `    import { DeployCommands } from '@fadroma/deploy'\n\n` +
          `    const deploy = new DeployCommands('deploy')\n`        +
          `    export default deploy\n\n`                            +
          `    deploy.command('my-deploy-command', 'command info', async function (context) {\n\n` +
          `      /* your deploy procedure here */\n\n` +
          `    })\n`
        )
        process.exit(2)
      }
      return deployCommands.launch(process.argv.slice(3))
    }).catch(e=>{
      console.error(e)
      process.exit(1)
    })
  } else {
    runOperation('deploy status', 'show deployment status', [
      getAgentContext,  ConnectLogger(console).chainStatus,
      getDeployContext, DeployLogger(console).deployment
    ], process.argv.slice(2))
  }
}

export { YAML }
