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
  Builder, Uploader,
  Contract, Client, IntoClient, NewClient,
  Deployment, DeployArgs,
  Name, Label, Message,
  SparseArray, ClientConsole
} from '@fadroma/client'

import { basename, resolve, dirname, relative, extname } from 'path'
import * as FS from 'fs'

import YAML from 'js-yaml'
export { YAML }

export class DeployConfig extends Connect.ConnectConfig {
  constructor (
    readonly env: Konfizi.Env = {},
    readonly cwd: string = '',
    defaults: Partial<DeployConfig> = {}
  ) {
    super(env, cwd)
    this.override(defaults)
  }
  /** Project root. Defaults to current working directory. */
  project:  string  = this.getString ('FADROMA_PROJECT',  ()=>this.cwd)
  /** Whether to always upload contracts, ignoring upload receipts that match. */
  reupload: boolean = this.getBoolean('FADROMA_REUPLOAD', () => false)
  /** Whether to generate unsigned transactions for manual multisig signing. */
  multisig: boolean = this.getBoolean('FADROMA_MULTISIG', () => false)
}

export class DeployConsole extends ClientConsole {

  name = 'Fadroma Deploy'

  deployment = ({ deployment }: { deployment: Deployment }) => {
    if (deployment) {
      const { state = {}, name } = deployment
      let contracts: string|number = Object.values(state).length
      contracts = contracts === 0 ? `(empty)` : `(${contracts} contracts)`
      const len = Math.min(40, Object.keys(state).reduce((x,r)=>Math.max(x,r.length),0))
      this.info('│ Active deployment:'.padEnd(len+2), bold($(deployment.name).shortPath), contracts)
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

  receipt = (name: string, receipt: any, len = 35) => {
    name = bold(name.padEnd(len))
    if (receipt.address) {
      const address = `${receipt.address}`.padStart(45)
      const codeId  = String(receipt.codeId||'n/a').padStart(6)
      this.info('│', name, address, codeId)
    } else {
      this.warn('│ (non-standard receipt)'.padStart(45), 'n/a'.padEnd(6), name)
    }
  }

  warnNoDeployment = () => this.warn(
    'No active deployment. Most commands will fail. ' +
    'You can create a deployment using `fadroma-deploy new` ' +
    'or select a deployment using `fadroma-deploy select` ' +
    'among the ones listed by `fadroma-deploy list`.'
  )

  warnNoAgent = () => this.warn(
    'No agent. Authenticate by exporting FADROMA_MNEMONIC in your shell.'
  )

  warnNoDeployAgent = () => this.warn(
    'No deploy agent. Deployments will not be possible.'
  )

}

/// # Deploy commands

/** Command runner. Instantiate one in your script then use the
  * **.command(name, info, ...steps)**. Export it as default and
  * run the script with `npm exec fadroma my-script.ts` for a CLI. */
export class DeployCommands extends Deployment {

  static async init (
    options: DeployConfig|Partial<DeployConfig> = {},
    build?:  Build.BuildCommands
  ) {
    const name = 'deploy'
    const config = new DeployConfig(process.env, process.cwd(), options) as DeployConfig
    const { chain, agent } = await Connect.connect(options)
    if (!agent) new DeployConsole(console, 'Fadroma Deploy').warnNoAgent()
    const deployments = chain ? Deployments.init(chain.id, config.project) : null
    return new this({ name, config, chain, agent, build, deployments })
  }

  log = new DeployConsole(console, 'Fadroma.DeployCommands')

  constructor (options: Partial<DeployCommands> = {}) {
    super(options as Partial<Deployment>)
    if (!this.agent) this.log.warnNoDeployAgent()
    this.config      = options.config ?? new DeployConfig(process.env, process.cwd())
    this.build       = options.build
    this.deployments = options.deployments ?? null
    this
      .command('list',    'print a list of all deployments', this.list)
      .command('select',  'select a new active deployment',  this.select)
      .command('new',     'create a new empty deployment',   this.create)
      .command('status',  'show the current deployment',     this.status)
      .command('nothing', 'check that the script runs', () => this.log.info('So far so good'))
    // Populate the uploader
    this.uploader = FSUploader.fromConfig(this.agent!, this.build?.config?.project)
  }

  build?:      Build.BuildCommands

  config:      DeployConfig

  uploader?:   Uploader

  /** All available deployments for the current chain. */
  deployments: Deployments|null = null

  /** Currently selected deployment. */
  deployment:  Deployment|null  = this.deployments?.active || null

  /** Print a list of deployments on the selected chain. */
  list = async (): Promise<void> => {
    const deployments = this.expectEnabled()
    const { chain = { id: '(unspecified)' } } = this
    const list = deployments.list()
    if (list.length > 0) {
      this.log.info(`Deployments on chain ${bold(chain.id)}:`)
      for (let name of list) {
        if (name === deployments.KEY) continue
        const deployment = deployments.get(name)!
        const count = Object.keys(deployment.state).length
        let info = `${bold(name)}`
        if (deployments.active && deployments.active.name === name) info = `${bold(name)} (selected)`
        info = `${info} (${deployment.size} contracts)`
        this.log.info(` `, info)
      }
    } else {
      this.log.info(`No deployments on chain`, bold(chain.id))
    }
  }

  /** Make a new deployment the active one. */
  select = async (id?: string): Promise<void> => {
    const deployments = this.expectEnabled()
    const list = deployments.list()
    if (list.length < 1) {
      this.log.info('\nNo deployments. Create one with `deploy new`')
    }
    if (id) {
      this.log.info(bold(`Selecting deployment:`), id)
      await deployments.select(id)
    }
    if (list.length > 0) {
      this.list()
    }
    if (deployments.active) {
      this.log.info(`Currently selected deployment:`, bold(deployments.active.name))
    } else {
      this.log.info(`No selected deployment.`)
    }
  }

  /** Create a new deployment and add it to the command context. */
  create = async (name: string = this.timestamp): Promise<void> => {
    const deployments = this.expectEnabled()
    await deployments?.create(name)
    await deployments?.select(name)
  }

  /** Print the status of a deployment. */
  status = async (id?: string): Promise<void> => {
    const deployments = this.expectEnabled()
    const deployment  = id ? deployments.get(id) : deployments.active
    if (deployment) {
      this.log.deployment({ deployment })
    } else {
      this.log.info('No selected deployment on chain:', bold(this.chain?.id??'(no chain)'))
    }
  }

  private expectEnabled = (): Deployments => {
    if (!(this.deployments instanceof Deployments)) {
      //this.log.error('context.deployments was not populated')
      //this.log.log(context)
      throw new Error('Deployments were not enabled')
    }
    return this.deployments
  }

}

/** Directory containing deploy receipts, e.g. `receipts/$CHAIN/deployments`.
  * Each deployment is represented by 1 multi-document YAML file, where every
  * document is delimited by the `\n---\n` separator and represents a deployed
  * smart contract. */
export class Deployments extends Kabinet.YAMLDirectory<Client[]> {

  /** Get a Path instance for `$projectRoot/receipts/$chainId/deployments`
    * and convert it to a Deployments instance. See: @hackbg/kabinet */
  static init = (chainId: string, projectRoot: string) =>
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
    return new YAMLDeployment(path.path)
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
    if (!FS.existsSync(path)) return null
    return new YAMLDeployment(path)
  }

  /** List the deployments in the deployments directory. */
  list () {
    if (!FS.existsSync(this.path)) return []
    return FS.readdirSync(this.path)
      .filter(x=>x!=this.KEY)
      .filter(x=>x.endsWith('.yml'))
      .map(x=>basename(x,'.yml'))
  }

  /** DEPRECATED: Save some extra data into the deployments directory. */
  save <D> (name: string, data: D) {
    const file = this.at(`${name}.json`).as(Kabinet.JSONFile) as Kabinet.JSONFile<D>
    //this.log.info('Deployments writing:', bold(file.shortPath))
    return file.save(data)
  }

}

export class YAMLDeployment extends Deployment {

  constructor (
    path?:  string,
    agent?: Agent,
  ) {
    if (path) {
      const file = $(path).as(Kabinet.YAMLFile)
      super({ name: file.name, agent })
      this.file = file
      this.load()
    } else {
      super({ agent })
    }
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

    // Load the receipt data
    const data = FS.readFileSync(file, 'utf8')
    const receipts = YAML.loadAll(data) as Partial<Contract<any>>[]
    for (const receipt of receipts) {
      if (!receipt.name) continue
      const [contractName, _version] = receipt.name.split('+')
      this.state[contractName] = new Contract(receipt)
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
      name ??= data.name!
      if (!name) throw new Error('Deployment: no name')
      data = JSON.parse(JSON.stringify({ ...data, name, deployment: undefined }))
      const dump = YAML.dump(data, { noRefs: true })
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

const bold = Konzola.bold

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
  async upload (template: Contract<any>): Promise<Contract<any>> {
    console.trace(template)
    let receipt: UploadReceipt|null = null
    if (this.cache) {
      const name = this.getUploadReceiptName(template)
      receipt = this.cache.at(name).as(UploadReceipt)
      if (receipt.exists()) {
        this.log.info('Reuse    ', bold(this.cache.at(name).shortPath))
        return receipt.toContract()
      }
    }
    if (!template.artifact) {
      throw new Error('No artifact specified in template')
    }
    const data = $(template.artifact).as(Kabinet.BinaryFile).load()
    const result = await this.agent.upload(data)
    if (template.codeHash && result.codeHash && template.codeHash !== result.codeHash) {
      throw new Error(
        `Code hash mismatch when uploading ${template.artifact?.toString()}: ` +
        `${template.codeHash} vs ${result.codeHash}`
      )
    }
    template = new Contract(template, result)
    if (receipt) {
      receipt.save(template)
    }
    //await this.agent.nextBlock
    return template
  }

  getUploadReceiptName (template: Contract<any>): string {
    return `${$(template.artifact!).name}.json`
  }

  getUploadReceiptPath (template: Contract<any>): string {
    const receiptName = `${this.getUploadReceiptName(template)}`
    const receiptPath = this.cache!.resolve(receiptName)
    return receiptPath
  }

  /** Upload multiple templates from the filesystem.
    * TODO: Optionally bundle multiple templates in one transaction,
    * if they add up to less than the max API request size (which is defined... where?) */
  async uploadMany (inputs: SparseArray<Contract<any>>): Promise<SparseArray<Contract<any>>> {

    if (!this.cache) return this.uploadManySansCache(inputs)

    const outputs:  Contract<any>[] = []
    const toUpload: Contract<any>[] = []

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
        this.log.warn(bold(`No receipt:`), `${relativePath}; uploading...`)
        toUpload[i] = input
        continue
      }

      // If there's a local upload receipt and it doesn't contain a code hash, time to reupload.
      const receiptData = $(receiptPath).as(UploadReceipt).load()
      const receiptCodeHash = receiptData.codeHash || receiptData.originalChecksum
      if (!receiptCodeHash) {
        this.log.warn(bold(`No code hash in receipt:`), `${relativePath}; reuploading...`)
        toUpload[i] = input
        continue
      }

      // If there's a local upload receipt and it contains a different code hash
      // from the one computed earlier, time to reupload.
      if (receiptCodeHash !== input.codeHash) {
        this.log.warn(bold(`Different code hash from receipt:`), `${relativePath}; reuploading...`)
        toUpload[i] = input
        continue
      }

      // Otherwise reuse the code ID from the receipt.
      outputs[i] = new Contract(input, {
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
        outputs[i] = uploaded[i] as Contract<any>
      }
    } else {
      this.log.info('No artifacts were uploaded.')
    }

    return outputs

  }

  /** Ignores the cache. Supports "holes" in artifact array to preserve order of non-uploads. */
  async uploadManySansCache (inputs: SparseArray<Contract<any>>): Promise<SparseArray<Contract<any>>> {
    const outputs: SparseArray<Contract<any>> = []
    for (const i in inputs) {
      const input = inputs[i]
      if (input?.artifact) {
        const path = $(input.artifact!)
        const data = path.as(Kabinet.BinaryFile).load()
        this.log.info('Uploading', bold(path.shortPath), `(${data.length} bytes uncompressed)`)
        const output = new Contract({ ...input, ...await this.agent.upload(data) })
        this.checkLocalCodeHash(input, output)
        outputs[i] = output
      } else {
        outputs[i] = input
      }
    }
    return outputs
  }

  private ensureLocalCodeHash (input: Contract<any>): Contract<any> {
    if (!input.codeHash) {
      const artifact = $(input.artifact!)
      this.log.warn('No code hash in artifact', bold(artifact.shortPath))
      try {
        const codeHash = Build.codeHashForPath($(input.artifact!).path)
        this.log.warn('Computed code hash:', bold(input.codeHash!))
        input = new Contract({ ...input,  codeHash })
      } catch (e: any) {
        this.log.warn('Could not compute code hash:', e.message)
      }
    }
    return input
  }

  /** Panic if the code hash returned by the upload
    * doesn't match the one specified in the Contract. */
  private checkLocalCodeHash (input: Contract<any>, output: Contract<any>) {
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

/** Class that convert itself to a Contract, from which contracts can be instantiated. */
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

  toContract (defaultChainId?: string) {
    let { chainId, codeId, codeHash, uploadTx, artifact } = this.load()
    chainId ??= defaultChainId
    codeId  = String(codeId)
    return new Contract({ artifact, codeHash, chainId, codeId, uploadTx })
  }

}

export default DeployCommands.init
