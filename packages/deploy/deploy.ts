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

import * as Konzola from '@hackbg/konzola'
import { bold, timestamp } from '@hackbg/konzola'
import * as Formati from '@hackbg/formati'
import * as Komandi from '@hackbg/komandi'
import * as Konfizi from '@hackbg/konfizi'
import * as Kabinet from '@hackbg/kabinet'
import $ from '@hackbg/kabinet'

import * as Fadroma from '@fadroma/client'
import * as Build   from '@fadroma/build'
import * as Connect from '@fadroma/connect'

import { basename, resolve, dirname, relative, extname } from 'path'
import { fileURLToPath } from 'url'
import { cwd } from 'process'
import * as FS from 'fs'

import YAML from 'js-yaml'
export { YAML }

/// # Deploy console ///////////////////////////////////////////////////////////////////////////////

export class DeployConsole extends Konzola.CustomConsole {

  name = 'Fadroma Deploy'

  deployment ({ deployment }: { deployment: Deployment }) {
    if (deployment) {
      const { receipts, prefix } = deployment
      let contracts: string|number = Object.values(receipts).length
      contracts = contracts === 0 ? `(empty)` : `(${contracts} contracts)`
      const len = Math.min(40, Object.keys(receipts).reduce((x,r)=>Math.max(x,r.length),0))
      this.info('│ Active deployment:'.padEnd(len+2), bold($(deployment.path!).shortPath), contracts)
      const count = Object.values(receipts).length
      if (count > 0) {
        for (const name of Object.keys(receipts)) {
          this.receipt(name, receipts[name], len)
        }
      } else {
        this.info('│ This deployment is empty.')
      }
    } else {
      this.info('│ There is no selected deployment.')
    }
  }

  receipt (name: string, receipt: any, len = 35) {
    name = bold(name.padEnd(len))
    if (receipt.address) {
      const address = `${receipt.address}`.padStart(45)
      const codeId  = String(receipt.codeId||'n/a').padStart(6)
      this.info('│', name, address, codeId)
    } else {
      this.warn('│ (non-standard receipt)'.padStart(45), 'n/a'.padEnd(6), name)
    }
  }

  deployFailed (e: Error, template: Fadroma.Template, name: Fadroma.Label, msg: Fadroma.Message) {
    this.error()
    this.error(`  Deploy of ${bold(name)} failed:`)
    this.error(`    ${e.message}`)
    this.deployFailedTemplate(template)
    this.error()
    this.error(`  Init message: `)
    this.error(`    ${JSON.stringify(msg)}`)
    this.error()
  }

  deployManyFailed (e: Error, template: Fadroma.Template, contracts: Fadroma.DeployArgs[]) {
    this.error()
    this.error(`  Deploy of multiple contracts failed:`)
    this.error(`    ${e.message}`)
    this.deployFailedTemplate(template)
    this.error()
    this.error(`  Configs: `)
    for (const [name, init] of contracts) {
      this.error(`    ${bold(name)}: `, JSON.stringify(init))
    }
    this.error()
  }

  deployFailedTemplate (template?: Fadroma.Template) {
    this.error()
    if (template) {
      this.error(`  Template:   `)
      this.error(`    Chain ID: `, bold(template.chainId ||''))
      this.error(`    Code ID:  `, bold(template.codeId  ||''))
      this.error(`    Code hash:`, bold(template.codeHash||''))
    } else {
      this.error(`  No template was providede.`)
    }
  }

}

export const log = new DeployConsole(console)

/// # Deploy config ////////////////////////////////////////////////////////////////////////////////

type PriorConfig = (Connect.ConnectConfig & Build.BuilderConfig)

export class DeployConfig extends Konfizi.EnvConfig {
  /** Whether to always upload contracts, ignoring upload receipts that match. */
  reupload: boolean = this.getBool('FADROMA_REUPLOAD', () => false)
  /** Whether to generate unsigned transactions for manual multisig signing. */
  multisig: boolean = this.getBool('FADROMA_MULTISIG', () => false)
}

/// # Deploy context ///////////////////////////////////////////////////////////////////////////////

/** TypeScript made me do it! */
type AgentAndBuildContext = Connect.ConnectContext & Build.BuildContext

/** The full list of deployment procedures that open up
  * once you're authenticated and can compile code locally */
export interface DeployContext extends AgentAndBuildContext {
  /** All the environment config so far. */
  config:     PriorConfig & DeployConfig
  /** Currently selected deployment. */
  deployment: Deployment|null
  /** Knows how to upload contracts to a blockchain. */
  uploader:   Fadroma.Uploader
  /** Specify a template. */
  template    (specifier: Fadroma.IntoTemplate):    Fadroma.Template
  /** Specify multiple templates. */
  templates   (specifiers: Fadroma.IntoTemplate[]): Fadroma.Templates
  /** Agent that will instantiate the templates. */
  creator:    Fadroma.Agent
  /** Specify a contract. */
  contract <C extends Fadroma.Contract, O extends Partial<Fadroma.Contract>> (
    reference:  Fadroma.IntoContract,
    APIClient?: Fadroma.ContractCtor<C, O>
  ): Fadroma.Contract
  /** Specify multiple contracts of the same kind. */
  contracts <C extends Fadroma.Contract, O extends Partial<Fadroma.Contract>> (
    APIClient?: Fadroma.ContractCtor<C, O>
  ): Fadroma.Contracts<C>
}

/** Taking merged Agent and Build context as a basis, populate deploy context. */
export function getDeployContext (
  context: AgentAndBuildContext & Partial<DeployContext>,
  agent:   Fadroma.Agent = context.creator ?? context.agent
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

  if (!agent) {
    throw new Error('No deploy agent. Authenticate by exporting FADROMA_MNEMONIC in your shell.')
  }

  // Get configuration
  const config = {
    ...new Build.BuilderConfig(context.env, context.cwd),
    ...new Connect.ConnectConfig(context.env, context.cwd),
    ...new DeployConfig(context.env, context.cwd),
  }

  context = {

    ...context,

    config,

    uploader: (!context.isMocknet && !config.reupload)
      ? CachingFSUploader.fromConfig(agent, config.project)
      : new FSUploader(agent),

    template (specifier: Fadroma.IntoTemplate): Fadroma.Template {
      return new Fadroma.Template(specifier)
    },

    templates (specifiers: Fadroma.IntoTemplate[]): Fadroma.Templates {
      return new Fadroma.Templates(specifiers)
    },

    deployment: context.deployment!,

    creator: agent,

    contract <C extends Fadroma.Contract> (
      specifier: Fadroma.IntoContract,
      _Client:   Fadroma.ContractCtor<C, Partial<Fadroma.Contract>>
        = Fadroma.Contract as Fadroma.ContractCtor<C, Partial<Fadroma.Contract>>
    ): C {
      return new Fadroma.Contract(specifier, _Client)
        .but({ context: context as Fadroma.UploadInitContext }) as C
    },

    contracts <C extends Fadroma.Contract> (
      _Client: Fadroma.ContractCtor<C, Partial<Fadroma.Contract>>
        = Fadroma.Contract as Fadroma.ContractCtor<C, Partial<Fadroma.Contract>>
    ): Fadroma.Contracts<C> {
      return new Fadroma.Contracts(_Client)
        .but({ context: context as DeployContext }) as Fadroma.Contracts<C>
    }

  }
  return context as DeployContext
}

/** Base class for class-based deploy procedure. Adds progress logging. */
export class DeployTask<X> extends Komandi.Task<DeployContext, X> {

  console = console

  contract <C extends Fadroma.Contract> (
    arg:      Fadroma.IntoContract,
    _Client?: Fadroma.ContractCtor<C, Partial<Fadroma.Contract>>
  ): C {
    return this.context.contract(arg, _Client) as C
  }

}

/** Directory collecting upload receipts.
  * Upload receipts are JSON files of the format `$CRATE@$REF.wasm.json`
  * and are kept so that we don't reupload the same contracts. */
export class Uploads extends Kabinet.JSONDirectory<UploadReceipt> {}

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
  artifact?:          any
}

/** Class that convert itself to a Template, from which contracts can be instantiated. */
export class UploadReceipt extends Kabinet.JSONFile<IUploadReceipt> {

  toTemplate (defaultChainId?: string): Fadroma.Template {
    let { chainId, codeId, codeHash, uploadTx, artifact } = this.load()
    chainId ??= defaultChainId
    codeId  = String(codeId)
    return new Fadroma.Template({ artifact, codeHash, chainId, codeId, uploadTx })
  }

}

/** Uploads contracts from the local file system. */
export class FSUploader extends Fadroma.Uploader {

  /** Upload an Artifact from the filesystem, returning a Template. */
  async upload (template: Fadroma.Template): Promise<Fadroma.Template> {
    console.info('Upload   ', bold($(template.artifact!).shortPath))
    const data = $(template.artifact!).as(Kabinet.BinaryFile).load()
    template = template.but(await this.agent.upload(data))
    await this.agent.nextBlock
    return template
  }

  /** Upload multiple Artifacts from the filesystem.
    * TODO: Optionally bundle them (where is max size defined?) */
  async uploadMany (inputs: Fadroma.Template[]): Promise<Fadroma.Template[]> {

    //console.log('uploadMany', inputs)
    const outputs: Fadroma.Template[] = []

    for (const i in inputs) {
      // support "holes" in artifact array
      // (used by caching subclass)
      const input = inputs[i]
      let output
      if (input.artifact) {
        const path = $(input.artifact!)
        const data = path.as(Kabinet.BinaryFile).load()
        console.info('Uploading', bold(path.shortPath), `(${data.length} bytes uncompressed)`)
        output = input.but(await this.agent.upload(data))
        if (input.codeHash !== output.codeHash) {
          // Print a warning if the code hash returned by the upload
          // doesn't match the one specified in the Artifact.
          // This means the Artifact is wrong, and may become
          // a hard error in the future. */
          console.warn(
            `Code hash mismatch from upload in TX ${output.uploadTx}:\n`+
            `   Expected ${input.codeHash} (from ${$(input.artifact!).shortPath})\n`+
            `   Got      ${output.codeHash} (from code id ${output.codeId} on ${output.chainId})`
          )
        }
      }
      outputs[i] = output
    }

    return outputs

  }

}

/** Uploads contracts from the file system,
  * but only if a receipt does not exist in the chain's uploads directory. */
export class CachingFSUploader extends FSUploader {

  static fromConfig (agent: Fadroma.Agent, projectRoot: string) {
    return new CachingFSUploader(
      agent,
      $(projectRoot).in('receipts').in(agent.chain.id).in('uploads').as(Uploads)
    )
  }

  constructor (readonly agent: Fadroma.Agent, readonly cache: Uploads) {
    super(agent)
  }

  protected getUploadReceiptPath (template: Fadroma.Template): string {
    const receiptName = `${this.getUploadReceiptName(template)}`
    const receiptPath = this.cache.resolve(receiptName)
    return receiptPath
  }

  protected getUploadReceiptName (template: Fadroma.Template): string {
    return `${$(template.artifact!).name}.json`
  }

  /** Upload an artifact from the filesystem if an upload receipt for it is not present. */
  async upload (template: Fadroma.Template): Promise<Fadroma.Template> {

    const name    = this.getUploadReceiptName(template)
    const receipt = this.cache.at(name).as(UploadReceipt)
    if (receipt.exists()) {
      console.info('Reuse    ', bold(this.cache.at(name).shortPath))
      return receipt.toTemplate()
    }

    const data = $(template.artifact!).as(Kabinet.BinaryFile).load()
    template = new Fadroma.Template(template, await this.agent.upload(data))
    receipt.save(template)

    return template

  }

  async uploadMany (inputs: Fadroma.Template[]): Promise<Fadroma.Template[]> {

    const outputs:           Fadroma.Template[] = []
    const artifactsToUpload: Fadroma.Template[] = []

    for (const i in inputs) {

      const input = inputs[i]

      if (!input.codeHash) {
        const artifact = $(input.artifact!)
        console.warn('No code hash in artifact', bold(artifact.shortPath))
        try {
          const codeHash = Build.codeHashForPath($(input.artifact!).path)
          Object.assign(artifact, { codeHash })
          console.warn('Computed code hash:', bold(input.codeHash!))
        } catch (e) {
          console.warn('Could not compute code hash:', e.message)
        }
      }

      const blobName     = $(input.artifact!).name
      const receiptPath  = this.getUploadReceiptPath(input)
      const relativePath = $(receiptPath).shortPath
      if (!$(receiptPath).exists()) {
        artifactsToUpload[i] = input
        continue
      }

      const receiptFile = $(receiptPath).as(Kabinet.JSONFile) as Kabinet.JSONFile<IUploadReceipt>
      const receiptData: IUploadReceipt = receiptFile.load()
      const receiptCodeHash = receiptData.codeHash || receiptData.originalChecksum
      if (!receiptCodeHash) {
        //console.info(bold(`No code hash:`), `${relativePath}; reuploading...`)
        artifactsToUpload[i] = input
        continue
      }
      if (receiptCodeHash !== input.codeHash) {
        console.warn(
          bold(`Different code hash:`), `${relativePath}; reuploading...`
        )
        artifactsToUpload[i] = input
        continue
      }

      //console.info('✅', 'Exists, not reuploading (same code hash):', bold(relativePath))
      outputs[i] = new Fadroma.Template(input, {
        codeId:   String(receiptData.codeId),
        uploadTx: receiptData.transactionHash as string
      })

    }

    if (artifactsToUpload.length > 0) {

      const uploaded = await super.uploadMany(artifactsToUpload)

      for (const i in uploaded) {
        if (!uploaded[i]) continue // skip empty ones, preserving index
        const receiptName = this.getUploadReceiptName(artifactsToUpload[i])
        const receiptFile = $(this.cache, receiptName).as(Kabinet.JSONFile)
        receiptFile.save(uploaded[i])
        outputs[i] = uploaded[i]
      }

    } else {
      //console.info('No artifacts need to be uploaded.')
    }

    return outputs

  }

}

/// # DEPLOY RECEIPTS DIRECTORY ///////////////////////////////////////////////////////////////////

/** Directory containing deploy receipts, e.g. `receipts/$CHAIN/deployments`.
  * Each deployment is represented by 1 multi-document YAML file, where every
  * document is delimited by the `\n---\n` separator and represents a deployed
  * smart contract. */
export class Deployments extends Kabinet.YAMLDirectory<Fadroma.Contract[]> {

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
    return path.makeParent().as(Kabinet.YAMLFile).save(undefined)
    return new Deployment(path.path)
  }

  /** Make the specified deployment be the active deployment. */
  async select (name: string) {
    const selection = this.at(`${name}.yml`)
    if (!selection.exists) {
      throw new Error(`Deployment ${name} does not exist`)
    }
    const active = this.at(`${this.KEY}.yml`).as(Kabinet.YAMLFile)
    try { active.delete() } catch (e) {}
    await FS.symlinkSync(selection.path, active.path)
  }

  /** Get the contents of the active deployment, or null if there isn't one. */
  get active (): Deployment|null {
    return this.get(this.KEY)
  }

  /** Get the contents of the named deployment, or null if it doesn't exist. */
  get (name: string): Deployment|null {
    const path = resolve(this.path, `${name}.yml`)
    if (!FS.existsSync(path)) {
      return null
    }
    return new Deployment(path)
  }

  /** List the deployments in the deployments directory. */
  list () {
    if (!FS.existsSync(this.path)) {
      return []
    }
    return FS.readdirSync(this.path)
      .filter(x=>x!=this.KEY)
      .filter(x=>x.endsWith('.yml'))
      .map(x=>basename(x,'.yml'))
  }

  /** DEPRECATED: Save some extra data into the deployments directory. */
  save <D> (name: string, data: D) {
    const file = this.at(`${name}.json`).as(Kabinet.JSONFile) as Kabinet.JSONFile<D>
    //console.info('Deployments writing:', bold(file.shortPath))
    return file.save(data)
  }
}

/// # DEPLOYMENT / DEPLOYMENT RECEIPT /////////////////////////////////////////////////////////////
/** An individual deployment, represented as a multi-document YAML file.
  * Each entry in the file is a Receipt, representing a deployed contract.
  * You can deploy contracts with a Deployment using **deployment.init...**
  * and get Clients for interacting with existing contracts using **deployment.get...**. */
export class Deployment {

  constructor (
    /** Path to the file containing the receipts. */
    public readonly path?:  string,
    /** The default identity to use when interacting with this deployment. */
    public readonly agent?: Fadroma.Agent,
  ) {
    if (this.path) this.load()
  }

  /// ## BUSINESS END OF DEPLOYMENT ///////////////////////////////////////////////////////////////

  /** This is the unique identifier of the deployment.
    * It's used as a prefix to contract labels
    * (which need to be globally unique). */
  prefix: string = timestamp()

  /** These are the entries contained by the Deployment.
    * They correspond to individual contract instances. */
  receipts: Record<string, Partial<Fadroma.Contract>> = {}

  /** Check if the deployment contains a certain entry. */
  has (name: string): boolean {
    return !!this.receipts[name]
  }

  /** Get the receipt for a contract, containing its address, codeHash, etc. */
  get (name: string): Partial<Fadroma.Contract>|null {
    const receipt = this.receipts[name]
    if (!receipt) return null
    receipt.name = name
    return receipt
  }

  expect (
    name:    string,
    message: string = `${name}: no such contract in deployment`
  ): Partial<Fadroma.Contract> {
    const receipt = this.get(name)
    if (receipt) return receipt
    throw new Error(message)
  }

  /** Get a handle to the contract with the specified name. */
  getClient <C extends Fadroma.Contract, O extends Partial<Fadroma.Contract>> (
    name:    string,
    $Client: Fadroma.ContractCtor<C, O> = Fadroma.Contract as Fadroma.ContractCtor<C, O>,
    agent:   Fadroma.Agent|undefined = this.agent,
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
  async init (
    agent:    Fadroma.Agent,
    template: Fadroma.Template,
    name:     Fadroma.Label,
    msg:      Fadroma.Message
  ): Promise<Fadroma.Contract> {
    const label = addPrefix(this.prefix, name)
    try {
      const instance = await agent.instantiate(template, label, msg)
      this.set(name, instance)
      return instance
    } catch (e) {
      log.deployFailed(e, template, name, msg)
      throw e
    }
  }

  /** Instantiate multiple contracts from the same Template with different parameters. */
  async initMany (
    agent:     Fadroma.Agent,
    template:  Fadroma.Template,
    contracts: Fadroma.DeployArgs[] = []
  ): Promise<Fadroma.Contract[]> {
    // this adds just the template - prefix is added in initVarious
    try {
      return this.initVarious(agent, contracts.map(([name, msg])=>[template, name, msg]))
    } catch (e) {
      log.deployManyFailed(e, template, contracts)
      throw e
    }
  }

  /** Instantiate multiple contracts from different Templates with different parameters. */
  async initVarious (
    agent:     Fadroma.Agent,
    contracts: Fadroma.DeployArgsTriple[] = []
  ): Promise<Fadroma.Contract[]> {

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
    const toInitConfig = ([t, n, m]: Fadroma.DeployArgsTriple)=>[t, addPrefix(this.prefix, n), m]
    const initConfigs = contracts.map(toInitConfig)

    // Deploy
    const instances = await agent.instantiateMany(initConfigs as Fadroma.DeployArgsTriple[])

    // Store receipts
    for (const instance of Object.values(instances)) {
      const name = (instance.label as string).slice(this.prefix.length+1)
      this.receipts[name] = { name, ...instance}
      this.save()
    }

    return Object.values(instances)

  }

  /// ## CREATING AND LOADING DEPLOYMENT //////////////////////////////////////////////////////////

  /** Load deployment state from YAML file. */
  load (path = this.path) {
    // Expect path to be present
    if (!path) throw new Error('Deployment: no path to load from')
    // Resolve symbolic links to file
    while (FS.lstatSync(path).isSymbolicLink()) path = resolve(dirname(path), FS.readlinkSync(path))
    // Set own prefix from name of file
    this.prefix    = basename(path, extname(path))
    // Load the receipt data
    const data     = FS.readFileSync(path, 'utf8')
    const receipts = YAML.loadAll(data) as Fadroma.Contract[]
    for (const receipt of receipts) {
      const [contractName, _version] = receipt.name.split('+')
      this.receipts[contractName] = receipt
    }
    // TODO: Automatically convert receipts to Client subclasses
    // by means of an identifier shared between the deploy and client libraries
  }

  /// ## UPDATING DEPLOYMENT //////////////////////////////////////////////////////////////////////

  /** Chainable. Add entry to deployment, replacing existing receipt. */
  set (name: string, data: Partial<Fadroma.Contract> & any): this {
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
      data = { ...data, name: data.name ?? name }
      output += Kabinet.alignYAML(YAML.dump(data, { noRefs: true }))
    }
    // Write the data to disk.
    FS.writeFileSync(path, output)
    return this
  }

}

export const addPrefix = (prefix: string, name: string) => `${prefix}/${name}`

/// # DEPLOY COMMANDS /////////////////////////////////////////////////////////////////////////////
/** Command runner. Instantiate one in your script then use the
  * **.command(name, info, ...steps)**. Export it as default and
  * run the script with `npm exec fadroma my-script.ts` for a CLI. */
export default class DeployCommands <C extends AgentAndBuildContext> extends Komandi.Commands <C> {

  constructor (name: string = 'deploy', before = [], after = []) {
    // Deploy commands are like regular commands but
    // they already have a whole lot of deploy handles
    // pre-populated in the context.
    super(name, [
      Build.getBuildContext,
      Connect.connect,
      Connect.log.chainStatus,
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
    let forceNew = false
    if (args.includes('--new')) {
      forceNew = true
      args = args.filter(x=>x!=='--resume')
    }
    let resume = false
    if (args.includes('--resume')) {
      resume = true
      args = args.filter(x=>x!=='--resume')
    }
    const parsed = super.parse(args)
    if (!parsed) return null
    if (forceNew) {
      console.warn('--new: Creating new deployment')
      const toNew = (x: Komandi.Step<any, any>): Komandi.Step<any, any> =>
        (x === DeployCommands.get || x === DeployCommands.getOrCreate) ? DeployCommands.create : x
    } else if (resume) {
      // replace create with get
      console.warn('--resume: Resuming last deployment')
      const toResume = (x: Komandi.Step<any, any>): Komandi.Step<any, any> =>
        (x === DeployCommands.create) ? DeployCommands.get : x
      parsed[1].steps = parsed[1].steps.map(toResume)
    }
    return parsed
  }

  static expectEnabled = (context: { deployments: Deployments|null }): Deployments => {
    if (!(context.deployments instanceof Deployments)) {
      //console.error('context.deployments was not populated')
      //console.log(context)
      throw new Error('Deployments were not enabled')
    }
    return context.deployments
  }

  /** Add the currently active deployment to the command context. */
  static get = async (
    context: AgentAndBuildContext & Partial<DeployContext>
  ): Promise<DeployContext> => {
    const deployments = this.expectEnabled(context)
    if (!deployments.active) {
      console.info('No selected deployment on chain:', bold(context.chain.id))
    }
    context.deployment = deployments.active
    return getDeployContext(context)
  }

  /** Create a new deployment and add it to the command context. */
  static create = async (
    context: AgentAndBuildContext & Partial<DeployContext>
  ): Promise<DeployContext> => {
    const deployments = this.expectEnabled(context)
    const [ prefix = context.timestamp ] = context.cmdArgs
    await deployments?.create(prefix)
    await deployments?.select(prefix)
    return await DeployCommands.get(context)
  }

  /** Add either the active deployment, or a newly created one, to the command context. */
  static getOrCreate = async (
    context: AgentAndBuildContext & Partial<DeployContext>
  ): Promise<DeployContext> => {
    const deployments = this.expectEnabled(context)
    if (deployments?.active) {
      return DeployCommands.get(context)
    } else {
      return await DeployCommands.create(context)
    }
  }

  /** Print a list of deployments on the selected chain. */
  static list = async (context: Connect.ConnectContext): Promise<void> => {
    const deployments = this.expectEnabled(context)
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
  static select = async (context: Connect.ConnectContext): Promise<void> => {
    const deployments = this.expectEnabled(context)
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
  static status = async (
    context: Connect.ConnectContext,
    id = context.cmdArgs[0]
  ): Promise<void> => {
    const deployments = this.expectEnabled(context)
    const deployment  = id ? deployments.get(id) : deployments.active
    if (deployment) {
      log.deployment({ deployment })
    } else {
      console.info('No selected deployment on chain:', bold(context.chain.id))
    }
  }

}

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
    Komandi.runOperation('deploy status', 'show deployment status', [
      Connect.connect,
      Connect.log.chainStatus,
      getDeployContext,
      log.deployment
    ], process.argv.slice(2))
  }
}
