import type { Overridable } from './client-fields'
import type { Agent, ChainId } from './client-connect'
import { ContractTemplate } from './client-contract'
import type { ContractSource } from './client-contract'
import { ClientError } from './client-events'
import type { CodeHash, CodeId } from './client-code'
import { fetchCodeHash, getSourceSpecifier } from './client-code'

/** For a contract source to be uploadable, it needs to be compiled first,
  * represented by having a populated `artifact` field.
  * An `Uploadable` may also be specified with pre-populated code ID:
  * this means it's already been uploaded and can be reused without reuploading. */
export interface Uploadable {
  artifact:  NonNullable<ContractSource["artifact"]>
  codeHash?: ContractSource["codeHash"]
  uploader?: ContractTemplate["uploader"]
  chainId?:  ContractTemplate["chainId"]
  codeId?:   ContractTemplate["codeId"]
}

/** A successful upload populates the `chainId` and `codeId` fields of a `ContractTemplate`. */
export interface Uploaded extends ContractTemplate {
  chainId: NonNullable<ContractTemplate["chainId"]>
  codeId:  NonNullable<ContractTemplate["chainId"]>
}

export function intoTemplate (x: Partial<ContractTemplate>) {
  if (x instanceof ContractTemplate) return x
  return new ContractTemplate(x)
}

/** Standalone upload function. */
export async function upload (
  source:   Uploadable,
  uploader: Uploader|undefined   = source.uploader,
  agent:    Agent|null|undefined = uploader?.agent
): Promise<Uploaded> {

  // If the object already contains chain ID and code ID, that means it's uploaded
  if (source.chainId && source.codeId) {
    // If it has no code hash, fetch from chain by code id
    // so that we can validate against it alter
    source.codeHash ??= await fetchCodeHash(source, agent)

    return intoTemplate(source) as Uploaded
  }

  // If the chain ID or code hash is missing though, it means we need to upload:

  // Name the task
  const name = `upload ${getSourceSpecifier(source)}`
  return source.task(name, async (): Promise<T> => {

    // We're gonna need an uploader
    uploader ??= assertUploader(source)

    // And if we still can't determine the chain ID, bail
    const chainId = undefined
      ?? uploader.chain?.id
      ?? uploader.agent?.chain?.id
      ?? (source as any)?.agent?.chain?.id
    if (!chainId) throw new ClientError.NoChainId()

    // If we have chain ID and code ID, try to get code hash
    if (source.codeId) source.codeHash = await fetchCodeHash(source, agent)

    // Replace with built and return uploaded
    if (!source.artifact) await source.build()

    return uploader.upload(source)
  })

}

export type IntoUploader = string|UploaderClass<Uploader>|Partial<Uploader>

/** A constructor for an Uploader subclass. */
export interface UploaderClass<U extends Uploader> extends Overridable<Uploader, IntoUploader> {
}

/** Uploader: uploads a `Contract`'s `artifact` to a specific `Chain`,
  * binding the `Contract` to a particular `chainId` and `codeId`. */
export abstract class Uploader {
  /** Populated by @fadroma/deploy */
  static variants: Record<string, UploaderClass<Uploader>> = {}

  constructor (public agent?: Agent|null) {}
  /** Chain to which this uploader uploads contracts. */
  get chain () { return this.agent?.chain }
  /** Fetch the code hash corresponding to a code ID */
  async getHash (id: CodeId): Promise<CodeHash> {
    return await this.agent!.getHash(Number(id))
  }
  /** Unique identifier of this uploader implementation. */
  abstract id: string
  /** Upload a contract.
    * @returns the contract with populated codeId and codeHash */
  abstract upload (source: Uploadable): Promise<Uploaded>
  /** Upload multiple contracts. */
  abstract uploadMany (sources: Uploadable[]): Promise<Uploaded[]>
}

/** @returns the uploader of the thing
  * @throws  NoUploader if missing or NoUploaderAgent if the uploader has no agent. */
export function assertUploader ({ uploader }: { uploader?: Uploader }): Uploader {
  if (!uploader) throw new ClientError.NoUploader()
  //if (typeof uploader === 'string') throw new ClientError.ProvideUploader(uploader)
  if (!uploader.agent) throw new ClientError.NoUploaderAgent()
  return uploader
}
