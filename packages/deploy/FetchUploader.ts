import { Uploader } from '@fadroma/core'
import type { Uploadable, Uploaded } from '@fadroma/core'

export default class FetchUploader extends Uploader {

  get id () { return 'Fetch' }

  async upload (contract: Uploadable): Promise<Uploaded> {
    throw new Error('FetchUploader#upload: not implemented')
  }

  async uploadMany (inputs: Array<Uploadable>): Promise<Array<Uploaded>> {
    throw new Error('FetchUploader#uploadMany: not implemented')
  }

}

Uploader.variants['Fetch'] = FetchUploader
