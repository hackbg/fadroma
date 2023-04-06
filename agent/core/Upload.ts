import type {
  Address, TxHash, ChainId, Agent, ClientClass, Deployment, Buildable, Uploadable, Uploaded,
  Maybe, Overridable, Hashed, CodeHash, CodeId
} from '../index'

import { Error, Console, defineTask, pluralize } from '../util/index'
import { Client } from './Client'
import { fetchCodeHash, getSourceSpecifier } from './Code'

/** A constructor for an Uploader subclass. */
export interface UploaderClass<U extends Uploader> {
  new (agent?: Agent|null): U
}

/** Uploader: uploads a `Contract`'s `artifact` to a specific `Chain`,
  * binding the `Contract` to a particular `chainId` and `codeId`. */
export abstract class Uploader {

  /** Global registry of Uploader implementations.
    * Populated by @fadroma/ops */
  static variants: Record<string, UploaderClass<Uploader>> = {}
 
  constructor (
    public agent?: Agent|null
  ) {}

  /** Unique identifier of this uploader implementation. */
  abstract id: string

  /** Upload a contract.
    * @returns the contract with populated codeId and codeHash */
  abstract upload (source: Uploadable): Promise<Uploaded>

  /** Upload multiple contracts. */
  abstract uploadMany (sources: Uploadable[]): Promise<Uploaded[]>

  /** Chain to which this uploader uploads contracts. */
  get chain () { return this.agent?.chain }

  checkCodeHash (
    a: { codeHash?: CodeHash, artifact?: string|URL },
    b: { codeHash?: CodeHash }
  ) {
    if (
      a.codeHash && b.codeHash &&
      a.codeHash.toUpperCase() !== b.codeHash.toUpperCase()
    ) {
      throw new Error(
        `Code hash mismatch when uploading ${a.artifact?.toString()}: ` +
        `${a.codeHash} vs ${b.codeHash}`
      )
    }
  }

  /** Panic if the code hash returned by the upload
    * doesn't match the one specified in the Contract. */
  protected checkLocalCodeHash (input: Uploadable & { codeHash: CodeHash }, output: Uploaded) {
    if (input.codeHash !== output.codeHash) {
      throw new Error(`
        The upload transaction ${output.uploadTx}
        returned code hash ${output.codeHash} (of code id ${output.codeId})
        instead of the expected ${input.codeHash} (of artifact ${input.artifact})
      `.trim().split('\n').map(x=>x.trim()).join(' '))
    }
  }

}

/** @returns the uploader of the thing
  * @throws  NoUploader if missing or NoUploaderAgent if the uploader has no agent. */
export function assertUploader ({ uploader }: { uploader?: Uploader }): Uploader {
  if (!uploader) throw new Error.NoUploader()
  //if (typeof uploader === 'string') throw new Error.ProvideUploader(uploader)
  if (!uploader.agent) throw new Error.NoUploaderAgent()
  return uploader
}

export class FetchUploader extends Uploader {

  get id () { return 'Fetch' }

  async upload (contract: Uploadable): Promise<Uploaded> {
    throw new Error('FetchUploader#upload: not implemented')
  }

  async uploadMany (inputs: Array<Uploadable>): Promise<Array<Uploaded>> {
    throw new Error('FetchUploader#uploadMany: not implemented')
  }

}

Uploader.variants['Fetch'] = FetchUploader
