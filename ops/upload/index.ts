export { default as UploadStore } from './UploadStore'
export * from './UploadStore'

export { default as FSUploader } from './FSUploader'
export * from './FSUploader'

import { Config } from '../util'
import type { UploadConfig } from '../util'
import type { Uploader, Uploadable, Uploaded } from '@fadroma/agent'

/** @returns Uploader configured as per environment and options */
export function getUploader (options: Partial<UploadConfig> = {}): Uploader {
  return new Config({ upload: options }).getUploader()
}

/** Upload a single contract with default settings. */
export function upload (artifact: Uploadable): Promise<Uploaded> {
  return getUploader().upload(artifact)
}

/** Upload multiple contracts with default settings. */
export function uploadMany (artifacts: Uploadable[]): Promise<Uploaded[]> {
  return getUploader().uploadMany(artifacts)
}
