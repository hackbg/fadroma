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
import * as Formati from '@hackbg/formati'
import * as Komandi from '@hackbg/komandi'
import * as Konfizi from '@hackbg/konfizi'
import * as Kabinet from '@hackbg/kabinet'
import $ from '@hackbg/kabinet'

import * as Fadroma from '@fadroma/client'
import * as Build   from '@fadroma/build'
import * as Connect from '@fadroma/connect'

import { basename, resolve, dirname, relative, extname } from 'path'
import * as FS from 'fs'

import YAML from 'js-yaml'
export { YAML }

/// # Deploy config ////////////////////////////////////////////////////////////////////////////////

export class DeployConfig extends Konfizi.EnvConfig {
  /** Whether to always upload contracts, ignoring upload receipts that match. */
  reupload: boolean = this.getBoolean('FADROMA_REUPLOAD', () => false)
  /** Whether to generate unsigned transactions for manual multisig signing. */
  multisig: boolean = this.getBoolean('FADROMA_MULTISIG', () => false)
}

/// # Deploy context ///////////////////////////////////////////////////////////////////////////////

export class DeployContext extends Komandi.Context {

  constructor (
    config:          DeployConfig,
    private connect: Connect.ConnectContext,
    private build?:  Build.BuildContext
  ) {
    super()

    this.config = config ?? new DeployConfig(this.env, this.cwd)

    // Make sure we're operating in a deployment
    if (!this.deployment) {
      console.warn('No active deployment. Most commands will fail.')
      console.warn('You can create a deployment using `fadroma-deploy new`')
      console.warn('or select a deployment using `fadroma-deploy select`')
      console.warn('among the ones listed by `fadroma-deploy list`')
    }

    // Make sure we have an operating identitiy
    if (!this.creator) {
      throw new Error('No deploy agent. Authenticate by exporting FADROMA_MNEMONIC in your shell.')
    }

    this.uploader = (!this.connect.isMocknet && !this.config.reupload)
      ? CachingFSUploader.fromConfig(agent, build?.config.project)
      : new FSUploader(connect.agent)

  }

  config:      DeployConfig

  get chain (): Fadroma.Chain|undefined {
    return this.connect?.chain
  }

  get agent (): Fadroma.Agent|undefined {
    return this.connect?.agent
  }

  /** Knows how to upload contracts to a blockchain. */
  uploader:    Fadroma.Uploader

  /** Specify a template to upload or use. */
  template (...args: ConstructorParameters<Fadroma.NewTemplate>): Fadroma.Template {
    return new Fadroma.Template(...args)
  }

  /** Specify multiple templates to upload or use. */
  templates (specifiers: Fadroma.IntoTemplate[]): Fadroma.Templates {
    return new Fadroma.Templates(specifiers, this)
  }

  /** All available deployments for the current chain. */
  deployments: Deployments|null = null

  /** Currently selected deployment. */
  deployment:  Deployment|null  = this.deployments?.active || null

  /** Agent that will instantiate the templates. */
  creator:     Fadroma.Agent

  /** Specify a contract to deploy or operate. */
  contract <C extends Fadroma.Contract> (...args: ConstructorParameters<Fadroma.NewContract>): C {
    return new Fadroma.Contract(...args).but({ context: this })
  }

  /** Specify multiple contracts of the same kind. */
  contracts <C extends Fadroma.Contract> (
    _Client: Fadroma.ContractCtor<C, Partial<Fadroma.Contract>>
      = Fadroma.Contract as Fadroma.ContractCtor<C, Partial<Fadroma.Contract>>
  ): Fadroma.Contracts<C> {
    return new Fadroma.Contracts(_Client, { context: this })
  }

}

/// # Deploy task

/** Base class for class-based deploy procedure. Adds progress logging. */
export class DeployTask<X> extends Komandi.Task<DeployContext, X> {

  log = new DeployConsole(console, 'Fadroma.DeployTask')

  contract <C extends Fadroma.Contract> (
    ...args: ConstructorParameters<Fadroma.NewContract>
  ): C {
    return this.context.contract(...args) as C
  }

  contracts <C extends Fadroma.Contract> (
    ...args: ConstructorParameters<Fadroma.NewContract>
  ): Contracts<C> {
    return this.context.contracts(...args) as Contracts<C>
  }

}

/// # Deploy console

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

/// # Deploy commands

/** Command runner. Instantiate one in your script then use the
  * **.command(name, info, ...steps)**. Export it as default and
  * run the script with `npm exec fadroma my-script.ts` for a CLI. */
export class DeployCommands extends Komandi.Commands<DeployContext> {

  constructor (name: string = 'deploy', before = [], after = []) {
    // Deploy commands are like regular commands but
    // they already have a whole lot of deploy handles
    // pre-populated in the context.
    super(name, before, after)
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

  static expectEnabled = (context: DeployContext): Deployments => {
    if (!(context.deployments instanceof Deployments)) {
      //console.error('context.deployments was not populated')
      //console.log(context)
      throw new Error('Deployments were not enabled')
    }
    return context.deployments
  }

  /** Add the currently active deployment to the command context. */
  static get = async (context: DeployContext): Promise<DeployContext> => {
    const deployments = this.expectEnabled(context)
    if (!deployments.active) {
      console.info('No selected deployment on chain:', bold(context.chain.id))
    }
    context.deployment = deployments.active
    return getDeployContext(context)
  }

  /** Create a new deployment and add it to the command context. */
  static create = async (context: DeployContext): Promise<DeployContext> => {
    const deployments = this.expectEnabled(context)
    const [ prefix = context.timestamp ] = context.args
    await deployments?.create(prefix)
    await deployments?.select(prefix)
    return await DeployCommands.get(context)
  }

  /** Add either the active deployment, or a newly created one, to the command context. */
  static getOrCreate = async (context: DeployContext): Promise<DeployContext> => {
    const deployments = this.expectEnabled(context)
    if (deployments?.active) {
      return DeployCommands.get(context)
    } else {
      return await DeployCommands.create(context)
    }
  }

  /** Print a list of deployments on the selected chain. */
  static list = async (context: DeployContext): Promise<void> => {
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
  static select = async (context: DeployContext): Promise<void> => {
    const deployments = this.expectEnabled(context)
    const [id] = context.args ?? [undefined]
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
  static status = async (context: DeployContext, [id] = context.args): Promise<void> => {
    const deployments = this.expectEnabled(context)
    const deployment  = id ? deployments.get(id) : deployments.active
    if (deployment) {
      this.log.deployment(deployment)
    } else {
      console.info('No selected deployment on chain:', bold(context.chain?.id??'(no chain)'))
    }
  }

  static log = new DeployConsole(console, 'Fadroma.DeployCommands')

}

/// # Uploaders

/** Uploads contracts from the local filesystem.
  * If provided with an Uploads directory containing upload receipts,
  * allows for uploaded contracts to be reused. */
export class FSUploader extends Fadroma.Uploader {

  /** This defines the default path for the upload receipt cache. */
  static fromConfig (agent: Fadroma.Agent, projectRoot: string) {
    return new this(
      agent,
      $(projectRoot).in('receipts').in(agent.chain.id).in('uploads').as(Uploads)
    )
  }

  constructor (
    /** Agent that will sign the upload transactions(s). */
    readonly agent:  Fadroma.Agent,
    /** If present, upload receipts are stored in it and reused to save reuploads. */
    readonly cache?: Uploads
  ) {
    super(agent)
  }

  /** Upload an artifact from the filesystem if an upload receipt for it is not present. */
  async upload (template: Fadroma.Template): Promise<Fadroma.Template> {
    let receipt: UploadReceipt|null = null
    if (this.cache) {
      const name = this.getUploadReceiptName(template)
      receipt = this.cache.at(name).as(UploadReceipt)
      if (receipt.exists()) {
        console.info('Reuse    ', bold(this.cache.at(name).shortPath))
        return receipt.toTemplate()
      }
    }
    const data = $(template.artifact!).as(Kabinet.BinaryFile).load()
    template = template.but(await this.agent.upload(data))
    if (receipt) {
      receipt.save(template)
    }
    //await this.agent.nextBlock
    return template
  }

  getUploadReceiptName (template: Fadroma.Template): string {
    return `${$(template.artifact!).name}.json`
  }

  /** Upload multiple Artifacts from the filesystem.
    * TODO: Optionally bundle them (where is max size defined?) */
  async uploadMany (inputs: Fadroma.Template[]): Promise<Fadroma.Template[]> {

    const outputs: Fadroma.Template[] = []

    if (this.cache) {
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
        const receiptData = $(receiptPath).as(UploadReceipt).load()
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
          $(this.cache, receiptName).as(UploadReceipt).save(uploaded[i])
          outputs[i] = uploaded[i]
        }
      } else {
        //console.info('No artifacts need to be uploaded.')
      }

      return outputs

    } else {

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

    }

    return outputs

  }

  getUploadReceiptPath (template: Fadroma.Template): string {
    const receiptName = `${this.getUploadReceiptName(template)}`
    const receiptPath = this.cache!.resolve(receiptName)
    return receiptPath
  }

}

/// # Upload receipts

/** Directory collecting upload receipts.
  * Upload receipts are JSON files of the format `$CRATE@$REF.wasm.json`
  * and are kept so that we don't reupload the same contracts. */
export class Uploads extends Kabinet.JSONDirectory<UploadReceipt> {}

/** Class that convert itself to a Template, from which contracts can be instantiated. */
export class UploadReceipt extends Kabinet.JSONFile<{
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
}> {

  toTemplate (defaultChainId?: string): Fadroma.Template {
    let { chainId, codeId, codeHash, uploadTx, artifact } = this.load()
    chainId ??= defaultChainId
    codeId  = String(codeId)
    return new Fadroma.Template({ artifact, codeHash, chainId, codeId, uploadTx })
  }

}

/// # Deploy receipts

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
  async create (name: string = Konzola.timestamp()) {
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
  prefix: string = Konzola.timestamp()

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
  getClient <C extends Fadroma.Contract> (
    name:    string,
    $Client: Fadroma.NewContract = Fadroma.Contract as Fadroma.NewContract,
    agent:   Fadroma.Agent       = this.agent!,
  ): C {
    return new $Client({ ...this.get(name), agent }) as C
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
    const label = Fadroma.Contract.addPrefix(this.prefix, name)
    try {
      const contract = new Fadroma.Contract(template).as(agent).deploy(label, msg)
      this.set(name, contract)
      return contract
    } catch (e) {
      this.log.deployFailed(e, template, name, msg)
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
      this.log.deployManyFailed(e, template, contracts)
      throw e
    }
  }

  /** Instantiate multiple contracts from different Templates with different parameters,
    * and store their receipts in the deployment. */
  async initVarious (
    agent:     Fadroma.Agent,
    contracts: Fadroma.DeployArgsTriple[] = []
  ): Promise<Fadroma.Contract[]> {
    const instances = await new Fadroma.Contract().deployVarious(contracts)
    for (const instance of Object.values(instances)) {
      const name = (instance.label as string).slice(this.prefix.length+1)
      this.receipts[name] = { name, ...instance}
      this.save()
    }
    return instances
  }

  /// ## CREATING AND LOADING DEPLOYMENT //////////////////////////////////////////////////////////

  /** Load deployment state from YAML file. */
  load (path = this.path) {
    // Expect path to be present
    if (!path) throw new Error('Deployment: no path to load from')
    // Resolve symbolic links to file
    while (FS.lstatSync(path).isSymbolicLink()) path = resolve(dirname(path), FS.readlinkSync(path))
    // Set own prefix from name of file
    this.prefix = basename(path, extname(path))
    // Load the receipt data
    const data = FS.readFileSync(path, 'utf8')
    const receipts = YAML.loadAll(data) as Fadroma.Contract[]
    for (const receipt of receipts) {
      if (!receipt.name) continue
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

const bold = Konzola.bold
