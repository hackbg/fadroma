import { Uploader, UploaderClass } from '@fadroma/agent'
import { ConnectConfig } from '@fadroma/connect'
import $ from '@hackbg/file'
export default class UploadConfig extends ConnectConfig {

  /** Project root. Defaults to current working directory. */
  project: string = this.getString(
    'FADROMA_PROJECT',
    () => this.environment.cwd)

  /** Whether to always upload contracts, ignoring upload receipts that match. */
  reupload: boolean = this.getFlag(
    'FADROMA_REUPLOAD',
    () => false)

  /** Directory to store the receipts for the deployed contracts. */
  uploadState: string|null = this.getString(
    'FADROMA_UPLOAD_STATE',
    () => this.chainId ? $(this.project).in('receipts').in(this.chainId).in('uploads').path : null)

  /** Variant of uploader to use */
  uploader: string = this.getString(
    'FADROMA_UPLOADER',
    () => 'FS')

  getUploader <U extends Uploader> (
    $U: UploaderClass<U> = Uploader.variants[this.uploader] as UploaderClass<U>
  ): U {
    return new $U(this.getAgent())
  }

}
