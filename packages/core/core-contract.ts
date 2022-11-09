export * from './core-contract-source'
export * from './core-contract-template'
export * from './core-contract-instance'

import type { Task } from '@hackbg/komandi'
import type { Client } from './core-client'
import type { Builder } from './core-build'
import type { Uploader } from './core-upload'
import type { CodeId, CodeHash } from './core-code'
import type { ChainId } from './core-chain'
import type { Address, Message, TxHash } from './core-tx'
import type { Name, Label } from './core-labels'

import { codeHashOf } from './core-code'
import { assertAddress } from './core-tx'
import { rebind, override } from './core-fields'

/** Create a callable object based on Contract. */
export function defineContract <C extends Client> (
  options: Partial<Contract<C>> = {}
): Contract<C> & (()=> Task<Contract<C>, C>) {

  let fn = function getOrDeployInstance (
    ...args: [Name, Message]|[Partial<Contract<C>>]
  ): Task<Contract<C>, C> {
    let options
    if (typeof args[0] === 'string') {
      const [name, initMsg] = args
      options = { name, initMsg }
    } else if (typeof args[0] === 'object') {
      options = args[0]
    }
    if (fn.context) {
      if (fn.context.contract.has(options.name)) {
        return fn.context.contract.get(options.name)
      } else {
        return fn.context.contract.set(options.name, defineContract({...fn, ...options}).deployed)
      }
    } else {
      return defineContract({...fn, ...options}).deployed
    }
  }

  fn = fn.bind(fn)

  return rebind(fn, new Contract(options)) as Contract<C> & (()=> Task<Contract<C>, C>)

}

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
  /** Proper name of the instance.
    * If the instance is not part of a Deployment, this is equal to the label.
    * If the instance is part of a Deployment, this is used as storage key.
    * You are encouraged to store application-specific versioning info in this field. */
  name?:       Name          = undefined
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
  artifact: string|URL
  chainId:  ChainId
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
export interface IntoLink extends Hashed {
  address: Address
}

/** Reference to an instantiated smart contract,
  * in the format of Fadroma ICC. */
export interface ContractLink {
  readonly address:   Address
  readonly code_hash: CodeHash
}
