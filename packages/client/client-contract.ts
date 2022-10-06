import { Task } from '@hackbg/komandi'
import { ClientError, ClientConsole } from './client-events'
import { Metadata, validated, override, into, intoArray } from './client-fields'
import type { Class, Into, IntoArray } from './client-fields'
import { assertAddress, assertAgent } from './client-connect'
import type { ChainId, Address, TxHash, Agent, Message, IFee, ExecOpts } from './client-connect'
import { Builder, Uploader, assertBuilder, upload } from './client-deploy'
import type { Deployment, DeployArgs } from './client-deploy'

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
    codeId: validated('codeId', await agent.getCodeId(assertAddress(meta)), expected)
  })
}

export class ContractBase extends Metadata {
  /** Define a subtask
    * @returns A lazily-evaluated Promise. */
  task <T extends this, U> (name: string, cb: (this: T)=>PromiseLike<U>): Task<T, U> {
    const task = new Task(name, cb, this as unknown as T)
    const [_, head, ...body] = (task.stack ?? '').split('\n')
    task.stack = '\n' + head + '\n' + body.slice(3).join('\n')
    task.log = this.log ?? task.log
    return task as Task<T, U>
  }
  log = new ClientConsole(this.constructor.name)
}

export class ContractSource extends ContractBase {
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

  compiled: Task<ContractSource, ContractSource> = this.artifact
    ? Task.done(`use compiled contract: ${this.artifact.toString()}`, this.asSource)
    : this.task(`compile ${this.crate ?? 'contract'}`, async () => {
        if (!this.artifact) await this.build()
        return this.asSource
      })

  /** Compile the source using the selected builder.
    * @returns this */
  async build (builder?: Builder): Promise<ContractSource> {
    builder ??= assertBuilder(this)
    const result = await builder!.build(this.asSource)
    this.provide(result as Partial<this>)
    return result
  }

  get asSource (): ContractSource {
    return new ContractSource(this)
  }

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

/** All info about a contract, expect instance-specific fields.
  * Multiple instances can correspond to this data. */
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

  constructor (options: Partial<ContractTemplate> = {}) {
    super(options)
    this.provide(options as object)
  }

  uploaded: Task<ContractTemplate, ContractTemplate> = this.task(
    `upload ${this.artifact ?? 'contract'}`, async () => {
      if (!this.codeId) await this.upload()
      return this.asTemplate
    })

  /** Upload compiled source code to the selected chain.
    * @returns this with chainId and codeId populated. */
  async upload (uploader?: Uploader): Promise<ContractTemplate> {
    await this.compiled
    const result = await upload(this.asTemplate, uploader, uploader?.agent)
    this.provide(result as Partial<this>)
    return result
  }

  async instantiate (agent: Agent, label: Label, initMsg: Message): Promise<ContractInstance> {
    await this.uploaded
    return new ContractInstance(this)
  }

  get asTemplate (): ContractTemplate {
    return new ContractTemplate(this)
  }

  /** Uploaded templates can be passed to factory contracts in this format. */
  get asInfo (): ContractInfo {
    if (!this.codeId || isNaN(Number(this.codeId)) || !this.codeHash) {
      throw new ClientError.Unpopulated()
    }
    return templateStruct(this)
  }

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

export interface ContractInfo {
  id:        number,
  code_hash: string
}

/** `{ id, codeHash }` -> `{ id, code_hash }`; nothing else */
export const templateStruct = (template: any): ContractInfo => ({
  id:        Number(template.codeId),
  code_hash: codeHashOf(template)
})

export class ContractInstance extends ContractTemplate implements StructuredLabel {
  /** Address of agent that performed the init tx. */
  initBy?:  Address       = undefined
  /** Address of agent that performed the init tx. */
  initMsg?: Into<Message> = undefined
  /** TXID of transaction that performed the init. */
  initTx?:  TxHash        = undefined
  /** Address of this contract instance. Unique per chain. */
  address?: Address       = undefined
  /** Full label of the instance. Unique for a given Chain. */
  label?:   Label         = undefined
  /** Prefix of the instance.
    * Identifies which Deployment the instance belongs to, if any.
    * Prepended to contract label with a `/`: `PREFIX/NAME...` */
  prefix?:  Name          = undefined
  /** Proper name of the instance.
    * If the instance is not part of a Deployment, this is equal to the label.
    * If the instance is part of a Deployment, this is used as storage key.
    * You are encouraged to store application-specific versioning info in this field. */
  name?:    Name          = undefined
  /** Deduplication suffix.
    * Appended to the contract label with a `+`: `...NAME+SUFFIX`.
    * This field has sometimes been used to redeploy an new instance
    * within the same Deployment, taking the place of the old one.
    * TODO: implement this field's semantics: last result of **alphanumeric** sort of suffixes
    *       is "the real one" (see https://stackoverflow.com/a/54427214. */
  suffix?:  Name          = undefined
  /** The Client subclass that exposes the contract's methods.
    * @default the base Client class. */
  client?:  ClientClass<Client> = undefined

  constructor (options: Partial<ContractInstance> = {}) {
    super(options)
    this.provide(options as object)
  }

  /** Get link to this contract in Fadroma ICC format. */
  get asLink (): ContractLink {
    return { address: assertAddress(this), code_hash: assertCodeHash(this) }
  }

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

/** A contract name with optional prefix and suffix, implementing namespacing
  * for append-only platforms where labels have to be globally unique. */
export interface StructuredLabel {
  label?:  Label,
  name?:   Name,
  prefix?: Name,
  suffix?: Name
}

/** The friendly name of a contract. Part of the label. */
export type Name = string

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

export class Contract<C extends Client> extends ContractInstance {
  log = new ClientConsole('Fadroma.Contract')

  /** The agent that will upload and instantiate this contract. */
  agent?: Agent = this.deployment?.agent

  constructor (
    specifier?: Partial<Contract<C>>,
    overrides:  Partial<Contract<C>> = {}
  ) {
    super()
    override<Contract<C>>(this, { ...specifier??{}, ...overrides??{} })
    //if (this.builderId) this.builder  = Builder.get(this.builderId)
    //if (this.uploaderId) this.uploader = Uploader.get(this.uploader)
    for (const hide of [
      'log',
    ]) Object.defineProperty(this, hide, { enumerable: false, writable: true })
  }

  get [Symbol.toStringTag]() { return `${this.name??'-'} ${this.address??'-'} ${this.crate??'-'} @ ${this.revision??'HEAD'}` }

  /** Evaluate this Contract, asynchronously returning a Client.
    * 1. try to get the contract from storage (if the deploy store is available)
    * 2. if that fails, try to deploy the contract (building and uploading it,
    *    if necessary and possible)
    * @returns promise of instance of `this.client`
    * @throws  if not found and not deployable  */
  then <D, E> (
    onfulfilled?: ((client: C)   => D|PromiseLike<D>) | null,
    onrejected?:  ((reason: any) => E|PromiseLike<E>) | null
  ): Promise<D|E> {
    return this.deployed.then(onfulfilled, onrejected)
  }

  /** @returns the contract's metadata */
  get meta (): ContractInstance {
    return new ContractInstance(this)
  }

  /** Provide parameters for an existing contract.
    * @returns the modified contract. */
  provide <T extends this> (options: Partial<T>): T {
    super.provide(options as object)
    // If this Contract is now part of a Deployment,
    // inherit the prefix from the deployment.
    if (this.deployment) {
      const self = this
      const setPrefix = (contract: Contract<C>, value: string) =>
        Object.defineProperty(contract, 'prefix', {
          enumerable: true,
          get () { return contract.deployment?.name },
          set (v: string) {
            if (v !== contract.deployment?.name) (this.log??self.log).warn(
              `BUG: Overriding prefix of contract from deployment "${contract.deployment?.name}" to be "${v}"`
            )
            setPrefix(contract, v)
          }
        })
      setPrefix(this, this.deployment.name)
    }
    // Return the modified Contract
    return this as T
  }

  /** One-shot deployment task. */
  deployed: Task<this, C> = this.task(
    `get or deploy ${this.name ?? 'contract'}`, async () => {
      const deployed = this.getClientOrNull()
      if (deployed) {
        this.log.foundDeployedContract(deployed.address!, this.name!)
        return await Promise.resolve(deployed)
      } else {
        return await this.deploy()
      }
    })

  /** Deployment that this contract is a part of. */
  deployment?: Deployment = undefined

  /** Deploy the contract, or retrieve it if it's already deployed.
    * @returns promise of instance of `this.client`  */
  deploy (initMsg: Into<Message>|undefined = this.initMsg): Task<this, C> {
    return this.task(`deploy ${this.name ?? 'contract'}`, async () => {
      if (!this.agent) throw new ClientError.NoCreator(this.name)

      this.label = writeLabel(this)
      if (!this.label) throw new ClientError.NoInitLabel(this.name)

      await this.uploaded
      if (!this.codeId) throw new ClientError.NoInitCodeId(this.name)

      this.log.beforeDeploy(this as ContractTemplate, this.label!)
      const contract = await this.agent!.instantiate(
        this as ContractTemplate, this.label!, await into(initMsg) as Message
      )
      this.log.afterDeploy(contract)

      if (this.deployment) this.deployment.add(this.name!, contract)

      return this.getClient()
    })
  }

  /** Async wrapper around getClientSync.
    * @returns a Client instance pointing to this contract
    * @throws if the contract address could not be determined */
  getClient ($Client: ClientClass<C> = this.client): Promise<C> {
    return Promise.resolve(this.getClientSync($Client))
  }

  /** @returns a Client instance pointing to this contract
    * @throws if the contract address could not be determined */
  getClientSync ($Client: ClientClass<C> = this.client): C {
    const client = this.getClientOrNull($Client)
    if (!client) throw new ClientError.NotFound($Client.name, this.name, this.deployment?.name)
    return client
  }

  /** @returns a Client instance pointing to this contract, or null if
    * the contract address could not be determined */
  getClientOrNull ($Client: ClientClass<C> = this.client): C|null {
    if (this.address) {
      return new this.client(this.agent, this.address, this.codeHash, this.meta)
    }
    if (this.deployment && this.name && this.deployment.has(this.name)) {
      const { address, codeHash } = this.deployment.get(this.name)!
      return new this.client(this.agent, address, codeHash, this.meta)
    }
    return null
  }
}

export type MatchPredicate = (meta: Partial<ContractInstance>) => boolean|undefined

export class Contracts<C extends Client> extends ContractTemplate implements PromiseLike<C[]> {
  log = new ClientConsole('Fadroma.Contract')
  /** Deployment that this contract is a part of. */
  deployment?: Deployment     = undefined
  /** The agent that will upload and instantiate these contracts. */
  agent?:      Agent          = this.deployment?.agent
  /** Build procedure implementation. */
  builder?:    Builder        = this.deployment?.builder
  /** Upload procedure implementation. */
  uploader?:   Uploader       = this.deployment?.uploader
  /** The Client subclass that exposes the contract's methods.
    * @default the base Client class. */
  client:      ClientClass<C> = Client as unknown as ClientClass<C>
  /** A list of [Label, InitMsg] pairs that are used to instantiate the contracts. */
  inits?:      IntoArray<DeployArgs> = undefined
  /** A filter predicate for recognizing deployed contracts. */
  match?:      MatchPredicate

  constructor (options: Partial<Contracts<C>> = {}) {
    super(options)
  }

  /** Evaluate this Contract, asynchronously returning a Client.
    *   1. try to get the contract from storage (if the deploy store is available)
    *   2. if that fails, try to deploy the contract (building and uploading it,
    *      if necessary and possible)
    * @returns an instance of `this.client` */
  then <D, E> (
    resolved?: ((clients: C[]) => D|PromiseLike<D>) | null,
    rejected?: ((failure: any) => E|PromiseLike<E>) | null
  ): Promise<D|E> {
    return this.deployed.then(resolved, rejected)
  }

  deployed = this.task(`get or deploy contracts`, () => this.deploy())

  /** Get all contracts that match the specified predicate. */
  get (match: MatchPredicate|undefined = this.match) {
    if (!match) throw new ClientError.NoPredicate()
    const info = match.name
      ? `get all contracts matching predicate: ${match.name}`
      : `get all contracts matching specified predicate`
    return this.task(info, () => {
      if (!this.deployment) throw new ClientError.NoDeployment()
      const clients: C[] = []
      for (const info of Object.values(this.deployment!.state)) {
        if (!match(info as Partial<ContractInstance>)) continue
        clients.push(new Contract(this.asTemplate as Partial<Contract<C>>).provide(info).getClientSync())
      }
      return Promise.resolve(clients)
    })
  }

  /** Deploy multiple instances of the same template. */
  deploy (inits: IntoArray<DeployArgs> = this.inits ?? []) {
    return this.task(this.deployTaskName, async (): Promise<C[]> => {
      // need an agent to proceed
      const agent = assertAgent(this)
      // get the inits if passed lazily
      const inits = await intoArray(this.inits??[], this.deployment)
      // if deploying 0 contracts we're already done
      if (inits.length === 0) return Promise.resolve([])
      // upload then instantiate (upload may be a no-op if cached)
      return this.upload().then(async (template: ContractTemplate)=>{
        // at this point we should have a code id
        if (!this.codeId) throw new ClientError.NoInitCodeId(name)
        // if operating in a Deployment, add prefix to each name (should be passed unprefixed)
        const prefix = this.deployment?.name
        const prefixedInits: DeployArgs[] = inits.map(([label, msg])=>[
          writeLabel({ name: label, prefix }),
          msg
        ])
        try {
          // run a bundled transaction creating each instance
          const responses = await agent.instantiateMany(this, prefixedInits)
          // get a Contract object representing each
          const contracts = responses.map(({ address })=>this.instance({ address }))
          // get a Client from each Contract
          const clients   = contracts.map(contract=>contract.getClientSync())
          // if operating in a Deployment, save each instance to the receipt
          if (this.deployment) {
            for (const i in inits) this.deployment.add(inits[i][0], contracts[i])
          }
          // return the battle-ready clients
          return clients
        } catch (e) {
          this.log.deployManyFailed(this, inits, e as Error)
          throw e
        }
      })
    })
  }

  protected get deployTaskName (): string {
    return undefined
      ?? (this.codeId && `deploy multiple instances of code id ${this.codeId})`)
      ?? (this.crate  && `deploy multiple instances of crate ${this.crate})`)
      ?? 'deploy multiple instances'
  }

  instance (options: Partial<ContractInstance> = {}): Contract<C> {
    return new Contract(this.asTemplate as Partial<Contract<C>>)
      .provide(options as Partial<Contract<C>>)
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
    Object.defineProperty(this, 'deployment', { writable: true, enumerable: false })
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
