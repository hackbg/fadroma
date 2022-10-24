import { Task } from '@hackbg/komandi'
import { ClientError, ClientConsole } from './client-events'
import { Metadata, validated, override, hide, into, intoArray, intoRecord } from './client-fields'
import type { Class, Into, IntoArray, IntoRecord } from './client-fields'
import { assertAddress, assertAgent } from './client-connect'
import type { ChainId, Address, TxHash, Agent, Message, IFee, ExecOpts } from './client-connect'
import type { Deployment } from './client-deploy'
import type { Buildable } from './client-build'
import { Builder, assertBuilder } from './client-build'
import type { Uploadable } from './client-upload'
import { Uploader, upload } from './client-upload'
import { Hashed, codeHashOf, assertCodeHash } from './client-code'
import type { CodeId, CodeHash } from './client-code'
import type { Name, Label, StructuredLabel } from './client-labels'

/** Base class for contract lifecycle object. */
export class ContractMetadata extends Metadata {
  log = new ClientConsole(this.constructor.name)
  constructor (options: Partial<ContractSource> = {}) {
    super(options)
    this.define(options as object)
  }
  /** Copy the data from this object into a new ContractSource.
    * @returns a new ContractSource with data from this object. */
  get asSource (): ContractSource {
    return new ContractSource(this)
  }
  /** Copy the data from this object into a new ContractTemplate.
    * @returns a new ContractTemplate with data from this object. */
  get asTemplate (): ContractTemplate {
    return new ContractTemplate(this)
  }
  /** Copy the data from this object into a new ContractInstance.
    * @returns a new ContractInstance with data from this object. */
  get asInstance (): ContractInstance {
    return new ContractInstance(this)
  }
  /** Define a subtask.
    * @returns A lazily-evaluated Promise. */
  task <T extends this, U> (name: string, cb: (this: T)=>PromiseLike<U>): Task<T, U> {
    const task = new Task(name, cb, this as unknown as T)
    const [_, head, ...body] = (task.stack ?? '').split('\n')
    task.stack = '\n' + head + '\n' + body.slice(3).join('\n')
    task.log = this.log ?? task.log
    return task as Task<T, U>
  }
}

/** Contract lifecycle object. Represents a smart contract's lifecycle from source to binary. */
export class ContractSource extends ContractMetadata {
  /** URL pointing to Git repository containing the source code. */
  repository?: string|URL = undefined
  /** Branch/tag pointing to the source commit. */
  revision?:   string     = undefined
  /** Whether there were any uncommitted changes at build time. */
  dirty?:      boolean    = undefined
  /** Path to local Cargo workspace. */
  workspace?:  string     = undefined
  /** Name of crate in workspace. */
  crate?:      string     = undefined
  /** List of crate features to enable during build. */
  features?:   string[]   = undefined
  /** Build procedure implementation. */
  builder?:    Builder    = undefined
  /** Builder implementation that produces a Contract from the Source. */
  builderId?:  string     = undefined
  /** URL to the compiled code. */
  artifact?:   string|URL = undefined
  /** Code hash uniquely identifying the compiled code. */
  codeHash?:   CodeHash   = undefined

  constructor (options: Partial<ContractSource> = {}) {
    super(options)
    this.define(options as object)
  }

  get compiled (): Promise<ContractSource> {
    if (this.artifact) return Promise.resolve(this)
    return this.build()
  }

  /** Compile the source using the selected builder.
    * @returns this */
  build (builder?: Builder): Promise<ContractSource> {
    return this.task(`compile ${this.crate ?? 'contract'}`, async () => {
      builder ??= assertBuilder(this)
      const result = await builder!.build(this.asSource as Buildable)
      this.define(result as Partial<this>)
      return this.asSource
    })
  }

  /** Upload compiled source code to the selected chain.
    * @returns task performing the upload */
  async upload (uploader?: Uploader): Promise<ContractTemplate> {
    return this.task(`upload ${this.artifact ?? this.crate ?? 'contract'}`, async () => {
      await this.compiled
      const result = await upload(this.asTemplate as Uploadable, uploader, uploader?.agent)
      return this.asTemplate.define(result)
    })
  }

  /** @returns the data for saving a build receipt. */
  get asReceipt (): Partial<this> {
    return {
      repository: this.repository,
      revision:   this.revision,
      dirty:      this.dirty,
      workspace:  this.workspace,
      crate:      this.crate,
      features:   this.features?.join(', '),
      builder:    undefined,
      builderId:  this.builder?.id,
      artifact:   this.artifact?.toString(),
      codeHash:   this.codeHash
    } as Partial<this>
  }
}

/** Contract lifecycle object. Represents a smart contract's lifecycle from source to upload. */
export class ContractTemplate extends ContractSource {
  /** ID of chain on which this contract is uploaded. */
  chainId?:    ChainId  = undefined
  /** Object containing upload logic. */
  uploaderId?: string   = undefined
  /** Upload procedure implementation. */
  uploader?:   Uploader = undefined
  /** Address of agent that performed the upload. */
  uploadBy?:   Address  = undefined
  /** TXID of transaction that performed the upload. */
  uploadTx?:   TxHash   = undefined
  /** Code ID representing the identity of the contract's code on a specific chain. */
  codeId?:     CodeId   = undefined
  /** The Client subclass that exposes the contract's methods.
    * @default the base Client class. */
  client?:     ClientClass<Client> = Client

  constructor (options: Partial<ContractTemplate> = {}) {
    super(options)
    this.define(options as object)
  }

  /** One-shot deployment task. */
  get uploaded (): Promise<ContractTemplate> {
    if (this.codeId) return Promise.resolve(this)
    const uploading = this.upload()
    Object.defineProperty(this, 'uploaded', { get () { return uploading } })
    return uploading
  }

  instance (options: Partial<ContractInstance>): ContractInstance {
    return new ContractInstance(this).define(options)
  }

  instances <C extends Client> (inputs: Record<Name, Partial<ContractInstance>>):
    Record<Name, ContractInstance>
  {
    return Object.fromEntries(Object.entries(inputs).map(
      ([name, options])=>[name, new ContractInstance(this).define(options)]))
  }

  /** Uploaded templates can be passed to factory contracts in this format. */
  get asInfo (): ContractInfo {
    if (!this.codeId || isNaN(Number(this.codeId)) || !this.codeHash) {
      throw new ClientError.Unpopulated()
    }
    return templateStruct(this)
  }

  /** @returns the data for saving an upload receipt. */
  get asReceipt (): Partial<this> {
    return {
      ...super.asReceipt,
      chainId:    this.chainId,
      uploaderId: this.uploader?.id,
      uploader:   undefined,
      uploadBy:   this.uploadBy,
      uploadTx:   this.uploadTx,
      codeId:     this.codeId
    } as Partial<this>
  }
}

/** Factory contracts may accept contract templates in this format. */
export interface ContractInfo {
  id:        number,
  code_hash: string
}

/** Create a ContractInfo from compatible objects. */
export const templateStruct = (template: Hashed & { codeId?: CodeId }): ContractInfo => ({
  id:        Number(template.codeId),
  code_hash: codeHashOf(template)
})

/** Represents a smart contract's lifecycle from source to individual instance. */
export class ContractInstance extends ContractTemplate implements StructuredLabel {
  /** Address of agent that performed the init tx. */
  initBy?:  Address             = undefined
  /** Address of agent that performed the init tx. */
  initMsg?: Into<Message>       = undefined
  /** TXID of transaction that performed the init. */
  initTx?:  TxHash              = undefined
  /** Address of this contract instance. Unique per chain. */
  address?: Address             = undefined
  /** Full label of the instance. Unique for a given Chain. */
  label?:   Label               = undefined
  /** Prefix of the instance.
    * Identifies which Deployment the instance belongs to, if any.
    * Prepended to contract label with a `/`: `PREFIX/NAME...` */
  prefix?:  Name                = undefined
  /** Proper name of the instance.
    * If the instance is not part of a Deployment, this is equal to the label.
    * If the instance is part of a Deployment, this is used as storage key.
    * You are encouraged to store application-specific versioning info in this field. */
  name?:    Name                = undefined
  /** Deduplication suffix.
    * Appended to the contract label with a `+`: `...NAME+SUFFIX`.
    * This field has sometimes been used to redeploy an new instance
    * within the same Deployment, taking the place of the old one.
    * TODO: implement this field's semantics: last result of **alphanumeric** sort of suffixes
    *       is "the real one" (see https://stackoverflow.com/a/54427214. */
  suffix?:  Name                = undefined

  constructor (options: Partial<ContractInstance> = {}) {
    super(options)
    this.define(options as object)
  }

  get [Symbol.toStringTag]() {
    return `${this.name??'-'} ${this.address??'-'} ${this.crate??'-'} @ ${this.revision??'HEAD'}`
  }

  /** Get link to this contract in Fadroma ICC format. */
  get asLink (): ContractLink {
    return { address: assertAddress(this), code_hash: assertCodeHash(this) }
  }

  /** @returns the data for saving a deploy receipt */
  get asReceipt (): Partial<this> {
    return {
      ...super.asReceipt,
      initBy:  this.initBy,
      initMsg: this.initMsg,
      initTx:  this.initTx,
      address: this.address,
      label:   this.label,
      prefix:  this.prefix,
      name:    this.name,
      suffix:  this.suffix
    } as Partial<this>
  }

  /** Async wrapper around getClientSync.
    * @returns a Client instance pointing to this contract
    * @throws if the contract address could not be determined */
  getClient <C extends Client> (
    $Client: ClientClass<C>|undefined = this.client as ClientClass<C>
  ): Promise<C> {
    return Promise.resolve(this.getClientSync($Client))
  }
  /** @returns a Client instance pointing to this contract
    * @throws if the contract address could not be determined */
  getClientSync <C extends Client> (
    $Client: ClientClass<C>|undefined = this.client as ClientClass<C>
  ): C {
    const client = this.getClientOrNull($Client)
    if (!client) throw new ClientError.NotFound($Client.name, this.name)
    return client
  }
  /** @returns a Client instance pointing to this contract, or null if
    * the contract address could not be determined */
  getClientOrNull <C extends Client> (
    $Client: ClientClass<C>|undefined = this.client as ClientClass<C>,
    agent?:  Agent
  ): C|null {
    if (!this.address) return null
    return new $Client(agent, this.address, this.codeHash, this) as C
  }
}

/** Convert Fadroma.Instance to address/hash struct (ContractLink) */
export const linkStruct = (instance: IntoLink): ContractLink => ({
  address:   assertAddress(instance),
  code_hash: codeHashOf(instance)
})

/** Objects that have an address and code hash.
  * Pass to linkTuple or linkStruct to get either format of link. */
export interface IntoLink extends Hashed {
  address: Address
}

/** Reference to an instantiated smart contract,
  * in the format of Fadroma ICC. */
export interface ContractLink {
  readonly address:   Address
  readonly code_hash: CodeHash
}

export interface ContractDeployer<C> extends PromiseLike<C> {
  /** The group of contracts that contract belongs to. */
  context?: Deployment
  /** The agent that will upload and instantiate this contract. */
  agent?:   Agent
}

/** A constructor for a Client subclass. */
export interface ClientClass<C extends Client> extends Class<C, ConstructorParameters<typeof Client>>{
  new (...args: ConstructorParameters<typeof Client>): C
}

/** Client: interface to the API of a particular contract instance.
  * Has an `address` on a specific `chain`, usually also an `agent`.
  * Subclass this to add the contract's methods. */
export class Client {

  constructor (
    /** Agent that will interact with the contract. */
    public agent?:    Agent,
    /** Address of the contract on the chain. */
    public address?:  Address,
    /** Code hash confirming the contract's integrity. */
    public codeHash?: CodeHash,
    /** Contract class containing deployment metadata. */
    public meta:      ContractInstance = new ContractInstance()
  ) {
    Object.defineProperty(this, 'log', { writable: true, enumerable: false })
    Object.defineProperty(this, 'context', { writable: true, enumerable: false })
    meta.address  ??= address
    meta.codeHash ??= codeHash
    meta.chainId  ??= agent?.chain?.id
    //if (!agent)    this.log.warnNoAgent(this.constructor.name)
    //if (!address)  this.log.warnNoAddress(this.constructor.name)
    //if (!codeHash) this.log.warnNoCodeHash(this.constructor.name)
  }

  /** Logger. */
  log = new ClientConsole('Fadroma.Client')
  /** Default fee for all contract transactions. */
  fee?: IFee = undefined
  /** Default fee for specific transactions. */
  fees?: Record<string, IFee> = undefined
  /** The chain on which this contract exists. */
  get chain () { return this.agent?.chain }
  /** Throw if fetched metadata differs from configured. */
  protected validate (kind: string, expected: any, actual: any) {
    const name = this.constructor.name
    if (expected !== actual) throw new ClientError.ValidationFailed(kind, name, expected, actual)
  }
  /** Fetch code hash from address. */
  async fetchCodeHash (expected: CodeHash|undefined = this.codeHash): Promise<this> {
    const codeHash = await assertAgent(this).getHash(assertAddress(this))
    return Object.assign(this, { codeHash: validated('codeHash', codeHash, expected) })
  }
  /** Legacy, use fetchCodeHash instead. */
  async populate (): Promise<this> {
    return await this.fetchCodeHash()
  }
  /** The contract represented in Fadroma ICC format (`{address, code_hash}`) */
  get asLink (): ContractLink {
    return this.meta.asLink
  }
  get asInfo (): ContractInfo {
    return this.meta.asInfo
  }
  /** Create a copy of this Client that will execute the transactions as a different Agent. */
  as (agent: Agent|undefined = this.agent): this {
    if (!agent || agent === this.agent) return this
    const Client = this.constructor as ClientClass<typeof this>
    return new Client(agent, this.address, this.codeHash) as this
  }
  /** Creates another Client instance pointing to the same contract. */
  asClient <C extends Client> (client: ClientClass<C>): C {
    return new client(this.agent, this.address, this.codeHash, this.meta) as C
  }
  /** Execute a query on the specified contract as the specified Agent. */
  query <U> (msg: Message): Promise<U> {
    return assertAgent(this).query(this, msg)
  }
  /** Get the recommended fee for a specific transaction. */
  getFee (msg?: string|Record<string, unknown>): IFee|undefined {
    const fees       = this.fees ?? {}
    const defaultFee = this.fee ?? this.agent?.fees?.exec
    if (typeof msg === 'string') {
      return fees[msg] || defaultFee
    } else if (typeof msg === 'object') {
      const keys = Object.keys(msg)
      if (keys.length !== 1) throw new ClientError.InvalidMessage()
      return fees[keys[0]] || defaultFee
    }
    return this.fee || defaultFee
  }
  /** Use the specified fee for all transactions by this Client. */
  withFee (fee: IFee): this {
    this.fee  = fee
    this.fees = {}
    return this
  }
  /** Execute a transaction on the specified contract as the specified Agent. */
  async execute (msg: Message, opt: ExecOpts = {}): Promise<void|unknown> {
    assertAddress(this)
    opt.fee = opt.fee || this.getFee(msg)
    return await assertAgent(this).execute(this, msg, opt)
  }
}
