import type { ClientClass, ChainId, Address, TxHash, Agent } from './core-connect'
import type { CodeId, Hashed }                               from './core-code'
import type { Uploader }                                     from './core-upload'
import { Client }                         from './core-connect'
import { codeHashOf }                     from './core-code'
import { ContractSource, toBuildReceipt } from './core-contract-source'
import { ClientError }                    from './core-events'
import { upload }                         from './core-upload'

/** Create a callable object based on ContractTemplate. */
export function defineTemplate <C extends Client> (
  options: Partial<ContractTemplate<C>> = {}
): ContractTemplate<C> & (() => Promise<ContractTemplate<C>>) {

  const template = new ContractTemplate(options)

  const rebind = (obj, [k, v])=>Object.assign(obj, {
    [k]: (typeof v === 'function') ? v.bind(getOrUploadTemplate) : v
  }, {})

  return Object.assign(
    getOrUploadTemplate.bind(getOrUploadTemplate),
    Object.entries(template).reduce(rebind)
  )

  function getOrUploadTemplate () {
    return this.uploaded
  }

}

/** Contract lifecycle object. Represents a smart contract's lifecycle from source to upload. */
export class ContractTemplate<C extends Client> extends ContractSource {
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
  /** The Agent instance that will be used to upload and instantiate the contract. */
  agent?:      Agent    = undefined
  /** The Client subclass that exposes the contract's methods.
    * @default the base Client class. */
  client?:     ClientClass<C> = Client as ClientClass<C>

  constructor (options: Partial<C> = {}) {
    super(options)
    this.define(options as object)
  }

  /** One-shot deployment task. */
  get uploaded (): Promise<ContractTemplate<C>> {
    if (this.codeId) return Promise.resolve(this)
    const uploading = this.upload()
    Object.defineProperty(this, 'uploaded', { get () { return uploading } })
    return uploading
  }

  /** Upload compiled source code to the selected chain.
    * @returns task performing the upload */
  async upload (uploader?: Uploader): Promise<ContractTemplate<C>> {
    return this.task(`upload ${this.artifact ?? this.crate ?? 'contract'}`, async () => {
      await this.compiled
      const result = await upload(this as Uploadable, uploader, uploader?.agent)
      return this.define(result as Partial<this>)
    })
  }

  /** Uploaded templates can be passed to factory contracts in this format. */
  get asInfo (): ContractInfo {
    if (!this.codeId || isNaN(Number(this.codeId)) || !this.codeHash) {
      throw new ClientError.Unpopulated()
    }
    return templateStruct(this)
  }

}

/** For a contract source to be uploadable, it needs to be compiled first,
  * represented by having a populated `artifact` field.
  * An `Uploadable` may also be specified with pre-populated code ID:
  * this means it's already been uploaded and can be reused without reuploading. */
export interface Uploadable {
  artifact:  NonNullable<ContractSource["artifact"]>
  codeHash?: ContractSource["codeHash"]
  uploader?: ContractTemplate<Client>["uploader"]
  chainId?:  ContractTemplate<Client>["chainId"]
  codeId?:   ContractTemplate<Client>["codeId"]
}

/** A successful upload populates the `chainId` and `codeId` fields of a `ContractTemplate`. */
export interface Uploaded extends ContractTemplate<Client> {
  chainId: NonNullable<ContractTemplate<Client>["chainId"]>
  codeId:  NonNullable<ContractTemplate<Client>["codeId"]>
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
