import { bold } from '@hackbg/konzola'

type valof<T> = T[keyof T]

/** Override only allowed properties. */
export function override (
  strict:    boolean,
  self:      object,
  overrides: object,
  allowed:   string[] = Object.getOwnPropertyNames(self),
): Record<string, valof<typeof overrides>> {
  const filtered: Record<string, valof<typeof overrides>> = {}
  for (const [key, val] of Object.entries(overrides)) {
    if (allowed.includes(key)) {
      const current: typeof val = (self as any)[key]
      if (strict && current && current !== val) {
        throw new Error(`Tried to override pre-defined ${key}`)
      }
      (self as any)[key] = val
    } else {
      (filtered as any)[key] = val
    }
  }
  return filtered
}

/** An object that allows its meaningful properties to be overridden. */
export class Overridable {
  constructor (options: object = {}) {
    override(true, this, options)
  }
  /** Return copy of self with overridden properties. */
  but (options: Partial<Source> = {}) {
    return new (this.constructor as any)(this, options)
  }
}

/** The friendly name of the contract. Used as part of the label. */
export type Name       = string

/** The contract's full unique on-chain label. */
export type Label      = string

/** Allows sources to be specified as strings, URLs, or key-value maps. */
export type IntoSource = string|URL|Partial<Source>

/** Source: a smart contract that exists in source code form and can be compiled. */
export abstract class Source extends Overridable implements Partial<Source> {

  /** Allow Source to be specified from string or URL. */
  static parse (specifier: IntoSource, options: Partial<Source> = {}): Partial<Source> {
    if (typeof specifier === 'string') {
      const [ crate, ref ] = specifier.split('@')
      return { ...options, crate, ref }
    } else if (specifier instanceof URL) {
      return { ...options, repo: specifier }
    } else if (typeof specifier === 'object') {
      return { ...specifier, ...options }
    } else {
      throw new SourceError.Invalid(specifier)
    }
  }

  constructor (
    specifier: IntoSource = {},
    options:   Partial<Source> = {}
  ) {
    super(Source.parse(specifier, options))
  }

  /** URL to local or remote Git repository containing the source code. */
  repo?:    string|URL

  /** Commit hash of source commit. Points to last commit if building from HEAD. */
  commit?:  string

  /** Git ref (branch or tag) pointing to source commit. */
  ref?:     string

  /** Name of crate. Used to find contract crate in workspace repos. */
  crate?:   string

  /** Builder implementation that produces a Template from the Source. */
  builder?: string|Builder

  /** Compile the source using the selected builder. */
  build (builder: typeof this.builder = this.builder): Promise<Template> {
    if (!this.crate) {
      throw new SourceError.NoCrate()
    }
    if (!builder) {
      throw new SourceError.NoBuilder()
    }
    if (typeof builder === 'string') {
      throw new SourceError.ProvideBuilder(builder)
    }
    return builder.build(this)
  }

  at (ref?: string): Source {
    return ref ? this : this.but({ ref })
  }

  toJSON (): Partial<Source> {
    return {
      repo:    this.repo?.toString(),
      commit:  this.commit,
      ref:     this.ref,
      crate:   this.crate,
      builder: (typeof this.builder === 'object') ? this.builder.id : this.builder
    }
  }

}

export class SourceError extends Error {

  static Invalid = class Invalid extends SourceError {
    constructor (specifier: unknown) {
      super(`Can't create source from: ${specifier}`)
    }
  }

  static NoCrate = class NoCrate extends SourceError {
    constructor () {
      super(`No crate specified for building`)
    }
  }

  static NoBuilder = class NoBuilder extends SourceError {
    constructor () {
      super("No builder")
    }
  }

  static ProvideBuilder = class ProvideBuilder extends SourceError {
    constructor (id: string) {
      super(`Provide a "${id}" builder`)
    }
  }

}

/** Populated by @fadroma/build */
export const Builders: Record<string, BuilderCtor> = {}

export type IntoBuilder = string|BuilderCtor|Partial<Builder>

export interface BuilderCtor { new (options?: Partial<Builder>): Builder }

/** Builder: turns `Source` into `Template`, providing `artifact` and `codeHash` */
export abstract class Builder extends Overridable {

  static get (specifier: IntoBuilder = '', options: Partial<Builder> = {}) {
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

  abstract build (source: IntoSource, ...args: any[]): Promise<Template>

  buildMany (sources: IntoSource[], ...args: unknown[]): Promise<Template[]> {
    return Promise.all(sources.map(source=>this.build(source, ...args)))
  }

}

export type IntoTemplate = IntoSource|Partial<Template>

/** Template: contract that is compiled but not deployed.
  * Can be uploaded, and, after uploading, instantiated. */
export class Template extends Source {

  /** Allow Template to be specified from string, URL or Source */
  static parse (specifier: IntoTemplate, options: Partial<Template> = {}): Partial<Template> {
    if (typeof specifier === 'string') {
      const [crate, ref] = specifier.split('@')
      return { ...options, crate, ref }
    } else if (specifier instanceof URL) {
      return { ...options, artifact: specifier }
    } else if (typeof specifier === 'object') {
      return { ...specifier, ...options }
    } else {
      throw new TemplateError.Invalid(specifier)
    }
  }

  constructor (specifier: IntoTemplate = {}, options: Partial<Template> = {}) {
    super(Template.parse(specifier, options))
  }

  /** URL to the compiled code. */
  artifact?:  string|URL

  /** Code hash ensuring immutability of the compiled code. */
  codeHash?:  CodeHash

  /** Object containing upload logic. */
  uploader?:  string|Uploader

  /** ID of chain to which this template is uploaded. */
  chainId?:   ChainId

  /** Code ID representing the identity of the contract's code on a specific chain. */
  codeId?:    CodeId

  /** Hash of transaction that performed the upload. */
  uploadTx?:  TxHash

  /** Upload source code to a chain. */
  upload (uploader: string|Uploader|undefined = this.uploader): Promise<Template> {
    if (!this.artifact) {
      throw new TemplateError.NoArtifact()
    }
    if (!uploader) {
      throw new TemplateError.NoUploader()
    }
    if (typeof uploader === 'string') {
      throw new TemplateError.ProvideUploader(uploader)
    }
    return uploader.upload(this)
  }

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
        throw new TemplateError.NoUploader()
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
      if (!this.artifact) {
        const { artifact, codeHash } = await this.build()
        this.artifact = artifact
        this.codeHash = codeHash
        if (!artifact) {
          throw new TemplateError.NoArtifactURL()
        }
      }
      return await upload()
      throw new TemplateError.NoSource()
    }
  }

  instantiate (agent: Agent, label: string, initMsg: Message): Promise<Instance> {
    return agent.instantiate(this, label, initMsg)
  }

  async instantiate (msg: Message, agent: Executor = this.uploader): Promise<Contract> {
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
      await this.getOrUpload()
      console.info(
        'Deploy   ',    bold(this.name!),
        'from code id', bold(String(this.codeId  ||'(unknown)')),
        'hash',         bold(String(this.codeHash||'(unknown)'))
      )
      const instance = await this.deployment!.init(creator, template, this.name,  msg)
      const client = new this.Client(this.creator, instance)
      console.info(
        'Deployed ',    bold(this.name!), 'is', bold(client.address),
        'from code id', bold(String(template.codeId  ||'(unknown)'))
      )
      return this
    }
  }

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

export class TemplateError extends Error {

  static Invalid = class Invalid extends TemplateError {
    constructor (specifier: unknown) {
      super(`Can't create template from: ${specifier}`)
    }
  }
  static NoArtifact = class TemplateNoArtifact extends TemplateError {
    constructor () {
      super("No code id and no artifact to upload")
    }
  }
  static NoUploader = class TemplateNoUploader extends TemplateError {
    constructor () {
      super("No uploader specified")
    }
  }
  static ProvideUploader = class TemplateNoUploader extends TemplateError {
    constructor (id: string) {
      super(`Provide a "${id}" uploader`)
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
  static NoSource = class TemplateNoSource extends TemplateError {
    constructor () {
      super("No artifact and no source to build")
    }
  }
  static NoArtifactURL = class TemplateNoArtifactURL extends TemplateError {
    constructor () {
      super("Still no artifact URL")
    }
  }
}

/** A code ID, identifying uploaded code on a chain. */
export type CodeId     = string

/** A code hash, verifying the code's integrity. */
export type CodeHash   = string

/** An address on a chain. */
export type Address    = string

/** A transaction message that can be sent to a contract. */
export type Message    = string|Record<string, unknown>

/** Interface for executing read-only, unauthenticated API calls. */
export interface Spectator {

  /** The chain on which this object operates. */
  chain:        Chain

  /** Query a smart contract. */
  query <U>     (contract: Partial<Contract>, msg: Message): Promise<U>

  /** Get the code id of a smart contract. */
  getCodeId     (address: Address):                          Promise<string>

  /** Get the label of a smart contract. */
  getLabel      (address: Address):                          Promise<string>

  /** Get the code hash of a smart contract. */
  getHash       (addressOrCodeId: Address|number):           Promise<string>

  /** Get the code hash of a smart contract. */
  checkHash     (address: Address, codeHash?: CodeHash):     Promise<string>

  /** Get the current block height. */
  get height    ():                                          Promise<number>

  /** Wait for the block height to increment. */
  get nextBlock ():                                          Promise<number>

}

/** A chain can be in one of the following modes: */
export enum ChainMode {
  Mainnet = 'Mainnet',
  Testnet = 'Testnet',
  Devnet  = 'Devnet',
  Mocknet = 'Mocknet'
}

/** The unique ID of a chain. */
export type ChainId = string

/** Represents a particular chain. */
export abstract class Chain implements Spectator {

  static Mode = ChainMode

  constructor (
    readonly id: ChainId,
    options: Partial<ChainOpts> = {}
  ) {
    if (!id) {
      throw new Error('Chain: need to pass chain id')
    }
    this.id   = id
    this.mode = options.mode!
    if (options.url) {
      this.url = options.url
    }
    if (options.node) {
      if (options.mode === Chain.Mode.Devnet) {
        this.node = options.node
        if (this.url !== String(this.node.url)) {
          console.warn(`Fadroma Chain: node.url "${this.node.url}" overrides chain.url "${this.url}"`)
          this.url = String(this.node.url)
        }
        if (this.id !== this.node.chainId) {
          console.warn(`Fadroma Chain: node.id "${this.node.chainId}" overrides chain.id "${this.id}"`)
          this.id = this.node.chainId
        }
      } else {
        console.warn('Chain: "node" option passed to non-devnet. Ignoring')
      }
    }
  }

  isSecretNetwork = false

  /** The API URL to use. */
  readonly url:  string = ''

  /** Whether this is mainnet, public testnet, local devnet, or mocknet. */
  readonly mode: ChainMode

  /** Whether this is a mainnet. */
  get isMainnet () { return this.mode === ChainMode.Mainnet }

  /** Whether this is a testnet. */
  get isTestnet () { return this.mode === ChainMode.Testnet }

  /** Whether this is a devnet. */
  get isDevnet  () { return this.mode === ChainMode.Devnet  }

  /** Whether this is a mocknet. */
  get isMocknet () { return this.mode === ChainMode.Mocknet }

  /** Return self. */
  get chain     () { return this }

  /** If this is a devnet, this contains an interface to the devnet container. */
  readonly node?: DevnetHandle

  /** The default denomination of the chain's native token. */
  abstract defaultDenom: string

  /** Get the native balance of an address. */
  abstract getBalance (denom: string, address: Address): Promise<string>

  abstract query <U> (contract: Contract, msg: Message): Promise<U>

  abstract getCodeId (address: Address): Promise<CodeId>

  abstract getLabel (address: Address): Promise<string>

  abstract getHash (address: Address|number): Promise<CodeHash>

  async checkHash (address: Address, codeHash?: CodeHash) {
    // Soft code hash checking for now
    const realCodeHash = await this.getHash(address)
    if (!codeHash) {
      console.warn(
        'Code hash not provided for address:', address,
        '  Code hash on chain:', realCodeHash
      )
    } if (codeHash !== realCodeHash) {
      console.warn(
        'Code hash mismatch for address:', address,
        '  Expected code hash:',           codeHash,
        '  Code hash on chain:',           realCodeHash
      )
    } else {
      console.info(`Code hash of ${address}:`, realCodeHash)
    }
    return realCodeHash
  }

  abstract get height (): Promise<number>

  get nextBlock (): Promise<number> {
    console.info('Waiting for next block...')
    return new Promise((resolve, reject)=>{
      this.height.then(async startingHeight=>{
        try {
          while (true) {
            await new Promise(ok=>setTimeout(ok, 100))
            const height = await this.height
            if (height > startingHeight) {
              resolve(height)
            }
          }
        } catch (e) {
          reject(e)
        }
      })
    })
  }

  /** Get a new instance of the appropriate Agent subclass. */
  async getAgent <A extends Agent> (
    options: Partial<AgentOpts> = {},
    _Agent:  AgentCtor<Agent> = this.Agent as AgentCtor<Agent>
  ): Promise<A> {
    if (this.node) await this.node.respawn()
    if (!options.mnemonic && options.name) {
      if (this.node) {
        options = await this.node.getGenesisAccount(options.name)
      } else {
        throw new Error('Chain#getAgent: getting agent by name only supported for devnets')
      }
    }
    const agent = await _Agent.create(this, options) as A
    return agent
  }

  static Agent: AgentCtor<Agent>

  /** The Agent subclass to use for interacting with this chain. */
  Agent: AgentCtor<Agent> = (this.constructor as Function & { Agent: AgentCtor<Agent> }).Agent

}

export interface ChainOpts {
  url:  string
  mode: ChainMode
  node: DevnetHandle
}

export interface DevnetHandle {
  chainId: string
  url: URL
  respawn (): Promise<unknown>
  terminate (): Promise<void>
  getGenesisAccount (name: string): Promise<AgentOpts>
}

/** Something that can execute mutating transactions. */
export interface Executor extends Spectator {
  /** The address from which transactions are signed and sent. */
  address:         Address
  /** Default fee maximums for send, upload, init, and execute. */
  fees?:           AgentFees
  /** Send native tokens to 1 recipient. */
  send            (to: Address, amounts: ICoin[], opts?: ExecOpts):    Promise<void|unknown>
  /** Send native tokens to multiple recipients. */
  sendMany        (outputs: [Address, ICoin[]][], opts?: ExecOpts):    Promise<void|unknown>
  /** Upload code, generating a new code id/hash pair. */
  upload          (code: Uint8Array):                                  Promise<void|Template>
  /** Upload multiple pieces of code, generating multiple code id/hash pairs. */
  uploadMany      (code: Uint8Array[]):                                Promise<void|Template[]>
  /** Create a new smart contract from a code id, label and init message. */
  instantiate     (template: Template, label: string, msg: Message):   Promise<void|Contract>
  /** Create multiple smart contracts from a list of code id/label/init message triples. */
  instantiateMany (configs: DeployArgsTriple[]):                       Promise<void|Contract[]>
  /** Call a transaction method on a smart contract. */
  execute         (contract: Contract, msg: Message, opts?: ExecOpts): Promise<void|unknown>
  /** Begin a transaction bundle. */
  bundle          (): Bundle
  /** Get a client instance for talking to a specific smart contract as this executor. */
  getClient <C extends Client, O extends Partial<Contract>> (Client: ClientCtor<C, O>, arg: Address|O): C
}

export type DeployArgsTriple = [Template, Name, Message]

/** Options for a compute transaction. */
export interface ExecOpts {
  /** The maximum fee. */
  fee?:  IFee
  /** A list of native tokens to send alongside the transaction. */
  send?: ICoin[]
  /** A transaction memo. */
  memo?: string
}

/** A 128-bit integer. */
export type Uint128    = string

/** A 256-bit integer. */
export type Uint256    = string

/** A 128-bit decimal fraction. */
export type Decimal    = string

/** A 256-bit decimal fraction. */
export type Decimal256 = string

/** Represents some amount of native token. */
export interface ICoin { amount: Uint128, denom: string }

/** A gas fee, payable in native tokens. */
export interface IFee { amount: readonly ICoin[], gas: Uint128 }

/** Represents some amount of native token. */
export class Coin implements ICoin {
  readonly amount: string
  constructor (amount: number|string, readonly denom: string) {
    this.amount = String(amount)
  }
}

/** A constructable gas fee in native tokens. */
export class Fee implements IFee {
  readonly amount: readonly ICoin[]
  constructor (amount: Uint128|number, denom: string, readonly gas: string = String(amount)) {
    this.amount = [{ amount: String(amount), denom }]
  }
}

/** By authenticating to a network you obtain an Agent,
  * which can perform transactions as the authenticated identity. */
export abstract class Agent implements Executor {

  static create (chain: Chain, options: AgentOpts = {}): Promise<Agent> {
    //@ts-ignore
    return new this(chain, options)
  }

  constructor (readonly chain: Chain, options: AgentOpts = {}) {
    this.chain = chain
    Object.defineProperty(this, 'chain', { enumerable: false })
    if (options.name) this.name = options.name
    if (options.fees) this.fees = options.fees
  }

  /** The address of this agent. */
  address: Address

  /** The friendly name of the agent. */
  name?:   string

  /** Default transaction fees to use for interacting with the chain. */
  fees?:   AgentFees

  /** The default denomination in which the agent operates. */
  get defaultDenom () { return this.chain.defaultDenom }

  /** Get the balance of this or another address. */
  getBalance (denom = this.defaultDenom, address = this.address): Promise<string> {
    if (address) {
      return this.chain.getBalance(denom, address)
    } else {
      throw new Error('Agent#getBalance: what address?')
    }
  }

  /** This agent's balance in the chain's native token. */
  get balance (): Promise<string> { return this.getBalance() }

  /** The chain's current block height. */
  get height (): Promise<number> { return this.chain.height }

  /** Wait until the block height increments. */
  get nextBlock () { return this.chain.nextBlock }

  getCodeId (address: Address) { return this.chain.getCodeId(address) }

  getLabel  (address: Address) { return this.chain.getLabel(address) }

  getHash   (address: Address|number) { return this.chain.getHash(address) }

  checkHash (address: Address, codeHash?: CodeHash) {
    return this.chain.checkHash(address, codeHash)
  }

  getClient <C extends Client, O extends Partial<Contract>> (
    _Client: ClientCtor<C, O>   = Client as ClientCtor<C, O>,
    arg:     Address|Partial<O> = {},
    hash?:   CodeHash
  ): C {
    hash ??= (arg as Partial<O>).codeHash
    return new _Client(this, arg, hash)
  }

  query <R> (contract: Contract, msg: Message): Promise<R> {
    return this.chain.query(contract, msg)
  }

  abstract send     (to: Address, amounts: ICoin[], opts?: ExecOpts): Promise<void|unknown>

  abstract sendMany (outputs: [Address, ICoin[]][], opts?: ExecOpts): Promise<void|unknown>

  abstract upload (blob: Uint8Array): Promise<Template>

  uploadMany (blobs: Uint8Array[] = []): Promise<Template[]> {
    return Promise.all(blobs.map(blob=>this.upload(blob)))
  }

  abstract instantiate <T> (template: Template, label: string, msg: T): Promise<Contract>

  instantiateMany (configs: DeployArgsTriple[] = []): Promise<Contract[]> {
    return Promise.all(configs.map(triple=>this.instantiate(...triple)))
  }

  abstract execute (contract: Contract, msg: Message, opts?: ExecOpts): Promise<void|unknown>

  static Bundle: BundleCtor<Bundle>

  Bundle: BundleCtor<Bundle> = (this.constructor as AgentCtor<typeof this>).Bundle

  bundle (): Bundle {
    //@ts-ignore
    return new this.Bundle(this)
  }

}

export interface AgentCtor<A extends Agent> {
  new    (chain: Chain, options: AgentOpts): A
  create (chain: Chain, options: AgentOpts): Promise<A>
  Bundle: BundleCtor<Bundle>
}

export interface AgentOpts {
  name?:     string
  mnemonic?: string
  address?:  Address
  fees?:     AgentFees
}

export interface AgentFees {
  send?:   IFee
  upload?: IFee
  init?:   IFee
  exec?:   IFee
}

//@ts-ignore
Chain.Agent = Agent as AgentCtor<Agent>

/** Bundle is an alternate executor that collects collects messages to broadcast
  * as a single transaction in order to execute them simultaneously. For that, it
  * uses the API of its parent Agent. You can use it in scripts with:
  *   await agent.bundle().wrap(async bundle=>{ client.as(bundle).exec(...) })
  * */
export abstract class Bundle implements Executor {

  constructor (readonly agent: Agent) {}

  depth  = 0

  Bundle = this.constructor

  bundle (): this {
    console.warn('Nest bundles with care. Depth:', ++this.depth)
    return this
  }

  get chain        () { return this.agent.chain            }

  get address      () { return this.agent.address          }

  get name         () { return `${this.agent.name}@BUNDLE` }

  get fees         () { return this.agent.fees             }

  get defaultDenom () { return this.agent.defaultDenom     }

  getCodeId (address: Address) { return this.agent.getCodeId(address) }

  getLabel  (address: Address) { return this.agent.getLabel(address)  }

  getHash   (address: Address|number) { return this.agent.getHash(address)   }

  checkHash (address: Address, codeHash?: CodeHash) {
    return this.agent.checkHash(address, codeHash)
  }

  get balance () {
    throw new Error("don't query inside bundle")
    return Promise.resolve('0')
  }

  async getBalance (denom: string) {
    throw new Error("can't get balance in bundle")
    return Promise.resolve(denom)
  }

  get height (): Promise<number> {
    throw new Error("don't query block height inside bundle")
  }

  get nextBlock (): Promise<number> {
    throw new Error("can't wait for next block inside bundle")
  }

  async send (to: Address, amounts: ICoin[], opts?: ExecOpts): Promise<void|unknown> {
    throw new Error("Bundle#send: not implemented")
  }

  async sendMany (outputs: [Address, ICoin[]][], opts?: ExecOpts): Promise<void|unknown> {
    throw new Error("Bundle#sendMany: not implemented")
  }

  async instantiate (
    template: Template, label: Label, msg: Message, funds = []
  ): Promise<Instance> {
    const init = {
      sender:   this.address,
      codeId:   String(template.codeId),
      codeHash: template.codeHash,
      label,
      msg,
      funds
    }
    this.add({ init })
    const { codeId, codeHash } = template
    // @ts-ignore
    return { chainId: this.agent.chain.id, codeId, codeHash, address: null }
  }

  async instantiateMany (configs: [Template, Label, Message][]): Promise<Instance[]> {
    return await Promise.all(configs.map(([template, label, initMsg])=>
      this.instantiate(template, label, initMsg)
    ))
  }

  //@ts-ignore
  async execute (instance: Instance, msg: Message, { send }: ExecOpts = {}): Promise<this> {
    this.add({
      exec: {
        sender:   this.address,
        contract: instance.address,
        codeHash: instance.codeHash,
        msg,
        funds: send
      }
    })
    return this
  }

  /** Queries are disallowed in the middle of a bundle because
    * even though the bundle API is structured as multiple function calls,
    * the bundle is ultimately submitted as a single transaction and
    * it doesn't make sense to query state in the middle of that. */
  async query <U> (contract: Contract, msg: Message): Promise<U> {
    throw new Error("don't query inside bundle")
  }

  /** Uploads are disallowed in the middle of a bundle because
    * it's easy to go over the max request size, and
    * difficult to know what that is in advance. */
  //@ts-ignore
  async upload (code: Uint8Array) {
    throw new Error("don't upload inside bundle")
  }

  /** Uploads are disallowed in the middle of a bundle because
    * it's easy to go over the max request size, and
    * difficult to know what that is in advance. */
  //@ts-ignore
  async uploadMany (code: Uint8Array[]) {
    throw new Error("don't upload inside bundle")
  }

  getClient <C extends Client, O extends Instance> (
    Client: ClientCtor<C, O>, arg: Address|O
  ): C {
    return new Client(this as Executor, arg)
  }

  id = 0

  msgs: any[] = []

  add (msg: Message) {
    const id = this.id++
    this.msgs[id] = msg
    return id
  }

  async wrap (
    cb:   BundleCallback<this>,
    opts: ExecOpts = { memo: "" },
    save: boolean  = false
  ): Promise<any[]> {
    await cb(this)
    return this.run(opts.memo, save)
  }

  run (memo = "", save: boolean = false): Promise<any> {
    if (this.depth > 0) {
      console.warn('Unnesting bundle. Depth:', --this.depth)
      this.depth--
      //@ts-ignore
      return null
    } else {
      if (save) {
        return this.save(memo)
      } else {
        return this.submit(memo)
      }
    }
  }

  assertCanSubmit () {
    if (this.msgs.length < 1) throw new Error('Trying to submit bundle with no messages')
  }

  /** Broadcast a bundle to the chain. */
  abstract submit (memo: string): Promise<unknown>

  /** Save a bundle for manual broadcast. */
  abstract save   (name: string): Promise<unknown>

}

export interface BundleCtor<B extends Bundle> {
  new (agent: Agent): B
}

/** Function passed to Bundle#wrap */
export type BundleCallback<B extends Bundle> = (bundle: B)=>Promise<void>

//@ts-ignore
Agent.Bundle = Bundle


/** Populated by @fadroma/deploy */
export const Uploaders: Record<string, Uploader> = {}

/** Uploader: uploads a `Template`'s `artifact` to a specific `Chain`,
  * binding the `Template` to a particular `chainId` and `codeId`. */
export abstract class Uploader implements IUploader {
  constructor (public agent: Agent) {}
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

/** A transaction hash, uniquely identifying an executed transaction on a chain. */
export type TxHash     = string

export type IntoContract = Name|Partial<Contract>

/** Contract: instantiated template.
  * Has an `address` on a specific `chain` and can do the things that it's programmed to. */
export class Contract extends Template {

  static parse (specifier: Address, options: CodeHash): Partial<Contract>
  static parse (specifier: IntoContract, options: IntoContract): Partial<Contract> {
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

  agent?:  Executor

  initTx?: TxHash

  /** Info about the contract that we have so far. */
  value:   Partial<Contract> = {}

  /** Here the Contract pretends to be a Promise. That way,
    * a fully populated Contract is available synchronously if possible,
    * and a ContractSlot can also be awaited to populate itself. */
  then <Y> (
    resolved: (c: Y)=>Y,
    rejected: (e: Error)=>never
  ): Promise<Y> {
    if (!(this.value instanceof this.Client)) throw new ContractError.NotFound2()
    return Promise.resolve(this.value).then(resolved, rejected)
  }

  async deploy (template: IntoTemplate, msg: Message): Promise<this> {
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

  async getOrDeploy (template: IntoTemplate, msg: Message): Promise<this> {
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
  address?: Address

  /** Label of the contract on the chain. */
  label?: string

  async fetchLabel (expected?: CodeHash): Promise<this> {
    this.assertOperational()
    const label = await this.agent!.getLabel(this.address!)
    if (!!expected) this.assertCorrect('label', expected, label)
    this.label = label
    return this
  }

  async fetchCodeHash (expected?: CodeHash): Promise<this> {
    this.assertOperational()
    const codeHash = await this.agent!.getHash(this.address!)
    if (!!expected) this.assertCorrect('codeHash', expected, codeHash)
    this.codeHash = codeHash
    return this
  }

  async fetchCodeId (expected?: CodeHash): Promise<this> {
    this.assertOperational()
    const codeId = await this.agent!.getCodeId(this.address!)
    if (!!expected) this.assertCorrect('codeId', expected, codeId)
    this.codeId = codeId
    return this
  }

  /** Fetch the label, code ID, and code hash from the Chain.
    * You can override this method to populate custom contract info from the chain on your client,
    * e.g. fetch the symbol and decimals of a token contract. */
  async populate (): Promise<this> {
    this.assertOperational()
    await Promise.all([this.fetchLabel(), this.fetchCodeId(), this.fetchCodeHash()])
    return this
  }

  /** The contract represented in Fadroma ICC format (`{address, code_hash}`) */
  get asLink (): ContractLink {
    if (!this.address)  throw new Error("Can't link to contract with no address")
    if (!this.codeHash) throw new Error("Can't link to contract with no code hash")
    return { address: this.address, code_hash: this.codeHash }
  }

  /** Execute a query on the specified contract as the specified Agent. */
  async query <U> (msg: Message): Promise<U> {
    this.assertOperational()
    return await this.agent!.query(this, msg)
  }

  /** Default fee for all contract transactions. */
  fee?: IFee

  /** Default fee for specific transactions. */
  fees: Record<string, IFee> = {}

  /** Get the recommended fee for a specific transaction. */
  getFee (msg?: string|Record<string, unknown>): IFee|undefined {
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
  withFee (fee: IFee|undefined): this {
    const Self = this.constructor as ClientCtor<typeof this, any>
    if (fee) {
      return new Self(this.agent, {...this, fee, fees: {}})
    } else {
      return new Self(this.agent, {...this, fee: this.fee, fees: this.fees})
    }
  }

  /** Execute a transaction on the specified contract as the specified Agent. */
  async execute (msg: Message, opt: ExecOpts = {}): Promise<void|unknown> {
    this.assertOperational()
    opt.fee = opt.fee || this.getFee(msg)
    return await this.agent!.execute(this, msg, opt)
  }

  /** Create a copy of this Client that will execute the transactions as a different Agent. */
  as (agent: Executor): this {
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
  new (agent?: Executor, address?: Address, hash?: CodeHash): C
  new (agent?: Executor, options?: O): C
}

export class Client extends Contract {
  constructor (
    readonly agent?: Executor,
    addrOrOpts: Address|Partial<Contract> = {},
    codeHash?:  CodeHash
  ) {
    console.warn('Fadroma.Client is deprecated. Inherit from Fadroma.Contract')
    if (typeof addrOrOpts === 'string') {
      addrOrOpts = { address: addrOrOpts }
    }
    super({ agent, ...addrOrOpts, codeHash })
  }
}

/** Client constructor - used by functions which create user-specified Clients. */
export interface ClientCtor<C extends Client, O extends Partial<Client>> {
  new (agent?: Executor, address?: Address, hash?: CodeHash): C
  new (agent?: Executor, options?: Partial<O>): C
}

/** Reference to an instantiated smart contract in the format of Fadroma ICC. */
export interface ContractLink {
  readonly address:   Address
  readonly code_hash: CodeHash
}

/** Pair of name and init message. Used when instantiating multiple contracts from one template. */
export type DeployArgs = [Name, Message]

/** Instantiates multiple contracts of the same type in one transaction.
  * For instantiating different types of contracts in 1 tx, see deployment.initVarious */
export class Contracts<C extends Contract> {

  constructor (
    _Contract: ContractCtor<C, any> = Contract as ContractCtor<C, any>,
    public readonly context: DeployContext,
  ) {
    this.Contract = _Contract
  }

  public readonly Contract: ContractCtor<C, any>

  async deployMany (
    template:  IntoTemplate,
    contracts: DeployArgs[] = []
  ): Promise<C[]> {
    if (!this.context.creator)    throw new ContractError.NoCreator()
    if (!this.context.deployment) throw new ContractError.NoDeployment()
    // Provide the template
    template = await new Template(template, this.context).getOrUpload() as Template
    // Deploy multiple contracts from the same template with 1 tx
    let instances: Contract[]
    try {
      const creator = this.context.creator
      instances = await this.context.deployment.initMany(creator, template, contracts)
    } catch (e) {
      throw new ContractError.DeployManyFailed(e)
    }
    // Return API client to each contract
    return instances.map(instance=>this.context.creator!.getClient(this.Contract, instance))
  }
}

/** A moment in time. */
export type Moment   = number

/** A length of time. */
export type Duration = number

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
  static DeployManyFailed = class DeployManyFailed extends ContractError {
    constructor (e: any) {
      //DeployLogger(console).deployManyFailed(e, template, contracts)
      super('Deploy of multiple contracts failed. ' + e?.message??'')
    }
  }
}
