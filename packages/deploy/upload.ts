import type { Many } from '@hackbg/many'
import type { Uploader, Uploadable, Uploaded } from '@fadroma/core'
import UploaderConfig from './UploadConfig'

export default function uploader (options: Partial<UploaderConfig> = {}): Uploader {
  return new UploaderConfig(options).getUploader()
}

export { default as FSUploader } from './FSUploader'
export * from './FSUploader'

export { default as FetchUploader } from './FetchUploader'
export * from './FetchUploader'

export { default as UploadConsole } from './UploadConsole'
export * from './UploadConsole'

export { default as UploadError } from './UploadError'
export * from './UploadError'

export { default as UploadStore } from './UploadStore'
export * from './UploadStore'
