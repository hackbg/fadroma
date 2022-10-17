import { Task } from '@hackbg/komandi'
import { ClientError, ClientConsole } from './client-events'
import { Metadata, validated, override, hide, into, intoArray, intoRecord } from './client-fields'
import type { Class, Into, IntoArray, IntoRecord } from './client-fields'
import { assertAddress, assertAgent } from './client-connect'
import type { ChainId, Address, TxHash, Agent, Message, IFee, ExecOpts } from './client-connect'
import { Builder, Uploader, assertBuilder, upload } from './client-deploy'
import type { Deployment } from './client-deploy'

/** The friendly name of a contract, or another part of the label (prefix, suffix).
  * Names are user-specified and are used as the keys of `deployment.store`.
  * Prefix and suffix are set automatically to work around the label uniqueness constraint. */
export type Name = string

/** A contract name with optional prefix and suffix, implementing namespacing
  * for append-only platforms where labels have to be globally unique. */
export interface StructuredLabel {
  label?:  Label,
  name?:   Name,
  prefix?: Name,
  suffix?: Name
}

/** A contract's full unique on-chain label. */
export type Label  = string

/** Fetch the label from the chain. */
export async function fetchLabel <C extends ContractInstance> (
  meta: C, agent: Agent, expected?: Label
): Promise<C & { label: Label }> {
  const label = await agent.getLabel(assertAddress(meta))
  if (!!expected) validated('label', expected, label)
  const { name, prefix, suffix } = parseLabel(label)
  return Object.assign(meta, { label, name, prefix, suffix })
}

/** RegExp for parsing labels of the format `prefix/name+suffix` */
export const RE_LABEL = /((?<prefix>.+)\/)?(?<name>[^+]+)(\+(?<suffix>.+))?/

/** Parse a label into prefix, name, and suffix. */
export function parseLabel (label: Label): StructuredLabel {
  const matches = label.match(RE_LABEL)
  if (!matches || !matches.groups) throw new ClientError.InvalidLabel(label)
  const { name, prefix, suffix } = matches.groups
  if (!name) throw new ClientError.InvalidLabel(label)
  return { label, name, prefix, suffix }
}

/** Construct a label from prefix, name, and suffix. */
export function writeLabel ({ name, prefix, suffix }: StructuredLabel = {}): Label {
  if (!name) throw new ClientError.NoName()
  let label = name
  if (prefix) label = `${prefix}/${label}`
  if (suffix) label = `${label}+${suffix}`
  return label
}

/** A code hash, uniquely identifying a particular smart contract implementation. */
export type CodeHash = string

/** @returns the code hash of the thing
  * @throws  LinkNoCodeHash if missing. */
export function assertCodeHash ({ codeHash }: { codeHash?: CodeHash } = {}): CodeHash {
  if (!codeHash) throw new ClientError.LinkNoCodeHash()
  return codeHash
}

/** Fetch the code hash by id and by address, and compare them.
  * @returns the passed contract object but with codeHash set
  * @throws if unable to establish the code hash */
export async function fetchCodeHash <C extends ContractTemplate & { address?: Address }> (
  meta: C, agent?: Agent|null|undefined, expected?: CodeHash,
): Promise<CodeHash> {
  if (!agent) throw new ClientError.NoAgent()
  if (!meta.address && !meta.codeId && !meta.codeHash) {
    throw new ClientError('Unable to fetch code hash: no address or code id.')
  }
  const codeHashByAddress = meta.address
    ? validated('codeHashByAddress', await agent.getHash(meta.address), expected)
    : undefined
  const codeHashByCodeId  = meta.codeId
    ? validated('codeHashByCodeId',  await agent.getHash(meta.codeId),  expected)
    : undefined
  if (codeHashByAddress && codeHashByCodeId && codeHashByAddress !== codeHashByCodeId) {
    throw new ClientError('Validation failed: different code hashes fetched by address and by code id.')
  }
  if (!codeHashByAddress && !codeHashByCodeId) {
    throw new ClientError('Code hash unavailable.')
  }
  return codeHashByAddress! ?? codeHashByCodeId!
}

/** Objects that have a code hash in either capitalization. */
interface Hashed { code_hash?: CodeHash, codeHash?: CodeHash }

/** Allow code hash to be passed with either cap convention; warn if missing or invalid. */
export function codeHashOf ({ code_hash, codeHash }: Hashed): CodeHash {
  if (typeof code_hash === 'string') code_hash = code_hash.toLowerCase()
  if (typeof codeHash  === 'string') codeHash  = codeHash.toLowerCase()
  if (code_hash && codeHash && code_hash !== codeHash) throw new ClientError.DifferentHashes()
  const result = code_hash ?? codeHash
  if (!result) throw new ClientError.NoCodeHash()
  return result
}

/** A code ID, identifying uploaded code on a chain. */
export type CodeId = string

/** Retrieves the code ID corresponding to this contract's code hash.
  * @returns `this` but with `codeId` populated. */
export async function fetchCodeId <C extends ContractInstance> (
  meta: C, agent: Agent, expected?: CodeId,
): Promise<C & { codeId: CodeId }> {
  return Object.assign(meta, {
    codeId: validated('codeId',
      String(await agent.getCodeId(assertAddress(meta))),
      (expected===undefined) ? undefined : String(expected)
    )
  })
}

/** Base class for contract lifecycle object. */
export class ContractMetadata extends Metadata {
  log = new ClientConsole(this.constructor.name)
  constructor (options: Partial<ContractSource> = {}) {
    super(options)
    this.provide(options as object)
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
    this.provide(options as object)
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
      const result = await builder!.build(this.asSource)
      this.provide(result as Partial<this>)
      return this.asSource
    })
  }

  /** Upload compiled source code to the selected chain.
    * @returns task performing the upload */
  async upload (uploader?: Uploader): Promise<ContractTemplate> {
    return this.task(`upload ${this.artifact ?? this.crate ?? 'contract'}`, async () => {
      await this.compiled
      const result = await upload(this.asTemplate, uploader, uploader?.agent)
      return this.asTemplate.provide(result)
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

/** @returns a string in the format `crate[@ref][+flag][+flag]...` */
export function getSourceSpecifier <C extends ContractSource> (meta: C): string {
  const { crate, revision, features } = meta
  let result = crate ?? ''
  if (revision !== 'HEAD') result = `${result}@${revision}`
  if (features && features.length > 0) result = `${result}+${features.join('+')}`
  return result
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
    this.provide(options as object)
  }

  /** One-shot deployment task. */
  get uploaded (): Promise<ContractTemplate> {
    if (this.codeId) return Promise.resolve(this)
    const uploading = this.upload()
    Object.defineProperty(this, 'uploaded', { get () { return uploading } })
    return uploading
  }

  instance (options: Partial<ContractInstance>): ContractInstance {
    return new ContractInstance(this).provide(options)
  }

  instances <C extends Client> (inputs: Record<Name, Partial<ContractInstance>>):
    Record<Name, ContractInstance>
  {
    return Object.fromEntries(Object.entries(inputs).map(
      ([name, options])=>[name, new ContractInstance(this).provide(options)]))
  }

  contract <C extends Client> (options: Partial<ContractInstance>): Contract<C> {
    return new Contract<C>(this as Partial<Contract<C>>).provide(options as Partial<Contract<C>>)
  }

  contracts <C extends Client> (inputs: Record<Name, Partial<ContractInstance>>):
    Record<Name, Contract<C>>
  {
    return Object.fromEntries(Object.entries(inputs).map(([name, options])=>[
      name, new Contract<C>(this as Partial<Contract<C>>).provide(options as Partial<Contract<C>>)
    ]))
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
    this.provide(options as object)
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

export function attachContract <C extends Client, T extends Contract<C>|Contracts<C>> (
  self:    T,
  context: Deployment
): T {
  self.context = context
  self.log ??= context.log
  self.agent ??= context.agent
  self.builder ??= context.builder
  self.uploader ??= context.uploader
  self.repository ??= context.repository
  self.revision ??= context.revision
  self.workspace ??= context.workspace
  setPrefix(self, context.name)
  return self

  function setPrefix (self: T, value: string) {
    Object.defineProperty(self, 'prefix', {
      enumerable: true,
      get () { return self.context?.name },
      set (v: string) {
        if (v !== self.context?.name) {
          self.log.warn(`BUG: Overriding prefix from "${self.context?.name}" to "${v}"`)
        }
        setPrefix(self, v)
      }
    })
  }
}

/** Contract slot. `await` an instance of this to get a client for it,
  * retrieving it from the deployment if known, or deploying it if not found.
  * @implements PromiseLike */
export class Contract<C extends Client> extends ContractInstance {

  declare client?: ClientClass<C>

  log = new ClientConsole('Fadroma.Contract')
  /** Construct a new contract slot. */
  constructor (
    /** Parameters of the specified contract. */
    options: Partial<Contract<C>> = {},
    /** The group of contracts that contract belongs to. */
    public context: Deployment|undefined = options?.context,
    /** The agent that will upload and instantiate this contract. */
    public agent: Agent|undefined = options?.agent
  ) {
    super(options as Partial<ContractInstance>)
    this.provide(options as object)
    if (context) this.attach(context)
    //if (this.builderId) this.builder  = Builder.get(this.builderId)
    //if (this.uploaderId) this.uploader = Uploader.get(this.uploader)
  }
  /** Attach this contract to a Deployment. */
  attach (context: Deployment): this {
    attachContract<C, this>(this, context)
    if (this.name && context.has(this.name)) this.provide(context.get(this.name) as Partial<this>)
    return this
  }
  /** One-shot deployment task. */
  get deployed (): Promise<C> {
    const client = this.getClientOrNull()
    if (client) {
      this.log.foundDeployedContract(client.address!, this.name!)
      return Promise.resolve(client)
    }
    const deploying = this.deploy()
    Object.defineProperty(this, 'deployed', { get () { return deploying } })
    return deploying
  }
  /** Deploy the contract, or retrieve it if it's already deployed.
    * @returns promise of instance of `this.client`  */
  deploy (initMsg: Into<Message>|undefined = this.initMsg): Task<this, C> {
    return this.task(`deploy ${this.name ?? 'contract'}`, async () => {
      if (!this.agent) throw new ClientError.NoAgent(this.name)
      if (!this.name) throw new ClientError.NoName(this.name)
      this.label = writeLabel(this)
      if (!this.label) throw new ClientError.NoInitLabel(this.name)
      if (!this.initMsg) throw new ClientError.NoInitMessage(this.name)
      await this.uploaded
      if (!this.codeId) throw new ClientError.NoInitCodeId(this.name)
      this.initMsg = await into(initMsg) as Message
      this.log.beforeDeploy(this.asTemplate, this.label!)
      const contract = await this.agent!.instantiate(this.asInstance)
      this.provide(contract as Partial<this>)
      this.log.afterDeploy(this)
      if (this.context) this.context.add(this.name!, contract)
      return this.getClient()
    })
  }
  /** Async wrapper around getClientSync.
    * @returns a Client instance pointing to this contract
    * @throws if the contract address could not be determined */
  getClient (
    $Client: ClientClass<C>|undefined = this.client as ClientClass<C>
  ): Promise<C> {
    return Promise.resolve(this.getClientSync($Client))
  }
  /** @returns a Client instance pointing to this contract
    * @throws if the contract address could not be determined */
  getClientSync (
    $Client: ClientClass<C>|undefined = this.client as ClientClass<C>
  ): C {
    const client = this.getClientOrNull($Client)
    if (!client) throw new ClientError.NotFound($Client.name, this.name, this.context?.name)
    return client
  }
  /** @returns a Client instance pointing to this contract, or null if
    * the contract address could not be determined */
  getClientOrNull (
    $Client: ClientClass<C>|undefined = this.client as ClientClass<C>
  ): C|null {
    if (this.address) {
      return new $Client(this.agent, this.address, this.codeHash, this) as C
    }
    if (this.context && this.name && this.context.has(this.name)) {
      const { address, codeHash } = this.context.get(this.name)!
      return new $Client(this.agent, address, codeHash, this) as C
    }
    return null
  }
  /** Evaluate this Contract, asynchronously returning a Client.
    * 1. try to get the contract from storage (if the deploy store is available)
    * 2. if that fails, try to deploy the contract (building and uploading it,
    *    if necessary and possible)
    * @returns promise of instance of `this.client`
    * @throws  if not found and not deployable  */
  //then <D, E> (
    //onfulfilled?: ((client: C)   => D|PromiseLike<D>) | null,
    //onrejected?:  ((reason: any) => E|PromiseLike<E>) | null
  //): Promise<D|E> {
    //return this.deployed.then(onfulfilled, onrejected)
  //}
}

export type MatchPredicate = (meta: Partial<ContractInstance>) => boolean|undefined

export class Contracts<C extends Client> extends ContractTemplate {
  log = new ClientConsole('Fadroma.Contract')
  /** Prefix of the instance.
    * Identifies which Deployment the instance belongs to, if any.
    * Prepended to contract label with a `/`: `PREFIX/NAME...` */
  prefix?: Name = undefined
  /** A mapping of Names (unprefixed Labels) to init configurations for the respective contracts. */
  inits?:  IntoRecord<Name, ContractInstance> = undefined
  /** A filter predicate for recognizing deployed contracts. */
  match?:  MatchPredicate = meta => Object.keys(this.inits??{}).includes(meta.name!)

  constructor (
    options: Partial<ContractInstance> = {},
    /** The group of contracts that contract belongs to. */
    public context?: Deployment,
    /** The agent that will upload and instantiate this contract. */
    public agent:    Agent     |undefined = context?.agent
  ) {
    super(options)
    this.provide(options as object)
  }

  attach (context: Deployment): this {
    return attachContract<C, this>(this, context)
  }

  /** One-shot deployment task. */
  get deployed (): Promise<Record<Name, C>> {
    const clients: Record<Name, C> = {}
    if (!this.inits) throw new ClientError.NoInitMessage()
    return into(this.inits!).then(async inits=>{
      // Collect separately the contracts that already exist
      for (const [name, args] of Object.entries(inits)) {
        const contract = this.contract({ name })
        const client = contract.getClientOrNull()
        if (client) {
          this.log.foundDeployedContract(client.address!, name)
          clients[name] = client as C
          delete inits[name]
        }
      }
      // If there are any left to deploy, deploy em
      if (Object.keys(inits).length > 0) {
        Object.assign(clients, await this.deploy(inits))
      }
      return clients
    })
  }

  /** Deploy multiple instances of the same template. */
  deploy (inputs: IntoRecord<Name, ContractInstance> = this.inits ?? {}): Promise<Record<Name, C>> {
    const count = `${Object.keys(inputs).length} instance(s)`
    const name = undefined
        ?? (this.codeId && `deploy ${count} of code id ${this.codeId}`)
        ?? (this.crate  && `deploy ${count} of crate ${this.crate}`)
        ?? `deploy ${count}`
    return this.task(name, async (): Promise<Record<Name, C>> => {
      // need an agent to proceed
      const agent = assertAgent(this)
      // get the inits if passed lazily
      const inits = await intoRecord(inputs, this.context)
      // if deploying 0 contracts we're already done
      if (Object.keys(inits).length === 0) return Promise.resolve({})
      // upload then instantiate (upload may be a no-op if cached)
      const template = await this.uploaded
      // at this point we should have a code id
      if (!this.codeId) throw new ClientError.NoInitCodeId(name)
      // prepare each instance
      for (const [name, instance] of Object.entries(inits)) {
        // if operating in a Deployment, add prefix to each name (should be passed unprefixed)
        instance.label   = writeLabel({ name, prefix: this.context?.name })
        // resolve all init messages
        instance.initMsg = await into(instance.initMsg)
      }
      try {
        // run a bundled transaction creating each instance
        const responses = await agent.instantiateMany(inits)
        // get a Contract object representing each
        const contracts = Object.values(responses).map(response=>this.contract(response))
        // get a Client from each Contract
        const clients   = Object.fromEntries(contracts.map(contract=>[contract.name, contract.getClientSync()]))
        // if operating in a Deployment, save each instance to the receipt
        if (this.context) Object.keys(inits).forEach(name=>this.context!.add(name, responses[name]))
        // return the battle-ready clients
        return clients
      } catch (e) {
        this.log.deployManyFailed(this, Object.values(inits), e as Error)
        throw e
      }
    })
  }

  /** Get all contracts that match the specified predicate. */
  get (match: MatchPredicate|undefined = this.match): Promise<Record<Name, C>> {
    if (!match) throw new ClientError.NoPredicate()
    const info = match.name
      ? `get all contracts matching predicate: ${match.name}`
      : `get all contracts matching specified predicate`
    return this.task(info, () => {
      if (!this.context) throw new ClientError.NoDeployment()
      const clients: Record<Name, C> = {}
      for (const info of Object.values(this.context!.state)) {
        if (!match(info as Partial<ContractInstance>)) continue
        clients[info.name!] = this.asTemplate.contract<C>(info).getClientSync()
      }
      return Promise.resolve(clients)
    })
  }

  get asTemplate (): ContractTemplate {
    return new ContractTemplate(this)
  }
}

export interface NewContract<C extends Client> {
  new (...args: ConstructorParameters<typeof Contract<C>>): Contract<C>
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
