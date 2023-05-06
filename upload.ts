import type { UploadStore_JSON1 } from './stores'
import { Config,  Console, colors, bold, Error, hideProperties as hide } from './util'
import type { UploadConfig } from './util'
import { Template, Uploader, assertAgent, toUploadReceipt, base16, sha256 } from '@fadroma/agent'
import type {
  Agent, CodeHash, ChainId, CodeId, Uploadable, Uploaded, UploadStore, AnyContract
} from '@fadroma/agent'
import $, { Path, BinaryFile, JSONFile, JSONDirectory } from '@hackbg/file'
import { fileURLToPath } from 'node:url'

/** @returns Uploader configured as per environment and options */
export function getUploader (options: Partial<UploadConfig> = {}): Uploader {
  return new Config({ upload: options }).getUploader()
}
/** Upload a single contract with default settings. */
export function upload (artifact: Uploadable): Promise<Uploaded> {
  return getUploader().upload(artifact)
}
/** Upload multiple contracts with default settings. */
export function uploadMany (artifacts: Uploadable[]): Promise<(Uploaded|null)[]> {
  return getUploader().uploadMany(artifacts)
}

/** Uploads contracts from the local filesystem, with optional caching:
  * if provided with an Uploads directory containing upload receipts,
  * allows for uploaded contracts to be reused. */
export class FSUploader extends Uploader {
  log = new Console('FSUploader')
  /** Unique identifier of this uploader implementation. */
  id = 'FS'
  /** FSUploader only works with local JSON store. */
  declare store: UploadStore_JSON1

  get [Symbol.toStringTag] () { return this.store?.shortPath ?? '(*)' }

  protected async fetch (path: string|URL): Promise<Uint8Array> {
    return $(fileURLToPath(new URL(path, 'file:'))).as(BinaryFile).load()
  }
}

Uploader.variants['FS'] = FSUploader
