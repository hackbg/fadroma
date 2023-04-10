export { default as UploadConsole } from './UploadConsole'
export * from './UploadConsole'

export { default as UploadError } from './UploadError'
export * from './UploadError'

export { default as UploadConfig } from './UploadConfig'
export * from './UploadConfig'

export { default as UploadStore } from './UploadStore'
export * from './UploadStore'

export { default as FSUploader } from './FSUploader'
export * from './FSUploader'

import UploadConfig from './UploadConfig'
import type { Uploader, Uploadable, Uploaded } from '@fadroma/agent'

/** @returns Uploader configured as per environment and options */
export function getUploader (options: Partial<UploadConfig> = {}): Uploader {
  return new UploadConfig(options).getUploader()
}

/** Upload a single contract with default settings. */
export function upload (artifact: Uploadable): Promise<Uploaded> {
  return getUploader().upload(artifact)
}

/** Upload multiple contracts with default settings. */
export function uploadMany (artifacts: Uploadable[]): Promise<Uploaded[]> {
  return getUploader().uploadMany(artifacts)
}
