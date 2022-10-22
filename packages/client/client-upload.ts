import type { Overridable } from './client-fields'
import type { Agent } from './client-connect'
import { fetchCodeHash, getSourceSpecifier } from './client-contract'
import type { CodeHash, ContractTemplate, CodeId, ContractSource } from './client-contract'
import { ClientError } from './client-events'

export function upload <T extends ContractTemplate & {
  uploader?: Uploader,
  codeHash?: CodeHash
}> (
  template:  T,
  uploader?: Uploader,
  agent:     Agent|null|undefined = uploader?.agent
): Promise<T> {
  // If the object already contains chain ID and code ID, that means it's uploaded
  if (template.chainId && template.codeId) {
    // If it also has the code hash, we're good to go
    if (template.codeHash) return Promise.resolve(template)
    // If it has no code hash, fetch it from the chain by the code id and that's it
    return fetchCodeHash(template, agent).then(codeHash=>Object.assign(template, { codeHash }))
  }
  // If the chain ID or code hash is missing though, it means we need to upload
  // Name the task
  const name = `upload ${getSourceSpecifier(template)}`
  return template.task(name, async (): Promise<T> => {
    // Otherwise we're gonna need the uploader
    uploader ??= assertUploader(template)
    // And if we still can't determine the chain ID, bail
    const chainId = undefined
      ?? uploader.chain?.id
      ?? uploader.agent?.chain?.id
      ?? (template as any)?.agent?.chain?.id
    if (!chainId) throw new ClientError.NoChainId()
    // If we have chain ID and code ID, try to get code hash
    if (template.codeId) template.codeHash = await fetchCodeHash(template, agent)
    // Replace with built and return uploaded
    if (!template.artifact) await template.build()
    return uploader.upload(template)
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
  abstract upload <T extends ContractSource> (template: T): Promise<T & {
    codeId:   CodeId
    codeHash: CodeHash,
  }>
  /** Upload multiple contracts. */
  abstract uploadMany (templates: ContractSource[]): Promise<ContractTemplate[]>
}

/** @returns the uploader of the thing
  * @throws  NoUploader if missing or NoUploaderAgent if the uploader has no agent. */
export function assertUploader ({ uploader }: { uploader?: Uploader }): Uploader {
  if (!uploader) throw new ClientError.NoUploader()
  //if (typeof uploader === 'string') throw new ClientError.ProvideUploader(uploader)
  if (!uploader.agent) throw new ClientError.NoUploaderAgent()
  return uploader
}
