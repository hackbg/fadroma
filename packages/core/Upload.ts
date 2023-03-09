import Error   from './Error'
import Console from './Console'

import { Client } from './Client'
import { fetchCodeHash, getSourceSpecifier } from './Code'
import { build } from './Build'
import { defineTask, pluralize } from './Fields'
import type { Agent } from './Agent'
import type { Maybe, Overridable } from './Fields'
import type { ChainId } from './Chain'
import type { ClientClass } from './Client'
import type { Address, TxHash } from './Tx'
import type { Hashed, CodeHash, CodeId } from './Code'
import type { Buildable, Uploadable, Uploaded } from './Contract'
import type { Deployment } from './Deployment'

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

/** Standalone multi-upload function. */
export async function uploadMany (
  contracts: Uploadable[],
  context:   Partial<Deployment>,
): Promise<Uploaded[]> {
  return defineTask(`upload ${contracts.length} contracts`, async () => {
    if (!context.uploader) throw new Error.NoUploader()
    if (contracts.length === 0) return Promise.resolve([])
    const count = pluralize(contracts, 'contract', 'contracts')
    const name  = `upload ${count}:`
    return defineTask(name, async function uploadManyContracts () {
      if (!context.uploader) throw new Error.NoUploader()
      const result = await context.uploader.uploadMany(contracts)
      return result
    }, context)
  }, context)
}

/** A constructor for an Uploader subclass. */
export interface UploaderClass<U extends Uploader> {
  new (agent?: Agent|null): U
}

/** Uploader: uploads a `Contract`'s `artifact` to a specific `Chain`,
  * binding the `Contract` to a particular `chainId` and `codeId`. */
export abstract class Uploader {
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

  /** Global registry of Uploader implementations.
    * Populated by @fadroma/deploy */
  static variants: Record<string, UploaderClass<Uploader>> = {}
}

/** @returns the uploader of the thing
  * @throws  NoUploader if missing or NoUploaderAgent if the uploader has no agent. */
export function assertUploader ({ uploader }: { uploader?: Uploader }): Uploader {
  if (!uploader) throw new Error.NoUploader()
  //if (typeof uploader === 'string') throw new Error.ProvideUploader(uploader)
  if (!uploader.agent) throw new Error.NoUploaderAgent()
  return uploader
}
