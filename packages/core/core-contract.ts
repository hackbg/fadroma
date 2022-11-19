import type { Task } from '@hackbg/komandi'
import type { Into, Name, Named, Many } from './core-fields'
import type { ClientClass } from './core-client'
import type { Builder } from './core-build'
import type { Uploader } from './core-upload'
import type { CodeId, CodeHash, Hashed } from './core-code'
import type { ChainId } from './core-chain'
import type { Address, Message, TxHash } from './core-tx'
import type { Label } from './core-labels'
import type { Agent } from './core-agent'
import type { Deployment } from './core-deployment'

import { codeHashOf } from './core-code'
import { assertAddress } from './core-tx'
import { rebind, override, Maybe, defineTask, into, map } from './core-fields'
import { Client } from './core-client'
import { ClientError as Error } from './core-events'
import { writeLabel } from './core-labels'
import { assertBuilder } from './core-build'
import { upload } from './core-upload'

export type DeployContract<C extends Client> =
  Contract<C> & (()=> Task<Contract<C>, C>)

export type DeployAnyContract =
  DeployContract<Client>

/** Create a callable object based on Contract. */
export function defineContract <C extends Client> (
  baseOptions: Partial<Contract<C>> = {},
): DeployContract<C> {

  let template = function getOrDeployInstance (
    ...args: [Name, Message]|[Partial<Contract<C>>]
  ): Task<Contract<C>, C> {
    // Parse options
    let options = { ...baseOptions }
    if (typeof args[0] === 'string') {
      const [id, initMsg] = args
      options = { ...options, id, initMsg }
    } else if (typeof args[0] === 'object') {
      options = { ...options, ...args[0] }
    }
    // If there is a deployment, look for the contract in it
    if (options.context && options.id && options.context.contract.has(options.id)) {
      return options.context.contract.get(options.id)
    }
    // The contract object that we'll be using
    const contract = options
      // If options were passed, define a new Contract
      ? defineContract(override({...template}, options! as object))
      // If no options were passed, use this object
      : template
    return contract.deployed
  }

  template = template.bind(template)

  Object.defineProperty(template, 'name', { enumerable: true, writable: true })

  return rebind(template, new Contract(baseOptions)) as Contract<C> & (()=> Task<Contract<C>, C>)

}

export type AnyContract = Contract<Client>

export class Contract<C extends Client> {
  context?:    Deployment    = undefined
  /** URL pointing to Git repository containing the source code. */
  repository?: string|URL    = undefined
  /** Branch/tag pointing to the source commit. */
  revision?:   string        = undefined
  /** Whether there were any uncommitted changes at build time. */
  dirty?:      boolean       = undefined
  /** Path to local Cargo workspace. */
  workspace?:  string        = undefined
  /** Name of crate in workspace. */
  crate?:      string        = undefined
  /** List of crate features to enable during build. */
  features?:   string[]      = undefined
  /** Build procedure implementation. */
  builder?:    Builder       = undefined
  /** Builder implementation that produces a Contract from the Source. */
  builderId?:  string        = undefined
  /** URL to the compiled code. */
  artifact?:   string|URL    = undefined
  /** Code hash uniquely identifying the compiled code. */
  codeHash?:   CodeHash      = undefined
  /** ID of chain on which this contract is uploaded. */
  chainId?:    ChainId       = undefined
  /** Object containing upload logic. */
  uploaderId?: string        = undefined
  /** Upload procedure implementation. */
  uploader?:   Uploader      = undefined
  /** Address of agent that performed the upload. */
  uploadBy?:   Address       = undefined
  /** TXID of transaction that performed the upload. */
  uploadTx?:   TxHash        = undefined
  /** Code ID representing the identity of the contract's code on a specific chain. */
  codeId?:     CodeId        = undefined
  /** The Agent instance that will be used to upload and instantiate the contract. */
  agent?:      Agent         = undefined
  /** The Client subclass that exposes the contract's methods.
    * @default the base Client class. */
  client?:     ClientClass<C> = Client as ClientClass<C>
  /** Address of agent that performed the init tx. */
  initBy?:     Address       = undefined
  /** Address of agent that performed the init tx. */
  initMsg?:    Into<Message> = undefined
  /** TXID of transaction that performed the init. */
  initTx?:     TxHash        = undefined
  /** Address of this contract instance. Unique per chain. */
  address?:    Address       = undefined
  /** Full label of the instance. Unique for a given Chain. */
  label?:      Label         = undefined
  /** Prefix of the instance.
    * Identifies which Deployment the instance belongs to, if any.
    * Prepended to contract label with a `/`: `PREFIX/NAME...` */
  prefix?:     Name          = undefined
  /** Proper name of the instance. Unique within the deployment.
    * If the instance is not part of a Deployment, this is equal to the label.
    * If the instance is part of a Deployment, this is used as storage key.
    * You are encouraged to store application-specific versioning info in this field. */
  id?:         Name          = undefined
  /** Deduplication suffix.
    * Appended to the contract label with a `+`: `...NAME+SUFFIX`.
    * This field has sometimes been used to redeploy an new instance
    * within the same Deployment, taking the place of the old one.
    * TODO: implement this field's semantics: last result of **alphanumeric** sort of suffixes
    *       is "the real one" (see https://stackoverflow.com/a/54427214. */
  suffix?:     Name          = undefined

  constructor (options: Partial<Contract<C>> = {}) {
    override(this, options)
  }

  /** Provide parameters for a contract.
    * @returns self with overrides from options */
  define <T extends this> (options: Partial<T> = {}): T {
    // FIXME: not all parameters can be overridden at any point in time.
    // reflect this here to ensure proper flow of data along contract lifecycle
    return override(this, options as object) as T
  }

  get compiled (): Promise<this> {
    if (this.artifact) return Promise.resolve(this)
    return this.build()
  }

  /** Compile the source using the selected builder.
    * @returns this */
  build (builder?: Builder): Task<this, this> {
    const name = `compile ${this.crate ?? 'contract'}`
    return defineTask(name, buildContract, this)
    const self = this // lol
    async function buildContract (this: typeof self) {
      builder ??= assertBuilder(this)
      const result = await builder!.build(this as Buildable)
      this.define(result as Partial<typeof self>)
      return this
    }
  }

  /** One-shot deployment task. */
  get uploaded (): Task<this, this> {
    if (this.codeId) return Promise.resolve(this)
    const uploading = this.upload()
    Object.defineProperty(this, 'uploaded', { get () { return uploading } })
    return uploading
  }

  /** Upload compiled source code to the selected chain.
    * @returns task performing the upload */
  upload (uploader?: Uploader): Task<this, this> {
    const name = `upload ${this.artifact ?? this.crate ?? 'contract'}`
    return defineTask(name, uploadContract, this)
    const self = this
    async function uploadContract (this: typeof self) {
      await this.compiled
      const result = await upload(this as Uploadable, uploader, uploader?.agent)
      return this.define(result as Partial<typeof self>)
    }
  }

  /** One-shot deployment task. */
  get deployed (): Task<Contract<C>, C> {
    if (this.address) {
      this.log?.foundDeployedContract(this.address, this.id)
      return Promise.resolve((this.client ?? Client).fromContract(this) as C)
    }
    const deploying = this.deploy()
    Object.defineProperty(this, 'deployed', { get () { return deploying } })
    return deploying
  }

  /** Deploy the contract, or retrieve it if it's already deployed.
    * @returns promise of instance of `this.client`  */
  deploy (initMsg: Into<Message>|undefined = this.initMsg): Task<Contract<C>, C> {
    return defineTask(`deploy ${this.id ?? 'contract'}`, deployContract, this)
    async function deployContract (this: Contract<C>) {
      if (!this.agent)   throw new Error.NoAgent(this.id)
      if (!this.id)      throw new Error.NoName(this.id)
      this.label = writeLabel(this)
      if (!this.label)   throw new Error.NoInitLabel(this.id)
      if (!this.initMsg) throw new Error.NoInitMessage(this.id)
      await this.uploaded
      if (!this.codeId)  throw new Error.NoInitCodeId(this.id)
      this.initMsg ??= await into(initMsg) as Message
      this.log?.beforeDeploy(this, this.label!)
      const contract = await this.agent!.instantiate(this)
      this.define(contract as Partial<this>)
      this.log?.afterDeploy(this as Partial<Contract<C>>)
      if (this.context) this.context.contract.add(this.id!, contract)
      return (this.client ?? Client).fromContract(this)
    }
  }

  /** @returns one contracts from this contract's deployment which matches
    * this contract's properties, as well as an optional predicate function. */
  find (
    predicate: (meta: Partial<Contract<C>>) => boolean = (x) => true
  ): Contract<C>|null {
    return this.findMany(predicate)[0]
  }

  /** @returns all contracts from this contract's deployment
    * that match this contract's properties, as well as an optional predicate function. */
  findMany (
    predicate: (meta: Partial<Contract<C>>) => boolean = (x) => true
  ): Contract<C>[] {
    if (!this.context) throw new Error.NoFindWithoutContext()
    const contracts = Object.values(this.context.state).map(task=>task.context)
    return contracts.filter(contract=>Boolean(contract.matches(this) && predicate(contract!)))
  }

  /** @returns true if the specified properties match the properties of this contract. */
  matches (predicate: Partial<Contract<C>>): boolean {
    for (const key in predicate) {
      if (this[key as keyof typeof predicate] !== predicate[key as keyof typeof predicate]) {
        return true
      }
    }
    return true
  }

  many (
    contracts: Many<[Name, Message]|Partial<AnyContract>>
  ): Task<Contract<C>, Many<Contract<C>>> {
    const size = Object.keys(contracts).length
    const name = (size === 1) ? `deploy contract` : `deploy ${size} contracts`
    const self = this
    return defineTask(name, deployManyContracts, this)
    function deployManyContracts (this: typeof self) {
      type Instance = [Name, Message] | Partial<AnyContract>
      return map(contracts, function (instance: Instance): Task<Contract<C>, C> {
        if (instance instanceof Array) instance = { id: instance[0], initMsg: instance[1] }
        const contract = defineContract({ ...self, ...instance })
        return contract.deployed
      })
    }
  }

  get asLink (): ContractLink {
    return linkStruct(this as unknown as IntoLink)
  }

}

/** Parameters involved in building a contract. */
export interface Buildable {
  crate:       string
  features?:   string[]
  workspace?:  string
  repository?: string|URL
  revision?:   string
  dirty?:      boolean
  builder?:    Builder
}

/** Result of building a contract. */
export interface Built {
  artifact:   string|URL
  codeHash?:  CodeHash
  builder?:   Builder
  builderId?: string
}

/** @returns the data for saving a build receipt. */
export function toBuildReceipt (s: Buildable & Built) {
  return {
    repository: s.repository,
    revision:   s.revision,
    dirty:      s.dirty,
    workspace:  s.workspace,
    crate:      s.crate,
    features:   s.features?.join(', '),
    builder:    undefined,
    builderId:  s.builder?.id,
    artifact:   s.artifact?.toString(),
    codeHash:   s.codeHash
  }
}

/** Parameters involved in uploading a contract */
export interface Uploadable {
  artifact:  string|URL
  chainId:   ChainId,
  codeHash?: CodeHash
}

/** Result of uploading a contract */
export interface Uploaded {
  chainId:   ChainId
  codeId:    CodeId
  codeHash:  CodeHash
  uploader?: Uploader
  uploadBy?: Address
  uploadTx?: TxHash
}

/** @returns the data for saving an upload receipt. */
export function toUploadReceipt (
  t: Buildable & Built & Uploadable & Uploaded
) {
  return {
    ...toBuildReceipt(t),
    chainId:    t.chainId,
    uploaderId: t.uploader?.id,
    uploader:   undefined,
    uploadBy:   t.uploadBy,
    uploadTx:   t.uploadTx,
    codeId:     t.codeId
  }
}

/** Parameters involved in instantiating a contract */
export interface Instantiable {
  chainId:   ChainId
  codeId:    CodeId
  codeHash?: CodeHash
  label?:    Label
  prefix?:   Name
  name?:     Name
  suffix?:   Name
  initMsg:   Message
}

/** Result of instantiating a contract */
export interface Instantiated {
  chainId:  ChainId
  address:  Address
  codeHash: CodeHash
  label:    Label
  prefix?:  Name
  name?:    Name
  suffix?:  Name
  initBy?:  Address
  initTx?:  TxHash
}

/** @returns the data for a deploy receipt */
export function toInstanceReceipt (
  c: Buildable & Built & Uploadable & Uploaded & Instantiable & Instantiated
) {
  return {
    ...toUploadReceipt(c),
    initBy:  c.initBy,
    initMsg: c.initMsg,
    initTx:  c.initTx,
    address: c.address,
    label:   c.label,
    prefix:  c.prefix,
    name:    c.name,
    suffix:  c.suffix
  }
}

/** Convert Fadroma.Instance to address/hash struct (ContractLink) */
export const linkStruct = (instance: IntoLink): ContractLink => ({
  address:   assertAddress(instance),
  code_hash: codeHashOf(instance)
})

/** Objects that have an address and code hash.
  * Pass to linkTuple or linkStruct to get either format of link. */
export type IntoLink = Hashed & {
  address: Address
}

/** Reference to an instantiated smart contract,
  * in the format of Fadroma ICC. */
export interface ContractLink {
  readonly address:   Address
  readonly code_hash: CodeHash
}
