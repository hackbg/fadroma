import type {
  Many, CodeId, CodeHash, Hashed, Address, TxHash, ChainId,
  Agent, ClientClass, Builder, Uploader, Deployment
} from '../index'
import {
  Error, Console, override, defineDefault, map, Task, hideProperties
} from '../util'
import { Client } from './Client'
import { assertBuilder } from './Build'
import { Contract } from './Contract'

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

/** Callable object: contract template.
  * Can build and upload, but not instantiate.
  * Can produce deployable Contract instances. */
export default class Template<C extends Client> {
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

  constructor (options: Partial<Template<C>> = {}) {
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
  define (options: Partial<Template<C>> = {}): this {
    return override(this, options as object)
  }

  /** Define a task (lazily-evaluated async one-shot field).
    * @returns A lazily-evaluated Promise. */
  task <T extends this, U> (name: string, cb: (this: T)=>PromiseLike<U>): Task<T, U> {
    return defineTask(name, cb, this as T)
  }

  get info (): string {
    let name = 'Template'
    if (this.crate || this.revision || this.codeId) {
      name += ': '
      if (this.crate)    name += `crate ${this.crate}`
      if (this.revision) name += `@ ${this.revision}`
      if (this.codeId)   name += `(code id ${this.codeId})`
    }
    return name
  }

  get compiled (): Promise<this & Built> {
    return this.build()
  }

  /** Compile the source using the selected builder.
    * @returns this */
  build (builder: Builder|undefined = this.builder): Promise<this & Built> {
    const name = `compile ${this.crate ?? 'contract'}`
    const building = new Promise<this & Built>(async (resolve, reject)=>{
      if (!this.artifact) {
        if (!this.crate) throw new Error.NoCrate()
        builder ??= assertBuilder(this)
        const result = await builder!.build(this as Buildable)
        this.define(result as Partial<this>)
      }
      return this
    })
    Object.defineProperty(this, 'compiled', { get () { return building } })
    return building
  }

  /** One-shot deployment task. */
  get uploaded (): Promise<this & Uploaded> {
    return this.upload()
  }

  /** Upload compiled source code to the selected chain.
    * @returns task performing the upload */
  upload (uploader: Uploader|undefined = this.uploader): Promise<this & Uploaded> {
    const name = `upload ${this.artifact ?? this.crate ?? 'contract'}`
    const uploading = new Promise<this & Uploaded>(async (resolve, reject)=>{
      if (!this.codeId) {
        await this.compiled
        if (!uploader) throw new Error.NoUploader()
        const result = await uploader.upload(this as Uploadable)
        this.define(result as Partial<this>)
      }
      return resolve(this as this & Uploaded)
    })
    Object.defineProperty(this, 'uploaded', { get () { return uploading } })
    return uploading
  }

  /** @returns a Contract representing a specific instance of this Template. */
  instance (options?: Partial<Contract<C>>): Contract<C> {
    // Use values from Template as defaults for Contract
    options = { ...this as unknown as Partial<Contract<C>>, ...options }
    // Create the Contract
    const instance: Contract<C> = this.context
      ? this.context.contract(options)
      : new Contract(options)
    return instance
  }

  /** Get a collection of multiple clients to instances of this contract.
    * @returns task for deploying multiple contracts, resolving to their clients */
  instances (contracts: Many<Partial<Contract<C>>>): Task<this, Many<Promise<C>>> {
    type Self = typeof this
    const size = Object.keys(contracts).length
    const name = (size === 1) ? `deploy contract` : `deploy ${size} contracts`
    const tasks = map(contracts, contract=>this.instance(contract))
    return this.task(name, async function deployManyContracts (
      this: Self
    ): Promise<Many<Promise<C>>> {
      return map(tasks, (task: Partial<Contract<C>>): Promise<C> => task.deployed!)
    })
  }

  get asInfo (): ContractInfo {
    return {
      id:        this.codeId!,
      code_hash: this.codeHash!
    }
  }

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

/** Objects that have an address and code id. */
export type IntoInfo = Hashed & {
  address: Address
}

/** Reference to an instantiated smart contract, to be used by contracts. */
export interface ContractInfo {
  readonly id:        CodeId
  readonly code_hash: CodeHash
}

export function defineTask <T, U> (
  name:     string,
  cb:       (this: T)=>U|PromiseLike<U>,
  context?: T & { log?: Console }
): Task<T, U> {
  const task = new Task(name, cb, context as unknown as T)
  const [_, head, ...body] = (task.stack ?? '').split('\n')
  task.stack = '\n' + head + '\n' + body.slice(3).join('\n')
  task.log   = (context?.log ?? task.log) as any
  return task as Task<T, U>
}
