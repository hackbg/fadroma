/*

  Fadroma Deploy System
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
  YAMLDirectory, YAMLFile
} from '@hackbg/kabinet'
import { basename, resolve, dirname, relative, extname } from 'path'
import {
  readFileSync, writeFileSync, readdirSync, lstatSync, existsSync,
  readlinkSync, symlinkSync
} from 'fs'
import {fileURLToPath} from 'url'
import TOML from 'toml'
import YAML from 'js-yaml'
import alignYAML from 'align-yaml'
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
}
/** Get deploy settings from process runtime environment. */
export const getDeployConfig = envConfig(({Str, Bool}, cwd, env): DeployConfig => ({
  ...getBuilderConfig(cwd, env),
  ...getAgentConfig(cwd, env),
  reupload: Bool('FADROMA_REUPLOAD', ()=>false)
}))

/// # UPLOAD RECEIPTS /////////////////////////////////////////////////////////////////////////////

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
  * Deployments are collections of receipts, which represent contracts.
  * To interact with the contract corresponding to a DeployReceipt,
  * first create a Client from it using the **deployment.getClient(name, Client?, agent?)**
  * method, where you can pass a Client subclass class with your the contract's API methods. */
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
  get (name: string, suffix?: string): DeployReceipt {
    const receipt = this.receipts[name]
    if (!receipt) {
      const msg = `@fadroma/ops/Deploy: ${name}: no such contract in deployment`
      throw new Error(msg)
    }
    receipt.name = name
    return receipt
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
    const instance = await agent.instantiate(template, label, msg)
    this.set(name, instance)
    return instance
  }
  /** Instantiate multiple contracts from the same Template with different parameters. */
  async initMany (
    agent: Agent, template: Template, contracts: [Label, Message][] = []
  ): Promise<Instance[]> {
    // this adds just the template - prefix is added in initVarious
    return this.initVarious(agent, contracts.map(([name, msg])=>[template, name, msg]))
  }
  /** Instantiate multiple contracts from different Templates with different parameters. */
  async initVarious (
    agent: Agent = this.agent, contracts: [Template, Label, Message][] = []
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
    const instances = await agent.instantiateMany(initConfigs)
    // Store receipt
    for (const [label, receipt] of Object.entries(instances)) {
      const name = label.slice(this.prefix.length+1)
      this.set(name, { name, ...receipt })
    }
    return Object.values(instances)
  }

  /// ## CREATING AND LOADING DEPLOYMENT //////////////////////////////////////////////////////////

  constructor (
    /** The default identity to use when interacting with this deployment. */
    public readonly agent: Agent,
    /** Path to the file containing the receipts. */
    public readonly path?: string,
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
      output += alignYAML(YAML.dump({ name, ...data }, { noRefs: true }))
    }
    // Write the data to disk.
    writeFileSync(path, output)
    return this
  }
}

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
      ConnectLogger(console).ChainStatus,
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
      DeployLogger(console).Deployment({ deployment })
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

/// # DEPLOY CONTEXT ///////////////////////////////////////////////////////////////////////////////

/** TypeScript made me do it! */
type AgentAndBuildContext = AgentContext & BuildContext
/** Template or a type that can be uploaded. */
export type IntoTemplate = Template|TemplateSlot|Into<Template>|IntoArtifact
/** The thing T, or a function that returns the thing, synchronously or asynchronously. */
export type Into<T> = T|(()=>T)|(()=>Promise<T>)

/** The full list of deployment procedures that open up
  * once you're authenticated and can compile code locally */
export interface DeployContext extends AgentAndBuildContext {
  /** All the environment config so far. */
  config:       ChainConfig & AgentConfig & BuilderConfig & DeployConfig

/// ## DEPLOY CONTEXT: TEMPLATE UPLOAD ////////////////////////////////////////////////////////////

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

/// ## DEPLOY CONTEXT: CONTRACT INSTANTIATION //////////////////////////////////////////////////////

  /** Optional global suffix of all smart contracts deployed.
    * Useful for discerning multiple instanCan be usedces or versions of a contract. */
  suffix?:      string
  /** Currently selected collection of interlinked contracts. */
  deployment:   Deployment|null
  /** Who'll deploy new contracts */
  creator:     Agent
  /** Specify a contract instance. Populate with its get/deploy/getOrDeploy methods. */
  contract            <C extends Client, O extends ClientOpts> (
    reference: Name|Instance, APIClient?: ClientCtor<C, O>
  ): ContractSlot<C>
  /** Get a client interface to a contract. */
  /** Get a contract or fail with a user-defined message. */
  getContract         <C extends Client> (
    reference: Name|Instance, APIClient?: ClientCtor<C, any>, msgOrFn?: StepOrInfo<any, C>,
  ): Promise<C>
  /** Get a contract or deploy it. */
  getOrDeployContract <C extends Client> (
    name: Name, template: IntoTemplate, initMsg: Message, APIClient?: ClientCtor<C, any>
  ): Promise<C>
  /** Deploy a contract and fail if name already taken. */
  deployContract      <C extends Client> (
    name: Name, template: IntoTemplate, initMsg: Message, APIClient?: ClientCtor<C, any>
  ): Promise<C>
  /** Deploy multiple contracts from the same template. */
  deployMany          <C extends Client, O extends ClientOpts> (
    template: IntoTemplate, contracts: [Name, Message][], APIClient?: ClientCtor<C, O>
  ): Promise<C[]>
  /** Deploy multiple different contracts. */
  deployVarious (
    contracts: [IntoTemplate, Name, ClientCtor<Client, ClientOpts>]
  ): Promise<Client[]>
}

/// # DEPLOY CONTEXT FUNCTIONAL IMPLEMENTATION /////////////////////////////////////////////////////

// Now it gets hairy. The deploy/upload context is implemented once as an interface + populator
// function, once as a class partially delegating to it (DeployTask). The two need to be made into
// one entity, so that class-based commands can work without breaking the support for
// function-based commands.

export function getDeployContext (
  context: AgentAndBuildContext & Partial<DeployContext>,
  agent:   Agent = context.agent
): DeployContext {
  context.config         ??= getDeployConfig()
  context.uploadCache    ??= !context.config.reupload
  context.uploader       ??= (!context.isMocknet && context.uploadCache)
    ? CachingFSUploader.fromConfig(agent, context.config.project)
    : new FSUploader(agent)
  context.creator ??= context.agent
  type Fn<T, U> = (...t: T[]) => U
  function needsActiveDeployment <T, U> (fn: Fn<T, U>): Fn<T, U> {
    if (!context.deployment) return () => { throw new Error('Fadroma Ops: no active deployment') }
    return fn
  }
  return {
    ...context,
    config:   context.config,

    /// ## DEPLOY CONTEXT FUNCTIONAL: TEMPLATES ///////////////////////////////////////////////////

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
        code = new Artifact(source, url, codeHash)
      }
      const rel = bold($((code as Artifact).url).shortPath)
      code = await this.uploader.upload(code as Artifact) as Template
      console.info(`Upload ${bold(rel)}:`)
      console.info(`  Code hash:`, bold(code.codeHash))
      console.info(`  Code id:  `, bold(code.codeId))
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

    /// ## DEPLOY CONTEXT FUNCTIONAL: CONTRACTS ///////////////////////////////////////////////////

    creator: context.creator,
    contract <C extends Client> (
      reference: string|{ address: string }, APIClient: ClientCtor<C, any>
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
      name: string, template: IntoTemplate, initMsg: Message,
      APIClient: ClientCtor<C, any> = Client as ClientCtor<C, any>,
    ): Promise<C> {
      return await new ContractSlot(this, name, APIClient).getOrDeploy(template, initMsg)
    },
    async deployContract <C extends Client> (
      name: string,template: IntoTemplate, initMsg: Message,
      APIClient: ClientCtor<C, any> = Client as ClientCtor<C, any>,
    ): Promise<C> {
      return await new ContractSlot(this, name, APIClient).deploy(template, initMsg)
    },
    async deployMany <C extends Client> (
      template: IntoTemplate, contracts: [string, Message][],
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

/// # DEPLOY CONTEXT CLASS-BASED

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

/// # SLOTS ///////////////////////////////////////////////////////////////////////////////////////

export class TemplateSlotX extends Template {
  constructor (
    public readonly value:      string|Source|Artifact|Template,
    public readonly workspace?: Workspace, // for string   -> Source
    public readonly builder?:   Builder,   // for Source   -> Artifact
    public readonly uploader?:  Uploader   // for Artifact -> Template
  ) {
    if (value instanceof Template) {
      super(value.artifact, value.chainId, value.codeId, value.codeHash, value.uploadTx)
    } else if (value instanceof Artifact) {
      if (!uploader) {
        throw new Error("Can't pass artifact into template slot with no uploader")
      }
      super(value, uploader.agent.chain.id, value.codeHash)
    } else if (value instanceof Source) {
      if (!builder || !uploader) {
        throw new Error("Can't pass artifact into template slot with no builder and uploader")
      }
      super(new Artifact(value), uploader.agent.chain.id)
    } else if (typeof value === 'string') {
      if (!workspace || !builder || !uploader) {
        throw new Error("Can't pass string into template slot with no workspace, builder and uploader")
      }
      super(new Artifact(new Source(workspace, value)), uploader.agent.chain.id)
    } else {
      throw new Error(`TemplateSlot: unsupported value: ${value}`)
    }
  }
  /** Here the Template pretends to be a Promise. That way,
    * a fully populated Template is available synchronously,
    * and a TemplateSlot can also be awaited to populate itself. */
  then <Y> (
    resolved: (t: this)=>Y,
    rejected: (e: Error)=>never
  ): Promise<Y> {
    return this.populate().then(resolved, rejected)
  }
  /** Depending on what pre-Template type we start from, this function
    * invokes builder and uploader to produce a Template from it. */
  async populate () {
    if (this.chainId && this.codeId && this.codeHash) {
      return this
    } else {

  }
}


export abstract class Slot<X> extends Lazy<X> {
  constructor () {
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

export class TemplateSlot extends Slot<Template> {
  constructor (
    public readonly context:   UploadContext,
    public readonly reference: IntoTemplate
  ) {
    super()
    if (reference instanceof TemplateSlot) {
      this.value = reference.value
    }
    if (reference instanceof Function) {
      const value = reference()
      if (value instanceof Promise) {
        throw new Error('Passing async functions into TemplateSlot is not supported.')
      }
    }
    if (reference instanceof String) {
      const source = context.getSource(reference)
    }
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
      this.value = this.context.creator?.getClient(APIClient, reference)
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

/// # UPLOADERS (THESE WORK, LEAVE EM ALONE) //////////////////////////////////////////////////////

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
    const templates:         Template[] = []
    const artifactsToUpload: Artifact[] = []
    for (const i in artifacts) {
      const artifact = artifacts[i]
      this.ensureCodeHash(artifact)
      const blobName     = $(artifact.url).name
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
  protected ensureCodeHash (artifact: Artifact) {
    if (!artifact.codeHash) {
      console.warn(
        'No code hash in artifact',
        bold($(artifact.url).shortPath)
      )
      try {
        const codeHash = codeHashForPath($(artifact.url).path)
        Object.assign(artifact, { codeHash })
        console.warn('Computed code hash:', bold(artifact.codeHash!))
      } catch (e) {
        console.warn('Could not compute code hash:', e.message)
      }
    }
  }
}

const codeHashForBlob  = (blob: Uint8Array) => toHex(new Sha256(blob).digest())
const codeHashForPath  = (location: string) => codeHashForBlob(readFileSync(location))
export const addPrefix = (prefix: string, name: string) => `${prefix}/${name}`
export type  Name      = string

//@ts-ignore
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  runOperation('deploy status', 'show deployment status', [
    getAgentContext,  ConnectLogger(console).ChainStatus,
    getDeployContext, ({deployment}) => DeployLogger(console).Deployment(deployment)
  ], process.argv.slice(2))
}
