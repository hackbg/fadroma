import { Contract } from '@fadroma/core'
import { JSONFile, JSONDirectory } from '@hackbg/file'

/** Directory collecting upload receipts.
  * Upload receipts are JSON files of the format `$CRATE@$REF.wasm.json`
  * and are kept so that we don't reupload the same contracts. */
export class UploadStore extends JSONDirectory<UploadReceipt> {}

/** Class that convert itself to a Contract, from which contracts can be instantiated. */
export class UploadReceipt extends JSONFile<{
  artifact?:          any
  chainId?:           string
  codeHash:           string
  codeId:             number|string
  compressedChecksum: string
  compressedSize:     string
  logs:               any[]
  originalChecksum:   string
  originalSize:       number
  transactionHash:    string
  uploadTx?:          string
}> {

  /** Create a Contract object with the data from the receipt. */
  toContract (defaultChainId?: string) {
    let { chainId, codeId, codeHash, uploadTx, artifact } = this.load()
    chainId ??= defaultChainId
    codeId  = String(codeId)
    return new Contract({ artifact, codeHash, chainId, codeId, uploadTx })
  }

}

