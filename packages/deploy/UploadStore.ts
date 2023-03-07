import type UploadReceipt from './UploadReceipt'

import { JSONDirectory } from '@hackbg/file'

/** Directory collecting upload receipts.
  * Upload receipts are JSON files of the format `$CRATE@$REF.wasm.json`
  * and are kept so that we don't reupload the same contracts. */
export default class UploadStore extends JSONDirectory<UploadReceipt> {}
