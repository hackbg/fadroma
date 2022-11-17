import { Client } from './core-client'
import { ClientError as Error } from './core-events'
import { fetchCodeHash, getSourceSpecifier } from './core-code'
import { build } from './core-build'
import { defineTask, Maybe } from './core-fields'
import type { Agent } from './core-agent'
import type { Overridable } from './core-fields'
import type { ChainId } from './core-chain'
import type { ClientClass } from './core-client'
import type { Address, TxHash } from './core-tx'
import type { Hashed, CodeHash, CodeId } from './core-code'
import type { Buildable, Uploadable, Uploaded } from './core-contract'
import type { Deployment } from './core-deployment'

/** Standalone upload function. */
export async function upload (
  source:   Maybe<Buildable> & Uploadable & Maybe<Uploaded>,
  uploader: Maybe<Uploader>   = source.uploader,
  agent:    Maybe<Agent>|null = uploader?.agent
): Promise<Uploaded> {

  // If the object already contains chain ID and code ID, that means it's uploaded
  if (source.chainId && source.codeId) {
    // If it has no code hash, fetch from chain by code id
    // so that we can validate against it alter
    source.codeHash ??= await fetchCodeHash(source, agent)
    return source as Uploaded
  }

  // If the chain ID or code hash is missing though, it means we need to upload:
  return defineTask(`upload ${getSourceSpecifier(source)}`, doUpload, source)

  async function doUpload (): Promise<Uploaded> {

    // We're gonna need an uploader
    uploader ??= assertUploader(source)

    // And if we still can't determine the chain ID, bail
    const chainId = undefined
      ?? uploader.chain?.id
      ?? uploader.agent?.chain?.id
      ?? (source as any)?.agent?.chain?.id
    if (!chainId) throw new Error.NoChainId()

    // If we have chain ID and code ID, try to get code hash
    if (source.codeId) source.codeHash = await fetchCodeHash(source, agent)

    // Replace with built and return uploaded
    if (!source.artifact) await build(source)

    return uploader.upload(source)
  }

}

export async function uploadMany (
  contracts: Uploadable[],
  context:   Partial<Deployment>,
): Promise<Uploaded[]> {
  return defineTask(`upload ${contracts.length} contracts`, async () => {
    if (!context.uploader) throw new Error.NoUploader()
    if (contracts.length === 0) return Promise.resolve([])
    const count = (contracts.length > 1)
      ? `${contracts.length} contract: `
      : `${contracts.length} contracts:`
    return defineTask(`upload ${count} artifacts`, () => {
      if (!context.uploader) throw new Error.NoUploader()
      return context.uploader.uploadMany(contracts)
    }, context)
  }, context)
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
  if (!uploader) throw new Error.NoUploader()
  //if (typeof uploader === 'string') throw new Error.ProvideUploader(uploader)
  if (!uploader.agent) throw new Error.NoUploaderAgent()
  return uploader
}
