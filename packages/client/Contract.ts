import { bold } from '@hackbg/konzola'
import * as Fadroma from './Core'

type valof<T> = T[keyof T]

export function override (
  strict:    boolean,
  self:      object,
  overrides: object,
  allowed:   string[] = Object.getOwnPropertyNames(self),
): Record<string, valof<typeof overrides>> {
  const filtered = {}
  for (const [key, val] of Object.entries(overrides)) {
    if (allowed.includes(key)) {
      if (strict && self[key] && self[key] !== val) {
        throw new Error(`Tried to override pre-defined ${key}`)
      }
      self[key] = val
    } else {
      filtered[key] = val
    }
  }
  return filtered
}

export class Overridable {
  constructor (options: object = {}) {
    override(true, this, options)
  }
  but (options: ISource = {}) {
    return new (this.constructor as any)(this, options)
  }
}

/** Source: a smart contract that exists in source code form and can be compiled. */
export abstract class Source extends Overridable implements ISource {
  /** Allow Source to be specified from string or URL. */
  static parse (specifier: IntoSource, options: ISource = {}): ISource {
    if (typeof specifier === 'string') {
      return { ...options, crate: specifier }
    } else if (specifier instanceof URL) {
      return { ...options, repo: specifier }
    } else if (typeof specifier === 'object') {
      return { ...specifier, ...options }
    }
  }

  constructor (specifier: IntoSource = {}, options: ISource = {}) {
    super(Source.parse(specifier, options))
  }
  repo?:    URL
  commit?:  string
  ref?:     string
  crate?:   string
  builder?: IBuilder
  build (builder: Builder): Promise<Template> {
    if (typeof builder === 'string') {
      throw new Error(`Template: provide a "${this.builder}" builder`)
    }
    if (!this.crate) {
      throw new Error('Template: no Source to build')
    }
    return builder.build(this)
  }
  at (ref?: string): Source {
    if (!ref) return this
    return this.but({ ref })
  }
  toJSON (): ISource {
    return {
      repo:    this.repo?.toString(),
      commit:  this.commit,
      ref:     this.ref,
      crate:   this.crate,
      builder: this.builder.id
    }
  }
}
export type IntoSource = string|URL|Partial<ISource>
export interface ISource {
  repo?:    string|URL
  commit?:  string
  ref?:     string
  crate?:   string
  builder?: string|IBuilder
}

/** Populated by @fadroma/build */
export const Builders: Record<string, BuilderCtor> = {}
/** Builder: turns `Source` into `Template`, providing `artifact` and `codeHash` */
export abstract class Builder {
  static get (specifier: IntoBuilder, options: Partial<IBuilder> = {}) {
    if (typeof specifier === 'string') {
      const Builder = Builders[specifier]
      if (!Builder) {
        throw new Error(`No "${specifier}" builder installed. Make sure @fadroma/build is imported`)
      }
      return new Builder(options)
    } else if (typeof specifier === 'function') {
      return new (specifier as BuilderCtor)(options)
    } else {
      const Builder = Builders[specifier.id]
      return new Builder({ ...specifier, ...options })
    }
  }
  abstract id: string
  abstract build (source: IntoSource, ...args: any[]): Promise<Template>
  buildMany (sources: IntoSource[], ...args: unknown[]): Promise<Template[]> {
    return Promise.all(sources.map(source=>this.build(source, ...args)))
  }
}
export type IntoBuilder = string|BuilderCtor|Partial<IBuilder>
export interface BuilderCtor { new (options?: Partial<IBuilder>): Builder }
export interface IBuilder {
  id: string
  build: (source: ISource, ...args: any[])=>Promise<{ artifact: URL, codeHash: CodeHash }>
  buildMany (sources: IntoSource[], ...args: unknown[]): Promise<Template[]>
  [name: string]: any
}

/** Template: contract that is compiled but not deployed.
  * Can be uploaded, and, after uploading, instantiated. */
export class Template extends Source implements ITemplate {
  /** Allow Template to be specified from string, URL or Source */
  static parse (options: IntoTemplate): ITemplate {
    if (typeof options === 'string') {
      const [crate, ref] = options.split('@')
      options = { crate, ref }
    } else if (options instanceof URL) {
      options = { artifact: options }
    } else if (options instanceof Source) {
      options = { source: options }
    } else if (typeof options === 'object') {
      return options as ITemplate
    } else {
      throw 'TODO'
    }
  }

  constructor (specifier: IntoTemplate = {}, options: ITemplate = {}) {
    override(true, this, Template.parse(options))
  }

  artifact?:  URL

  /** Code hash ensuring immutability of the compiled code. */
  codeHash?:  Fadroma.CodeHash

  uploader?:  IUploader

  /** ID of chain to which this contract is uploaded. */
  chainId?:   Fadroma.ChainId

  upload (uploader: IUploader = this.uploader): Promise<Template> {
    return uploader.upload(this)
  }

  /** Code ID representing the identity of the contract's code on a specific chain. */
  codeId?:    Fadroma.CodeId

  /** Depending on what pre-Template type we start from, this function
    * invokes builder and uploader to produce a Template from it. */
  async getOrUpload (): Promise<Template> {
    this.chainId ??= this.uploader?.agent?.chain?.id
    if (!this.chainId) {
      throw new TemplateError.NoChainId()
    } else if (this.codeId && this.codeHash) {
      return this
    } else if (this.codeId) {
      this.codeHash ??= await this.uploader?.agent?.getHash(Number(this.codeId))
      if (this.codeHash) {
        return this
      } else {
        throw new TemplateError.NoCodeHash()
      }
    } else {
      if (!this.artifact) {
        throw new TemplateError.NoArtifact()
      }
      if (!this.uploader) {
        throw new TemplateError.NoUploaderPassed()
      }
      const upload = async () => {
        const template = await this.upload()
        this.codeId = template.codeId
        if (this.codeHash && this.codeHash !== template.codeHash) {
          console.warn(`codeHash mismatch: ${this.codeHash} vs ${template.codeHash}`)
        }
        this.codeHash = template.codeHash
        return this
      }
      if (this.artifact.url) {
        return await upload()
      } else if (this.crate) {
        if (!this.builder) throw new TemplateError.NoBuilder()
        this.artifact = await this.build(this.builder)
        if (!this.artifact.url) throw new TemplateError.NoArtifactURL()
        return await upload()
      }
      throw new TemplateError.NoSource()
    }
  }

  instantiate (agent: Agent, label: string, initMsg: Message): Promise<Instance> {
    return agent.instantiate(this, label, initMsg)
  }

  async instantiate (template: IntoTemplate, msg: Message): Promise<this> {
    if (this.task) {
      const value = `deploy ${this.name??'contract'}`
      Object.defineProperty(deployContract, 'name', { value })
      return this.task.subtask(deployContract)
    }
    return await deployContract.bind(this)()
    async function deployContract (this: Contract) {
      const { creator, deployment } = this.context
      if (!deployment) throw new ContractError.NoDeployment()
      if (!this.name)  throw new ContractError.NoName()
      template = await new Template(template, this.context).getOrUpload()
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
      return this
    }
  }
}
export type IntoTemplate = IntoSource|Partial<ITemplate>
export interface ITemplate extends ISource {
  artifact?: string|URL
  codeHash?: Fadroma.CodeHash
  uploader?: string|IUploader
  chainId?:  Fadroma.ChainId
  codeId?:   Fadroma.CodeId
}

/** Multiple different templates that can be uploaded in one invocation.
  * Not uploaded in parallel by default. */
export class Templates {
  constructor (
    slots: IntoTemplate[] = [],
    public readonly context: DeployContext
  ) {
    this.slots = slots.map(value=>new Template(value, context))
  }
  public readonly slots: Template[]
  async getOrUploadMany (): Promise<Template[]> {
    const templates: Template[] = []
    for (const template of this.slots) {
      templates.push(await template.getOrUpload())
    }
    return templates
  }
}

/** Populated by @fadroma/deploy */
export const Uploaders: Record<string, IBuilder> = {}
/** Uploader: uploads a `Template`'s `artifact` to a specific `Chain`,
  * binding the `Template` to a particular `chainId` and `codeId`. */
export abstract class Uploader implements IUploader {
  constructor (public agent: Fadroma.Agent) {}
  get chain () { return this.agent.chain }
  abstract upload     (template: Template):   Promise<Template>
  abstract uploadMany (template: Template[]): Promise<Template[]>
}
export type IntoUploader = string|UploaderCtor|Partial<IUploader>
export interface UploaderCtor {
  new (options?: Partial<IUploader>): Uploader 
}
export interface IUploader {
  upload (template: Template): Promise<Template>
  [name: string]: any
}

/** Contract: instantiated template.
  * Has an `address` on a specific `chain` and can do the things that it's programmed to. */
export interface IContract extends ITemplate {
  address?: Fadroma.Address
  agent?:   string|Fadroma.Executor
}
export type IntoContract = Fadroma.Name|Partial<IContract>
export class Contract extends Template implements IContract {

  static parse (specifier: Fadroma.Address, options: Fadroma.CodeHash): IContract
  static parse (specifier: IntoContract, options: IntoContract): IContract {
    if (typeof specifier === 'string' && typeof options === 'string') {
      return { address: specifier, codeHash: options }
    } else {
      return { ...specifier, ...options }
    }
  }

  constructor (specifier: IntoContract, options: Partial<IContract> = {}) {

    super(Contract.parse(specifier, options))

    // Support the `new Contract(agent, address, codeHash)` signature
    if (typeof options === 'string') {
      options = { address: options, codeHash: hash }
    }

    // Populate properties 
    super(options)

    // Warn if missing agent
    const className = this.constructor.name
    if (!agent) console.warn(
      `Creating ${className} without Agent. Transactions and queries not possible.`
    )

    //if (!value) throw new ContractError.Empty()
    //if (typeof value === 'string') {
      //this.name = value
      //if (!context.deployment) throw new ContractError.CantFind(value)
      //if (context.deployment.has(value)) this.value = context.deployment.get(value)!
    //} else {
      //this.value = value
    //}
    //if (this.value && (this.value as { address: Address }).address) {
      //this.value = new this.Client(context.creator, this.value)
    //}
    //this.context ??= context
    //this.task    ??= task
    //if (typeof arg === 'string') {
      //this.address  = arg
      //this.codeHash = hash
    //} else {
      //this.address  = arg.address!
      //if (!this.address) console.warn(
        //`${className} created with no address. Transactions and queries not possible.`
      //)
      //this.name     = arg.name     ?? this.name
      //this.label    = arg.label    ?? this.label
      //this.codeHash = arg.codeHash ?? this.codeHash ?? hash
      //if (!this.codeHash) console.warn(
        //`${className} created with no code hash. await client.fetchCodeHash() to populate.`
      //)
      //this.codeId   = arg.codeId   ?? this.codeId
      //this.fee      = arg.fee      ?? this.fee
      //this.fees = Object.assign(this.fees||{}, arg.fees||{})
    //}
  }

  /** Friendly name of the contract. Used for looking it up in the deployment. */
  name?:   Name

  Client:  ClientCtor<this, any>

  task?:   DeployTask<unknown>

  agent?:  Agent

  /** Info about the contract that we have so far. */
  value:   Partial<Fadroma.Instance> = {}

  /** Here the Contract pretends to be a Promise. That way,
    * a fully populated Instance is available synchronously if possible,
    * and a ContractSlot can also be awaited to populate itself. */
  then <Y> (
    resolved: (c: Y)=>Y,
    rejected: (e: Error)=>never
  ): Promise<Y> {
    if (!(this.value instanceof this.Client)) throw new ContractError.NotFound2()
    return Promise.resolve(this.value).then(resolved, rejected)
  }

  async deploy (template: IntoTemplate, msg: Fadroma.Message): Promise<this> {
    if (this.task) {
      const value = `deploy ${this.name??'contract'}`
      Object.defineProperty(deployContract, 'name', { value })
      return this.task.subtask(deployContract)
    }
    return await deployContract.bind(this)()
    async function deployContract (this: Contract) {
      const { creator, deployment } = this.context
      if (!deployment) throw new ContractError.NoDeployment()
      if (!this.name)  throw new ContractError.NoName()
      template = await new Template(template, this.context).getOrUpload()
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
      return this
    }
  }

  async getOrDeploy (template: IntoTemplate, msg: Fadroma.Message): Promise<this> {
    if (this.task) {
      const value = `get or deploy ${this.name??'contract'}`
      Object.defineProperty(getOrDeployContract, 'name', { value })
      return this.task.subtask(getOrDeployContract)
    }
    return await getOrDeployContract.bind(this)()
    async function getOrDeployContract (this: Contract) {
      if (this.address) {
        console.info('Found    ', bold(this.name||'(unnamed)'), 'at', bold(this.address))
        return this
      } else if (this.name) {
        if (!this.context.creator)    throw new ContractError.NoCreator()
        if (!this.context.deployment) throw new ContractError.NoDeployment()
        return await this.deploy(template, msg)
      }
      throw new ContractError.InvalidValue()
    }
  }

  async getOr (getter: ()=>this|Promise<this>): Promise<this> {
    if (this.task) {
      const value = `get or provide ${this.name??'contract'}`
      Object.defineProperty(getContractOr, 'name', { value })
      return this.task.subtask(getContractOr)
    }
    return await getContractOr.bind(this)()
    async function getContractOr () {
      return await Promise.resolve(getter())
    }
  }

  get (message: string = `Contract not found: ${this.name}`): this {
    if (this.name && this.deployment && this.deployment.has(this.name)) {
      const instance = this.deployment.get(this.name)
      const client   = new this.Client(this.context.creator, instance!)
      return client
    } else if (this.value) {
      const client = new this.Client(this.context.creator, this.value)
      return client
    } else {
      throw new Error(message)
    }
  }

  /** The Chain on which this contract exists. */
  get chain () { return this.agent?.chain }

  /** Address of the contract on the chain. */
  address: Fadroma.Address

  /** Label of the contract on the chain. */
  label?: string

  async fetchLabel (expected?: Fadroma.CodeHash): Promise<this> {
    this.assertOperational()
    const label = await this.agent!.getLabel(this.address)
    if (!!expected) this.assertCorrect('label', expected, label)
    this.label = label
    return this
  }

  async fetchCodeHash (expected?: Fadroma.CodeHash): Promise<this> {
    this.assertOperational()
    const codeHash = await this.agent!.getHash(this.address)
    if (!!expected) this.assertCorrect('codeHash', expected, codeHash)
    this.codeHash = codeHash
    return this
  }

  async fetchCodeId (expected?: Fadroma.CodeHash): Promise<this> {
    this.assertOperational()
    const codeId = await this.agent!.getCodeId(this.address)
    if (!!expected) this.assertCorrect('codeId', expected, codeId)
    this.codeId = codeId
    return this
  }

  /** Fetch the label, code ID, and code hash from the Chain.
    * You can override this method to populate custom contract info from the chain on your client,
    * e.g. fetch the symbol and decimals of a token contract. */
  async fetchMetadata (): Promise<this> {
    this.assertOperational()
    await Promise.all([
      this.fetchLabel(), this.fetchCodeId(), this.fetchCodeHash()
    ])
    return this
  }

  /** The contract represented in Fadroma ICC format (`{address, code_hash}`) */
  get asLink (): ContractLink {
    if (!this.codeHash) throw new Error("Can't link to contract with no code hash")
    return { address: this.address, code_hash: this.codeHash }
  }

  /** Execute a query on the specified contract as the specified Agent. */
  async query <U> (msg: Fadroma.Message): Promise<U> {
    this.assertOperational()
    return await this.agent!.query(this, msg)
  }

  /** Default fee for all contract transactions. */
  fee?: Fadroma.IFee

  /** Default fee for specific transactions. */
  fees: Record<string, Fadroma.IFee> = {}

  /** Get the recommended fee for a specific transaction. */
  getFee (msg?: string|Record<string, unknown>): Fadroma.IFee|undefined {
    const defaultFee = this.fee || this.agent?.fees?.exec
    if (typeof msg === 'string') {
      return this.fees[msg] || defaultFee
    } else if (typeof msg === 'object') {
      const keys = Object.keys(msg)
      if (keys.length !== 1) {
        throw new Error('Client#getFee: messages must have exactly 1 root key')
      }
      return this.fees[keys[0]] || defaultFee
    }
    return this.fee || defaultFee
  }

  /** Create a copy of this Client with all transaction fees set to the provided value.
    * If the fee is undefined, returns a copy of the client with unmodified fee config. */
  withFee (fee: Fadroma.IFee|undefined): this {
    const Self = this.constructor as ClientCtor<typeof this, any>
    if (fee) {
      return new Self(this.agent, {...this, fee, fees: {}})
    } else {
      return new Self(this.agent, {...this, fee: this.fee, fees: this.fees})
    }
  }

  /** Execute a transaction on the specified contract as the specified Agent. */
  async execute (msg: Fadroma.Message, opt: Fadroma.ExecOpts = {}): Promise<void|unknown> {
    this.assertOperational()
    opt.fee = opt.fee || this.getFee(msg)
    return await this.agent!.execute(this, msg, opt)
  }

  /** Create a copy of this Client that will execute the transactions as a different Agent. */
  as (agent: Fadroma.Executor): this {
    const Self = this.constructor as ClientCtor<typeof this, any>
    return new Self(agent, { ...this })
  }

  /** Throw if trying to do something with no agent or address. */
  assertOperational () {
    const name = this.constructor.name
    if (!this.address) new Error(
      `${name} has no Agent and can't operate. Pass an address with "new ${name}(agent, ...)"`
    )
    if (!this.agent) new Error(
      `${name} has no address and can't operate. Pass an address with "new ${name}(agent, addr)"`
    )
  }

  /** Throw if fetched metadata differs from configured. */
  assertCorrect (kind: string, expected: any, actual: any) {
    const name = this.constructor.name
    if (expected !== actual) {
      throw new Error(`Wrong ${kind}: ${name} was passed ${expected} but fetched ${actual}`)
    }
  }

}

export interface ContractCtor<C extends Contract, O extends Partial<Contract>> {
  new (agent?: Fadroma.Executor, address?: Fadroma.Address, hash?: Fadroma.CodeHash): C
  new (agent?: Fadroma.Executor, options?: O): C
}

export class Client extends Contract {
  constructor (
    readonly agent?: Fadroma.Executor,
    arg:             Fadroma.Address|Partial<Contract> = {},
    hash?:           Fadroma.CodeHash
  ) {
    console.warn('Fadroma.Client is deprecated. Inherit from Fadroma.Contract')
    if (typeof arg === 'string') {
      arg = { address: arg }
    }
    super(agent, arg, hash)
  }
}

/** Client constructor - used by functions which create user-specified Clients. */
export interface ClientCtor<C extends Client, O extends Partial<Contract>> {
  new (agent?: Fadroma.Executor, address?: Fadroma.Address, hash?: Fadroma.CodeHash): C
  new (agent?: Fadroma.Executor, options?: Partial<O>): C
}

/** Reference to an instantiated smart contract in the format of Fadroma ICC. */
export interface ContractLink {
  readonly address:   Fadroma.Address
  readonly code_hash: Fadroma.CodeHash
}

/** Instantiates multiple contracts of the same type in one transaction.
  * For instantiating different types of contracts in 1 tx, see deployment.initVarious */
export class Contracts<C extends Contract> {
  constructor (
    $Client: ClientCtor<C, any> = Client as ClientCtor<C, any>,
    public readonly context: DeployContext,
  ) {
    this.Client = $Client
  }
  public readonly Client: ClientCtor<C, any>
  async deployMany (
    template:  IntoTemplate,
    contracts: DeployArgs[] = []
  ): Promise<C[]> {
    if (!this.context.creator)    throw new ContractError.NoCreator()
    if (!this.context.deployment) throw new ContractError.NoDeployment()
    // Provide the template
    template = await new Template(template, this.context).getOrUpload() as Template
    // Deploy multiple contracts from the same template with 1 tx
    let instances: Fadroma.Instance[]
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

export type DeployArgs       = [Fadroma.Name, Fadroma.Message]
export type DeployArgsTriple = [Template, Fadroma.Name, Fadroma.Message]

export class ContractError extends Error {
  static Empty = class EmptyContractSpec extends ContractError {
    constructor () {
      super("Tried to create ContractSlot with nullish value")
    }
  }
  static CantFind = class CantFindContract extends ContractError {
    constructor (name: string) {
      super(`No deployment, can't find contract by name: ${name}`)
    }
  }
  static NotFound = class ContractNotFound extends ContractError {
    constructor (prefix: string, name: string) {
      super(`Contract ${name} not found in deployment ${prefix}`)
    }
  }
  static NotFound2 = class ContractNotFound2 extends ContractError {
    constructor () {
      super("Contract not found. Try .getOrDeploy(template, init)")
    }
  }
  static NoCreator = class NoContractCreator extends ContractError {
    constructor () {
      super("Missing creator.")
    }
  }
  static NoDeployment = class NoContractDeployment extends ContractError {
    constructor () {
      super("Missing deployment.")
    }
  }
  static InvalidValue = class InvalidContractValue extends ContractError {
    constructor () {
      super("Value is not Client and not a name.")
    }
  }
  static NoName = class NoContractName extends ContractError {
    constructor () {
      super("No name.")
    }
  }
}

export class TemplateError extends Error {
  static NoUploaderPassed = class TemplateNoUploader extends TemplateError {
    constructor () {
      super("Can't pass artifact into template slot with no uploader")
    }
  }
  static NoBuilderPassed = class TemplateNoBuilder extends TemplateError {
    constructor () {
      super("Can't pass artifact into template slot with no builder")
    }
  }
  static NoWorkspacePassed = class TemplateNoWorkspace extends TemplateError {
    constructor () {
      super("Can't pass string into template slot with no workspace")
    }
  }
  static Unsupported = class TemplateUnsupported extends TemplateError {
    constructor (value: any) {
      super(`Template: unsupported value: ${value}`)
    }
  }
  static NoChainId = class TemplateNoChainId extends TemplateError {
    constructor () {
      super("No chain ID specified")
    }
  }
  static NoCodeHash = class TemplateNoChainId extends TemplateError {
    constructor () {
      super("No code hash")
    }
  }
  static NoArtifact = class TemplateNoArtifact extends TemplateError {
    constructor () {
      super("No code id and no artifact to upload")
    }
  }
  static NoSource = class TemplateNoSource extends TemplateError {
    constructor () {
      super("No artifact and no source to build")
    }
  }
  static NoBuilder = class TemplateNoBuilder extends TemplateError {
    constructor () {
      super("No builder")
    }
  }
  static NoArtifactURL = class TemplateNoArtifactURL extends TemplateError {
    constructor () {
      super("Still no artifact URL")
    }
  }
}
