import type { Task } from '@hackbg/task'
import type { Into, Name, Named, Many, Class } from './core-fields'
import type { ClientClass } from './core-client'
import type { Builder } from './core-build'
import type { Uploader } from './core-upload'
import type { CodeId, CodeHash, Hashed } from './core-code'
import type { ChainId } from './core-chain'
import type { Address, Message, TxHash } from './core-tx'
import type { Label } from './core-labels'
import type { Agent } from './core-agent'
import type { Deployment } from './core-deployment'
import type { AnyContract, Buildable, Uploadable, ContractLink, IntoLink } from './core-contract'

import { codeHashOf } from './core-code'
import { assertAddress } from './core-tx'
import { rebind, override, Maybe, defineTask, into, map, mapAsync, defineDefault } from './core-fields'
import { Client } from './core-client'
import { ClientError as Error } from './core-events'
import { writeLabel } from './core-labels'
import { assertBuilder } from './core-build'
import { upload } from './core-upload'
import { buildMany } from './core-build'
import { uploadMany } from './core-upload'

export abstract class ContractTemplate<C extends Client> {
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
  client?:     ClientClass<C> = Client as ClientClass<C>

  constructor (options: Partial<ContractTemplate<C>> = {}) {
    override(this, options)
    if (this.context) {
      defineDefault(this, this.context, 'agent')
      defineDefault(this, this.context, 'builder')
      defineDefault(this, this.context, 'uploader')
      defineDefault(this, this.context, 'repository')
      defineDefault(this, this.context, 'revision')
      defineDefault(this, this.context, 'workspace')
    }
  }

  /** Set multiple parameters.
    * @returns mutated self */
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
      if (!this.crate) throw new Error.NoCrate()
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

  /** Define a new instance of this contract. */
  abstract defineInstance (id: Name, init: Message): Contract<C>
  abstract defineInstance (options?: Partial<Contract<C>>): Contract<C>
}

export type ContractDeployArgs<C extends Client> = [Name, Message]|[Partial<Contract<C>>]

export abstract class Contract<C extends Client> extends ContractTemplate<C> {
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
  /** Prefix of the instance label.
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
    super()
    override(this, options)
    if (this.context) {
      defineDefault(this, this.context, 'agent')
      defineDefault(this, this.context, 'builder')
      defineDefault(this, this.context, 'uploader')
      defineDefault(this, this.context, 'repository')
      defineDefault(this, this.context, 'revision')
      defineDefault(this, this.context, 'workspace')
      const self = this
      setPrefix(this.context.name)
      function setPrefix (value: string) {
        Object.defineProperty(self, 'prefix', {
          enumerable: true,
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
    override(this, options)
  }

  /** One-shot deployment task. */
  get deployed (): Task<this, C> {
    if (this.address) {
      this.log?.foundDeployedContract(this.address, this.id)
      const $C     = (this.client ?? Client)
      const client = new $C(this.agent, this.address, this.codeHash, this as any)
      return Promise.resolve(client)
    }
    const deploying = this.deploy()
    Object.defineProperty(this, 'deployed', { get () { return deploying } })
    return deploying
  }

  /** Deploy the contract, or retrieve it if it's already deployed.
    * @returns promise of instance of `this.client`  */
  deploy (initMsg: Into<Message>|undefined = this.initMsg): Task<this, C> {
    return defineTask(`deploy ${this.id ?? 'contract'}`, deployContract, this)
    const self = this
    async function deployContract (this: typeof self) {
      if (!this.agent)   throw new Error.NoAgent()
      if (!this.id)      throw new Error.NoName()
      this.label = writeLabel(this)
      if (!this.label)   throw new Error.NoInitLabel()
      if (!this.initMsg) throw new Error.NoInitMessage()
      await this.uploaded
      if (!this.codeId)  throw new Error.NoInitCodeId()
      this.initMsg ??= await into(initMsg) as Message
      this.log?.beforeDeploy(this, this.label!)
      const contract = await this.agent!.instantiate(this as typeof self)
      this.define(contract as Partial<typeof self>)
      this.log?.afterDeploy(this as Partial<Contract<C>>)
      if (this.context) this.context.addContract(this.id!, contract)
      const $C = (this.client ?? Client)
      const client = new $C(this.agent, this.address, this.codeHash, this as any)
      return client
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

  get asLink (): ContractLink {
    return linkStruct(this as unknown as IntoLink)
  }

  abstract many (contracts: Many<[Name, Message]|Partial<this>>):
    Task<this, Many<Task<this, C>>>

}

export class ContractGroup<A extends unknown[]> {

  constructor (
    public readonly context:      Deployment,
    public readonly getContracts: (...args: A)=>Many<AnyContract>
  ) {}

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

/** Convert Fadroma.Instance to address/hash struct (ContractLink) */
export const linkStruct = (instance: IntoLink): ContractLink => ({
  address:   assertAddress(instance),
  code_hash: codeHashOf(instance)
})
