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

import * as Build   from '@fadroma/build'
import * as Connect from '@fadroma/connect'
import {
  Chain, Agent,
  Uploader,
  Template, Templates, NewTemplate, IntoTemplate,
  Client, NewClient, Contracts,
  Deployment, DeployArgs,
  Label, Message,
  SparseArray,
} from '@fadroma/client'

import { basename, resolve, dirname, relative, extname } from 'path'
import * as FS from 'fs'

import YAML from 'js-yaml'
export { YAML }

export class DeployContext extends Connect.ConnectContext {

  constructor (
    config:           Partial<DeployConfig> = new DeployConfig(),
    private build?:   Build.BuildContext
  ) {
    super(config)
    // Populate the config
    this.config = config ?? new DeployConfig(this.env, this.cwd)
    // Make sure we're operating in a deployment
    if (!this.deployment) {
      console.warn('No active deployment. Most commands will fail.')
      console.warn('You can create a deployment using `fadroma-deploy new`')
      console.warn('or select a deployment using `fadroma-deploy select`')
      console.warn('among the ones listed by `fadroma-deploy list`')
    }
    // Make sure we have an operating identitiy
    if (!this.agent) {
      throw new Error('No deploy agent. Authenticate by exporting FADROMA_MNEMONIC in your shell.')
    }
    // Populate the uploader
    this.uploader = FSUploader.fromConfig(this.agent!, build?.config.project)
  }

  config: DeployConfig

  log = new DeployConsole(console, 'Fadroma.DeployTask')

  /** Knows how to upload contracts to a blockchain. */
  uploader:    Uploader

  /** Specify a template to upload or use. */
  template = (...args: ConstructorParameters<NewTemplate>): Template => new Template(...args)

  /** Specify multiple templates to upload or use. */
  templates = (specifiers: IntoTemplate[]): Templates => new Templates(specifiers)

  /** All available deployments for the current chain. */
  deployments: Deployments|null = null

  /** Currently selected deployment. */
  deployment:  Deployment|null  = this.deployments?.active || null

  /** Specify a contract to deploy or operate. */
  contract = <C extends Client> (...args: ConstructorParameters<NewClient<C>>): C =>
    new Client(...args) as C

  /** Specify multiple contracts of the same kind. */
  contracts = <C extends Client> (
    $Client: NewClient<C> = Client as unknown as NewClient<C>
  ): Contracts<C> =>
    new Contracts([], { Client: $Client }) as Contracts<C>

}

export class DeployConfig extends Connect.ConnectConfig {
  /** Whether to always upload contracts, ignoring upload receipts that match. */
  reupload: boolean = this.getBoolean('FADROMA_REUPLOAD', () => false)
  /** Whether to generate unsigned transactions for manual multisig signing. */
  multisig: boolean = this.getBoolean('FADROMA_MULTISIG', () => false)
}

/** Directory containing deploy receipts, e.g. `receipts/$CHAIN/deployments`.
  * Each deployment is represented by 1 multi-document YAML file, where every
  * document is delimited by the `\n---\n` separator and represents a deployed
  * smart contract. */
export class Deployments extends Kabinet.YAMLDirectory<Client[]> {

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

/// # Deploy task

/** Base class for class-based deploy procedure. Adds progress logging. */
export class DeployTask<X> extends Komandi.Task<DeployContext, X> {

  log = new DeployConsole(console, 'Fadroma.DeployTask')

}

/// # Deploy console

export class DeployConsole extends Komandi.CommandsConsole {

  name = 'Fadroma Deploy'

  deployment ({ deployment }: { deployment: Deployment }) {
    if (deployment) {
      const { state = {}, prefix } = deployment
      let contracts: string|number = Object.values(state).length
      contracts = contracts === 0 ? `(empty)` : `(${contracts} contracts)`
      const len = Math.min(40, Object.keys(state).reduce((x,r)=>Math.max(x,r.length),0))
      this.info('│ Active deployment:'.padEnd(len+2), bold($(deployment.prefix!).shortPath), contracts)
      const count = Object.values(state).length
      if (count > 0) {
        for (const name of Object.keys(state)) {
          this.receipt(name, state[name], len)
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

  deployFailed (e: Error, template: Template, name: Label, msg: Message) {
    this.error()
    this.error(`  Deploy of ${bold(name)} failed:`)
    this.error(`    ${e.message}`)
    this.deployFailedTemplate(template)
    this.error()
    this.error(`  Init message: `)
    this.error(`    ${JSON.stringify(msg)}`)
    this.error()
  }

  deployManyFailed (e: Error, template: Template, contracts: DeployArgs[]) {
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

  deployFailedTemplate (template?: Template) {
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

const bold = Konzola.bold

/// # Deploy commands

/** Command runner. Instantiate one in your script then use the
  * **.command(name, info, ...steps)**. Export it as default and
  * run the script with `npm exec fadroma my-script.ts` for a CLI. */
export class DeployCommands extends Komandi.Commands<DeployContext> {

  constructor (name: string = 'deploy', before = [], after = []) {
    super(name, before, after)
    this.command('list',    'print a list of all deployments', DeployCommands.list)
    this.command('select',  'select a new active deployment',  DeployCommands.select)
    //@ts-ignore
    this.command('new',     'create a new empty deployment',   DeployCommands.create)
    this.command('status',  'show the current deployment',     DeployCommands.status)
    this.command('nothing', 'check that the script runs', () => console.log('So far so good'))
  }

  /** Defines a command that creates and selects a new deployment before running. */
  inNewDeployment (
    ...[name, info, ...steps]: Parameters<typeof this.command>
  ): this {
    return this.command(name, `(in new deployment) ${info}`, DeployCommands.create, ...steps)
  }

  /** Defines a command that runs in the currently selected deployment. */
  inSelectedDeployment (
    ...[name, info, ...steps]: Parameters<typeof this.command>
  ): this {
    return this.command(name, `(in current deployment) ${info}`, DeployCommands.get, ...steps)
  }

  /** Add the currently active deployment to the command context. */
  static get = async (context: DeployContext): Promise<DeployContext> => {
    const deployments = this.expectEnabled(context)
    if (!deployments.active) {
      console.info('No selected deployment on chain:', bold(context.chain?.id??'(unspecifier)'))
    }
    return { ...context, deployment: deployments.active } as DeployContext
  }

  /** Create a new deployment and add it to the command context. */
  static create = async (context: DeployContext): Promise<DeployContext> => {
    const deployments = this.expectEnabled(context)
    const [ prefix = context.timestamp ] = context.args
    await deployments?.create(prefix)
    await deployments?.select(prefix)
    return { ...context, ...await this.get(context) } as DeployContext
  }

  /** Add either the active deployment, or a newly created one, to the command context. */
  static getOrCreate = async (context: DeployContext): Promise<DeployContext> => {
    const deployments = this.expectEnabled(context)
    return {
      ...context,
      ...await deployments?.active
        ? DeployCommands.get(context)
        : DeployCommands.create(context)
    }
  }

  /** Print a list of deployments on the selected chain. */
  static list = async (context: DeployContext): Promise<void> => {
    const deployments = this.expectEnabled(context)
    const { chain = { id: '(unspecified)' } } = context
    const list = deployments.list()
    if (list.length > 0) {
      console.info(`Deployments on chain ${bold(chain.id)}:`)
      for (let name of list) {
        if (name === deployments.KEY) continue
        const deployment = deployments.get(name)!
        const count = Object.keys(deployment.state).length
        let info
        if (deployments.active && deployments.active.prefix === name) {
          info = `${bold(name)} (selected)`
        }
        info = `${deployment} (${deployment.count} contracts)`
        console.info(` `, info)
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
      this.log.deployment({ deployment })
    } else {
      console.info('No selected deployment on chain:', bold(context.chain?.id??'(no chain)'))
    }
  }

  private static expectEnabled = (context: DeployContext): Deployments => {
    if (!(context.deployments instanceof Deployments)) {
      //console.error('context.deployments was not populated')
      //console.log(context)
      throw new Error('Deployments were not enabled')
    }
    return context.deployments
  }

  static log = new DeployConsole(console, 'Fadroma.DeployCommands')

}

/// # Uploaders

/** Uploads contracts from the local filesystem.
  * If provided with an Uploads directory containing upload receipts,
  * allows for uploaded contracts to be reused. */
export class FSUploader extends Uploader {

  log = new DeployConsole(console, 'Fadroma.FSUploader')

  /** This defines the default path for the upload receipt cache. */
  static fromConfig (
    agent:        Agent,
    projectRoot?: string|Kabinet.Path|false,
    cacheRoot?:   string|Kabinet.Path|false
  ) {
    if (projectRoot) {
      cacheRoot ??= $(projectRoot).in('receipts').in(agent.chain.id).in('uploads').as(Uploads)
    }
    return new this(agent, cacheRoot ? $(cacheRoot).as(Uploads) : undefined)
  }

  constructor (
    /** Agent that will sign the upload transactions(s). */
    readonly agent:  Agent,
    /** If present, upload receipts are stored in it and reused to save reuploads. */
    readonly cache?: Uploads
  ) {
    super(agent)
  }

  /** Upload an artifact from the filesystem if an upload receipt for it is not present. */
  async upload (template: Template): Promise<Template> {
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
    template = template.where(await this.agent.upload(data))
    if (receipt) {
      receipt.save(template)
    }
    //await this.agent.nextBlock
    return template
  }

  getUploadReceiptName (template: Template): string {
    return `${$(template.artifact!).name}.json`
  }

  getUploadReceiptPath (template: Template): string {
    const receiptName = `${this.getUploadReceiptName(template)}`
    const receiptPath = this.cache!.resolve(receiptName)
    return receiptPath
  }

  /** Upload multiple templates from the filesystem.
    * TODO: Optionally bundle multiple templates in one transaction,
    * if they add up to less than the max API request size (which is defined... where?) */
  async uploadMany (inputs: SparseArray<Template>): Promise<SparseArray<Template>> {

    if (!this.cache) return this.uploadManySansCache(inputs)

    const outputs:  Template[] = []
    const toUpload: Template[] = []

    for (const i in inputs) {

      // Skip empty positions
      let input = inputs[i]
      if (!input) {
        continue
      }

      // Make sure local code hash is available to compare against the result of the upload
      // If these two don't match, the local contract was rebuilt and needs to be reuploaded.
      // If they still don't match after the reupload, there's a problem.
      input = this.ensureLocalCodeHash(input)

      // If there's no local upload receipt, time to reupload.
      const blobName     = $(input.artifact!).name
      const receiptPath  = this.getUploadReceiptPath(input)
      const relativePath = $(receiptPath).shortPath
      if (!$(receiptPath).exists()) {
        console.warn(bold(`No receipt:`), `${relativePath}; uploading...`)
        toUpload[i] = input
        continue
      }

      // If there's a local upload receipt and it doesn't contain a code hash, time to reupload.
      const receiptData = $(receiptPath).as(UploadReceipt).load()
      const receiptCodeHash = receiptData.codeHash || receiptData.originalChecksum
      if (!receiptCodeHash) {
        console.warn(bold(`No code hash in receipt:`), `${relativePath}; reuploading...`)
        toUpload[i] = input
        continue
      }

      // If there's a local upload receipt and it contains a different code hash
      // from the one computed earlier, time to reupload.
      if (receiptCodeHash !== input.codeHash) {
        console.warn(bold(`Different code hash from receipt:`), `${relativePath}; reuploading...`)
        toUpload[i] = input
        continue
      }

      // Otherwise reuse the code ID from the receipt.
      outputs[i] = new Template(input, {
        codeId:   String(receiptData.codeId),
        uploadTx: receiptData.transactionHash as string
      })

    }

    // If any contracts are marked for uploading:
    // - upload them and save the receipts
    // - update outputs with data from upload results (containing new code ids)
    if (toUpload.length > 0) {
      const uploaded = await this.uploadManySansCache(toUpload)
      for (const i in uploaded) {
        if (!uploaded[i]) continue // skip empty ones, preserving index
        const receiptName = this.getUploadReceiptName(toUpload[i])
        $(this.cache, receiptName).as(UploadReceipt).save(uploaded[i])
        outputs[i] = uploaded[i] as Template
      }
    } else {
      this.log.info('No artifacts were uploaded.')
    }

    return outputs

  }

  /** Ignores the cache. Supports "holes" in artifact array to preserve order of non-uploads. */
  async uploadManySansCache (inputs: SparseArray<Template>): Promise<SparseArray<Template>> {
    const outputs: SparseArray<Template> = []
    for (const i in inputs) {
      const input = inputs[i]
      if (input?.artifact) {
        const path = $(input.artifact!)
        const data = path.as(Kabinet.BinaryFile).load()
        this.log.info('Uploading', bold(path.shortPath), `(${data.length} bytes uncompressed)`)
        const output = new Template({ ...input, ...await this.agent.upload(data) })
        this.checkLocalCodeHash(input, output)
        outputs[i] = output
      } else {
        outputs[i] = input
      }
    }
    return outputs
  }

  private ensureLocalCodeHash (input: Template): Template {
    if (!input.codeHash) {
      const artifact = $(input.artifact!)
      console.warn('No code hash in artifact', bold(artifact.shortPath))
      try {
        const codeHash = Build.codeHashForPath($(input.artifact!).path)
        console.warn('Computed code hash:', bold(input.codeHash!))
        input = new Template({ ...input,  codeHash })
      } catch (e) {
        console.warn('Could not compute code hash:', e.message)
      }
    }
    return input
  }

  /** Panic if the code hash returned by the upload
    * doesn't match the one specified in the Template. */
  private checkLocalCodeHash (input: Template, output: Template) {
    if (input.codeHash !== output.codeHash) {
      throw new Error(`
        The upload transaction ${output.uploadTx}
        returned code hash ${output.codeHash} (of code id ${output.codeId})
        instead of the expected ${input.codeHash} (of artifact ${input.artifact})
      `.trim().split('\n').map(x=>x.trim()).join(' '))
    }
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

  toTemplate (defaultChainId?: string): Template {
    let { chainId, codeId, codeHash, uploadTx, artifact } = this.load()
    chainId ??= defaultChainId
    codeId  = String(codeId)
    return new Template({ artifact, codeHash, chainId, codeId, uploadTx })
  }

}

/// # Deploy receipts

export class YAMLDeployment extends Deployment {

  constructor (
    path:   string,
    agent?: Agent,
  ) {
    const file = $(path).as(Kabinet.YAMLFile)
    super('', agent)
    this.load()
  }

  file?: Kabinet.YAMLFile<unknown>

  /** Resolve a path relative to the deployment directory. */
  resolve (...fragments: Array<string>) {
    // Expect path to be present
    if (!this.file) throw new Error('Deployment: no path to resolve by')
    return resolve(this.file.path, ...fragments)
  }

  /** Load deployment state from YAML file. */
  load (file?: Kabinet.Path|string) {

    // Expect path to be present
    file ??= this.file
    if (!file) throw new Error('Deployment: no path to load from')

    // Resolve symbolic links
    if (!(typeof file === 'string')) file = file.path
    while (FS.lstatSync(file).isSymbolicLink()) {
      file = resolve(dirname(file), FS.readlinkSync(file))
    }

    // Set own prefix from name of file
    this.prefix = basename(file, extname(file))

    // Load the receipt data
    const data = FS.readFileSync(file, 'utf8')
    const receipts = YAML.loadAll(data) as Client[]
    for (const receipt of receipts) {
      if (!receipt.name) continue
      const [contractName, _version] = receipt.name.split('+')
      this.state[contractName] = receipt
    }

    // TODO: Automatically convert receipts to Client subclasses
    // by means of an identifier shared between the deploy and client libraries
  }

  /** Chainable: Serialize deployment state to YAML file. */
  save (file?: Kabinet.Path|string): this {

    // Expect path to be present
    file ??= this.file
    if (!file) throw new Error('Deployment: no path to save to')
    if (!(typeof file === 'string')) file = file.path

    // Serialize data to multi-document YAML
    let output = ''
    for (let [name, data] of Object.entries(this.state)) {
      output += '---\n'
      const dump = YAML.dump({ ...data, name: data.name ?? name }, { noRefs: true })
      output += Kabinet.alignYAML(dump)
    }

    // Write the data to disk.
    FS.writeFileSync(file, output)
    return this
  }

  set (name: string, data: Partial<Client> & any): this {
    super.set(name, data)
    return this.save()
  }

  setMany (data: Record<string, Client>): this {
    super.setMany(data)
    return this.save()
  }

}

