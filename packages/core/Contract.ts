import Error   from './Error'
import Console from './Console'

import type { Into, Name, Named, Many, Class } from './Fields'
import type { ClientClass } from './Client'
import type { Builder } from './Build'
import type { Uploader } from './Upload'
import type { CodeId, CodeHash, Hashed } from './Code'
import type { ChainId } from './Chain'
import type { Address, Message, TxHash } from './Tx'
import type { Label } from './Labels'
import type { Agent } from './Agent'
import type { Deployment } from './Deployment'

import { defineCallable } from '@hackbg/allo'
import { hideProperties } from '@hackbg/hide'
import { Task } from '@hackbg/task'
import { codeHashOf } from './Code'
import { assertAddress } from './Tx'
import { defineTask, override, Maybe, into, map, mapAsync, defineDefault } from './Fields'
import { Client } from './Client'
import { writeLabel } from './Labels'
import { assertBuilder } from './Build'
import { upload, uploadMany } from './Upload'
import { buildMany } from './Build'

export interface ContractTemplate<C extends Client> {
  (): Task<ContractTemplate<C>, ContractTemplate<C> & Uploaded>
}

function ensureTemplate <C extends Client> (
  this: ContractTemplate<C>
): Task<ContractTemplate<C>, ContractTemplate<C> & Uploaded> {
  return this.uploaded
}

/** Callable object: contract template.
  * Can build and upload, but not instantiate.
  * Can produce deployable Contract instances. */
export class ContractTemplate<C extends Client> extends defineCallable(ensureTemplate) {
  log = new Console(this.constructor.name)
  /** The deployment that this template belongs to. */
  context?:    Deployment     = undefined
  /** URL pointing to Git repository containing the source code. */
  repository?: string|URL     = undefined
  /** Branch/tag pointing to the source commit. */
  revision?:   string         = undefined
  /** Whether there were any uncommitted changes at build time. */
  dirty?:      boolean        = undefined
  /** Path to local Cargo workspace. */
  workspace?:  string         = undefined
  /** Name of crate in workspace. */
  crate?:      string         = undefined
  /** List of crate features to enable during build. */
  features?:   string[]       = undefined
  /** Build procedure implementation. */
  builder?:    Builder        = undefined
  /** Builder implementation that produces a Contract from the Source. */
  builderId?:  string         = undefined
  /** URL to the compiled code. */
  artifact?:   string|URL     = undefined
  /** Code hash uniquely identifying the compiled code. */
  codeHash?:   CodeHash       = undefined
  /** ID of chain on which this contract is uploaded. */
  chainId?:    ChainId        = undefined
  /** Object containing upload logic. */
  uploaderId?: string         = undefined
  /** Upload procedure implementation. */
  uploader?:   Uploader       = undefined
  /** Address of agent that performed the upload. */
  uploadBy?:   Address        = undefined
  /** TXID of transaction that performed the upload. */
  uploadTx?:   TxHash         = undefined
  /** Code ID representing the identity of the contract's code on a specific chain. */
  codeId?:     CodeId         = undefined
  /** The Agent instance that will be used to upload and instantiate the contract. */
  agent?:      Agent          = undefined
  /** The Client subclass that exposes the contract's methods.
    * @default the base Client class. */
  client?:     ClientClass<C> = undefined

  constructor (options: Partial<ContractTemplate<C>> = {}) {
    super()
    this.define(options)
    if (this.context) {
      defineDefault(this, this.context, 'agent')
      defineDefault(this, this.context, 'builder')
      defineDefault(this, this.context, 'uploader')
      defineDefault(this, this.context, 'repository')
      defineDefault(this, this.context, 'revision')
      defineDefault(this, this.context, 'workspace')
    }
    hideProperties(this, 'log')
  }

  /** Provide parameters for an existing instance.
    * @returns mutated self */
  define (options: Partial<ContractTemplate<C>> = {}): this {
    return override(this, options as object)
  }

  /** Define a task (lazily-evaluated async one-shot field).
    * @returns A lazily-evaluated Promise. */
  task <T extends this, U> (name: string, cb: (this: T)=>PromiseLike<U>): Task<T, U> {
    return defineTask(name, cb, this as T)
  }

  get name (): string {
    let name = 'ContractTemplate'
    if (this.crate || this.revision || this.codeId) {
      name += ': '
      if (this.crate)    name += `crate ${this.crate}`
      if (this.revision) name += `@ ${this.revision}`
      if (this.codeId)   name += `(code id ${this.codeId})`
    }
    return name
  }

  get compiled (): Task<this, this & Built> {
    const building = this.build()
    Object.defineProperty(this, 'compiled', { get () { return building } })
    return building
  }

  /** Compile the source using the selected builder.
    * @returns this */
  build (builder?: Builder): Task<this, this & Built> {
    type Self = typeof this
    const name = `compile ${this.crate ?? 'contract'}`
    return this.task(name, async function buildContract (this: Self): Promise<Self & Built> {
      if (!this.artifact) {
        if (!this.crate) throw new Error.NoCrate()
        builder ??= assertBuilder(this)
        const result = await builder!.build(this as Buildable)
        this.define(result as Partial<Self>)
      }
      return this as Self & Built
    })

  }

  /** One-shot deployment task. */
  get uploaded (): Task<this, this & Uploaded> {
    const uploading = this.upload()
    Object.defineProperty(this, 'uploaded', { get () { return uploading } })
    return uploading
  }

  /** Upload compiled source code to the selected chain.
    * @returns task performing the upload */
  upload (uploader?: Uploader): Task<this, this & Uploaded> {
    type Self = typeof this
    const name = `upload ${this.artifact ?? this.crate ?? 'contract'}`
    return this.task(name, async function uploadContract (this: Self): Promise<Self & Uploaded> {
      if (!this.codeId) {
        await this.compiled
        const result = await upload(
          this as Maybe<Buildable> & Uploadable & Maybe<Uploaded>, uploader, uploader?.agent
        )
        this.define(result as Partial<Self>)
      }
      return this as Self & Uploaded
    })
  }

  get asInfo (): ContractInfo {
    return {
      id:        this.codeId!,
      code_hash: this.codeHash!
    }
  }

  /** Get an instance of this contract, or define a new one.
    * @returns task for deploying a contract, returning its client */
  instance (overrides?: Partial<Contract<C>>): Task<Contract<C>, C> {
    const options: Partial<Contract<C>> = {
      ...this as unknown as Partial<Contract<C>>,
      ...overrides
    }
    const instance: Contract<C> = this.context
      ? this.context.contract(options)
      : new Contract(options)
    return instance()
  }

  /** Get a collection of multiple clients to instances of this contract.
    * @returns task for deploying multiple contracts, resolving to their clients */
  instances (contracts: Many<Partial<Contract<C>>>): Task<this, Many<Task<Contract<C>, C>>> {
    type Self = typeof this
    const size = Object.keys(contracts).length
    const name = (size === 1) ? `deploy contract` : `deploy ${size} contracts`
    return this.task(name, async function deployManyContracts (
      this: Self
    ): Promise<Many<Task<Contract<C>, C>>> {
      return map(contracts, (options: Partial<Contract<C>>): Task<Contract<C>, C> => {
        return this.instance(options)
      })
    })
  }
}

export type AnyContract = Contract<Client>

export interface Contract<C extends Client> {
  (): Task<Contract<C>, C>
}

/** Calling a Contract instance invokes this function.
  *
  * - If the contract's address is already populated,
  *   it returns the corresponding Client instance.
  *
  * - If the contract's address is not already available,
  *   it looks up the contract in the deployment receipt by name.
  *
  * - If the contract's name is not in the receipt, it
  *   returns a task that will deploy the contract when `await`ed. */
function ensureContract <C extends Client> (this: Contract<C>): Task<Contract<C>, C> {

  if (this.address) {

    // If the address is available, this contract already exists
    return new Task(`Found ${this.name}`, ()=>{
      return getClientTo(this)
    }, this)

  } else if (this.name && this.context && this.context.hasContract(this.name)) {

    // If the address is not available, but the name is in the receipt,
    // populate self with the data from the receipt, and return the client
    return new Task(`Found ${this.name}`, ()=>{
      const data = this.context!.getContract(this.name!)
      Object.assign(this, data)
      return getClientTo(this)
    }, this)

  } else {

    // Otherwise, deploy the contract
    return this.deployed

  }
}

function getClientTo <C extends Client> (contract: Contract<C>): C {
  const $C = (contract.client ?? Client)
  //@ts-ignore
  const client = new $C(contract.agent, contract.address, contract.codeHash, contract as Contract<C>)
  return client as unknown as C
}

/** Callable object: contract.
  * Can build and upload, and instantiate itself. */
export class Contract<C extends Client> extends defineCallable(ensureContract) {
  log: Console
  /** The deployment that this contract belongs to. */
  context?:    Deployment     = undefined
  /** URL pointing to Git repository containing the source code. */
  repository?: string|URL     = undefined
  /** Branch/tag pointing to the source commit. */
  revision?:   string         = undefined
  /** Whether there were any uncommitted changes at build time. */
  dirty?:      boolean        = undefined
  /** Path to local Cargo workspace. */
  workspace?:  string         = undefined
  /** Name of crate in workspace. */
  crate?:      string         = undefined
  /** List of crate features to enable during build. */
  features?:   string[]       = undefined
  /** Build procedure implementation. */
  builder?:    Builder        = undefined
  /** Builder implementation that produces a Contract from the Source. */
  builderId?:  string         = undefined
  /** URL to the compiled code. */
  artifact?:   string|URL     = undefined
  /** Code hash uniquely identifying the compiled code. */
  codeHash?:   CodeHash       = undefined
  /** ID of chain on which this contract is uploaded. */
  chainId?:    ChainId        = undefined
  /** Object containing upload logic. */
  uploaderId?: string         = undefined
  /** Upload procedure implementation. */
  uploader?:   Uploader       = undefined
  /** Address of agent that performed the upload. */
  uploadBy?:   Address        = undefined
  /** TXID of transaction that performed the upload. */
  uploadTx?:   TxHash         = undefined
  /** Code ID representing the identity of the contract's code on a specific chain. */
  codeId?:     CodeId         = undefined
  /** The Agent instance that will be used to upload and instantiate the contract. */
  agent?:      Agent          = undefined
  /** The Client subclass that exposes the contract's methods.
    * @default the base Client class. */
  client?:     ClientClass<C> = Client as unknown as ClientClass<C>
  /** Address of agent that performed the init tx. */
  initBy?:     Address        = undefined
  /** Address of agent that performed the init tx. */
  initMsg?:    Into<Message>  = undefined
  /** TXID of transaction that performed the init. */
  initTx?:     TxHash         = undefined
  /** Address of this contract instance. Unique per chain. */
  address?:    Address        = undefined
  /** Full label of the instance. Unique for a given Chain. */
  label?:      Label          = undefined
  /** Prefix of the instance label.
    * Identifies which Deployment the instance belongs to, if any.
    * Prepended to contract label with a `/`: `PREFIX/NAME...` */
  prefix?:     Name           = undefined
  /** Proper name of the instance. Unique within the deployment.
    * If the instance is not part of a Deployment, this is equal to the label.
    * If the instance is part of a Deployment, this is used as storage key.
    * You are encouraged to store application-specific versioning info in this field. */
  name?:       Name
  /** Deduplication suffix.
    * Appended to the contract label with a `+`: `...NAME+SUFFIX`.
    * This field has sometimes been used to redeploy an new instance
    * within the same Deployment, taking the place of the old one.
    * TODO: implement this field's semantics: last result of **alphanumeric** sort of suffixes
    *       is "the real one" (see https://stackoverflow.com/a/54427214. */
  suffix?:     Name           = undefined

  constructor (options: Partial<Contract<C>> = {}) {
    super({})
    this.log = new Console(new.target.name)
    const self = this
    if (options.name) setName(options.name)
    if (this.context) setPrefix(this.context.name)
    this.agent      = this.context?.agent      ?? this.agent
    this.builder    = this.context?.builder    ?? this.builder
    this.uploader   = this.context?.uploader   ?? this.uploader
    this.repository = this.context?.repository ?? this.repository
    this.revision   = this.context?.revision   ?? this.revision
    this.workspace  = this.context?.workspace  ?? this.workspace
    override(this, options)
    hideProperties(this, 'log')

    function setName (value: Name) {
      Object.defineProperty(self, 'name', {
        enumerable: true,
        configurable: true,
        get () { return value },
        set (v: string) { setName(v) }
      })
    }

    function setPrefix (value: Name) {
      Object.defineProperty(self, 'prefix', {
        enumerable: true,
        configurable: true,
        get () { return self.context?.name },
        set (v: string) {
          if (v !== self.context?.name) {
            self.log!.warn(`BUG: Overriding prefix from "${self.context?.name}" to "${v}"`)
          }
          setPrefix(v)
        }
      })
    }

  }

  /** Provide parameters for an existing instance.
    * @returns mutated self */
  define (options: Partial<ContractTemplate<C>> = {}): this {
    return override(this, options as object)
  }

  /** Define a task (lazily-evaluated async one-shot field).
    * @returns A lazily-evaluated Promise. */
  task <T extends this, U> (name: string, cb: (this: T)=>PromiseLike<U>): Task<T, U> {
    return defineTask(name, cb, this as T)
  }

  get compiled (): Task<this, this & Built> {
    const building = this.build()
    Object.defineProperty(this, 'compiled', { get () { return building } })
    return building
  }

  /** Compile the source using the selected builder.
    * @returns this */
  build (builder?: Builder): Task<this, this & Built> {
    type Self = typeof this
    const name = `compile ${this.crate ?? 'contract'}`
    return this.task(name, async function buildContract (this: Self): Promise<Self & Built> {
      if (!this.artifact) {
        if (!this.crate) throw new Error.NoCrate()
        builder ??= assertBuilder(this)
        const result = await builder!.build(this as Buildable)
        this.define(result)
      }
      return this as Self & Built
    })

  }

  /** One-shot deployment task. */
  get uploaded (): Task<this, this & Uploaded> {
    const uploading = this.upload()
    Object.defineProperty(this, 'uploaded', { get () { return uploading } })
    return uploading
  }

  /** Upload compiled source code to the selected chain.
    * @returns task performing the upload */
  upload (uploader?: Uploader): Task<this, this & Uploaded> {
    type Self = typeof this
    const name = `upload ${this.artifact ?? this.crate ?? 'contract'}`
    return this.task(name, async function uploadContract (this: Self): Promise<Self & Uploaded> {
      if (!this.codeId) {
        await this.compiled
        const result = await upload(
          this as Maybe<Buildable> & Uploadable & Maybe<Uploaded>, uploader, uploader?.agent
        )
        this.define(result)
      }
      return this as Self & Uploaded
    })
  }

  /** One-shot deployment task. */
  get deployed (): Task<this, C> {
    const deploying = this.deploy()
    Object.defineProperty(this, 'deployed', { get () { return deploying } })
    return deploying
  }

  /** Deploy the contract, or retrieve it if it's already deployed.
    * @returns promise of instance of `this.client`  */
  deploy (initMsg: Into<Message>|undefined = this.initMsg): Task<this, C> {
    type Self = typeof this
    const name = `deploy ${this.name ?? 'contract'}`
    return this.task(name, async function deployContract (this: Self): Promise<C> {
      if (!this.address) {
        if (!this.name) throw new Error.CantInit_NoName()
        if (!this.agent) throw new Error.CantInit_NoAgent(this.name)
        if (!this.initMsg) throw new Error.CantInit_NoMessage(this.name)
        // Construct the full unique label of the contract
        this.label = writeLabel(this)
        if (!this.label) throw new Error.CantInit_NoLabel(this.name)
        // Resolve the provided init message
        this.initMsg ??= await into(initMsg) as Message
        // Make sure the code is compiled and uploaded
        await this.uploaded
        if (!this.codeId) throw new Error.CantInit_NoCodeId(this.name)
        this.log?.beforeDeploy(this, this.label!)
        // Perform the instantiation transaction
        const instance = await this.agent!.instantiate(this as Self)
        // Populate self with result of instantiation (address)
        override(this as Contract<C>, instance)
        this.log?.afterDeploy(this as Partial<Contract<C>>)
        // Add self to deployment (FIXME necessary?)
        if (this.context) this.context.addContract(this.name!, this)
      }
      // Create and return the Client instance used to interact with the contract
      return getClientTo(this)
    })

  }

  /** @returns an instance of this contract's client
    * @throws tf the contract has no known address. */
  expect (): C {
    if (!this.address) {
      if (this.name) {
        throw new Error(`Expected unnamed contract to be already deployed.`)
      } else {
        throw new Error(`Expected contract to be already deployed: ${this.name}`)
      }
    } else {
      return getClientTo(this)
    }
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

  get asInfo (): ContractInfo {
    return {
      id:        this.codeId!,
      code_hash: this.codeHash!
    }
  }

  get asLink (): ContractLink {
    return {
      address:   this.address!,
      code_hash: this.codeHash!
    }
  }

}

export interface ContractGroup<A extends unknown[]> {
  (): Task<ContractGroup<A>, Many<Client>>
}

/** Callable object: contract group.
  * Can build and upload, and instantiate multiple contracts. */
export class ContractGroup<A extends unknown[]> extends defineCallable(
  function ensureContractGroup <A extends unknown[]> (this: ContractGroup<A>, ...args: any) {
    return this.deploy(...args)
  }
) {

  constructor (
    public readonly context:      Deployment,
    public readonly getContracts: (...args: A)=>Many<AnyContract>
  ) {
    super()
  }

  /** Deploy an instance of this contract group. */
  async deploy (...args: A) {
    const contracts = this.getContracts.apply(this.context, args)
    await buildMany(Object.values(contracts) as unknown as Buildable[], this.context)
    await uploadMany(Object.values(contracts) as unknown as Uploadable[], this.context)
    return await mapAsync(contracts, (contract: AnyContract)=>contract.deployed)
  }

  /** Prepare multiple instances of this contract group for deployment. */
  many (instances: Many<A>) {
    const self = this
    /** Define a contract group corresponding to each member of `instances` */
    const groups = mapAsync(
      instances,
      defineContractGroup as unknown as (x:A[0])=>ContractGroup<A>
    )
    /** Deploy the specified contract groups. */
    return async function deployContractGroups (...args: A) {
      return await mapAsync(
        /** Reify the specified contract groups */
        await groups,
        /** Deploy each contract group. */
        function deployContractGroup (group: ContractGroup<A>) {
          return group.deploy(...args)
        }
      )
    }
    /** Defines a new contract group. */
    function defineContractGroup (...args: A) {
      return new ContractGroup(self.context, ()=>self.getContracts(...args))
    }
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
export interface Built extends Partial<Buildable> {
  artifact:   string|URL
  codeHash?:  CodeHash
  builder?:   Builder
  builderId?: string
}

/** @returns the data for saving a build receipt. */
export function toBuildReceipt (s: Partial<Built>) {
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
export interface Uploadable extends Partial<Built> {
  artifact:  string|URL
  chainId:   ChainId,
  codeHash?: CodeHash
}

/** Result of uploading a contract */
export interface Uploaded extends Partial<Uploadable> {
  chainId:   ChainId
  codeId:    CodeId
  codeHash:  CodeHash
  uploader?: Uploader
  uploadBy?: Address
  uploadTx?: TxHash
}

/** @returns the data for saving an upload receipt. */
export function toUploadReceipt (t: Partial<Uploaded>) {
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

/** Objects that have an address and code id. */
export type IntoInfo = Hashed & {
  address: Address
}

/** Reference to an instantiated smart contract, to be used by contracts. */
export interface ContractInfo {
  readonly id:        CodeId
  readonly code_hash: CodeHash
}

/** Reference to an uploaded smart contract, to be used by contracts. */
export interface ContractLink {
  readonly address:   Address
  readonly code_hash: CodeHash
}
