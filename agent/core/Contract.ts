import type {
  Label, CodeId, CodeHash, Hashed, Address, Message, TxHash, Into, Name, Named, Many, Class,
  ClientClass, Builder, Uploader, Buildable, Built, Uploadable, Uploaded, ContractInfo, ChainId,
  Agent, Deployment
} from '../index'
import {
  Error, Console, hideProperties, Task, defineTask, override, Maybe, into, map, mapAsync,
  defineDefault
} from '../util/index'
import { codeHashOf } from './Code'
import { assertAddress } from './Tx'
import { Client } from './Client'
import { writeLabel } from './Labels'
import { assertBuilder } from './Build'
import Template, { toUploadReceipt } from './Template'

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
export class Contract<C extends Client> extends Template<C> {
  log: Console
  /** Address of agent that performed the init tx. */
  initBy?:  Address        = undefined
  /** Address of agent that performed the init tx. */
  initMsg?: Into<Message>  = undefined
  /** TXID of transaction that performed the init. */
  initTx?:  TxHash         = undefined
  /** Address of this contract instance. Unique per chain. */
  address?: Address        = undefined
  /** Full label of the instance. Unique for a given Chain. */
  label?:   Label          = undefined
  /** Prefix of the instance label.
    * Identifies which Deployment the instance belongs to, if any.
    * Prepended to contract label with a `/`: `PREFIX/NAME...` */
  prefix?:  Name           = undefined
  /** Proper name of the instance. Unique within the deployment.
    * If the instance is not part of a Deployment, this is equal to the label.
    * If the instance is part of a Deployment, this is used as storage key.
    * You are encouraged to store application-specific versioning info in this field. */
  name?:    Name
  /** Deduplication suffix.
    * Appended to the contract label with a `+`: `...NAME+SUFFIX`.
    * This field has sometimes been used to redeploy an new instance
    * within the same Deployment, taking the place of the old one.
    * TODO: implement this field's semantics: last result of **alphanumeric** sort of suffixes
    *       is "the real one" (see https://stackoverflow.com/a/54427214. */
  suffix?:  Name           = undefined

  constructor (options: Partial<Contract<C>> = {}) {
    super({})
    const self = this
    if (options.name) setName(options.name)
    if (this.context) setPrefix(this.context.name)
    this.log = new Console(`Contract: ${this.name ?? new.target.name}`)
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
      if (!this.name) {
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
export class ContractGroup<A extends unknown[]> {

  constructor (
    public readonly context:      Deployment,
    public readonly getContracts: (...args: A)=>Many<AnyContract>
  ) {
  }

  /** Deploy an instance of this contract group. */
  async deploy (...args: A) {
    const contracts = this.getContracts.apply(this.context, args)
    if (!this.context.builder) throw new Error.NoBuilder()
    await this.context.builder.buildMany(Object.values(contracts) as unknown as Buildable[])
    if (!this.context.uploader) throw new Error.NoUploader()
    await this.context.uploader.uploadMany(Object.values(contracts) as unknown as Uploadable[])
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

/** Reference to an uploaded smart contract, to be used by contracts. */
export interface ContractLink {
  readonly address:   Address
  readonly code_hash: CodeHash
}
