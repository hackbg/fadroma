import { Contract } from '@fadroma/agent'
import type { CodeId, CodeHash, ChainId, Uploadable, Uploaded } from '@fadroma/agent'

import $, { JSONFile, JSONDirectory } from '@hackbg/file'
import { colors, bold } from '@hackbg/logs'

/** Directory collecting upload receipts.
  * Upload receipts are JSON files of the format `$CRATE@$REF.wasm.json`
  * and are kept so that we don't reupload the same contracts. */
export default class UploadStore extends JSONDirectory<UploadReceipt> {

  tryGet (contract: Uploadable, _chainId?: ChainId): Uploaded|undefined {
    const name = this.getUploadReceiptName(contract)
    const receiptFile = this.at(name)
    if (receiptFile.exists()) {
      const receipt = receiptFile.as(UploadReceipt)
      this.log.log(`${colors.green('Found:')}   `, bold(colors.green(receiptFile.shortPath)))
      const {
        chainId = _chainId,
        codeId,
        codeHash,
        uploadTx,
      } = receipt.toContract()
      const props = { chainId, codeId, codeHash, uploadTx }
      return Object.assign(contract, props) as Uploaded & {
        artifact: URL,
        codeHash: CodeHash,
        codeId:   CodeId
      }
    }
  }

  /** Generate the filename for an upload receipt. */
  getUploadReceiptName ({ artifact }: Uploadable): string {
    return `${$(artifact!).name}.json`
  }

  /** Generate the full path for an upload receipt. */
  getUploadReceiptPath (contract: Uploadable): string {
    const receiptName = `${this.getUploadReceiptName(contract)}`
    const receiptPath = this.resolve(receiptName)
    return receiptPath
  }
}

/** Class that convert itself to a Contract, from which contracts can be instantiated. */
export class UploadReceipt extends JSONFile<UploadReceiptData> {

  /** Create a Contract object with the data from the receipt. */
  toContract (defaultChainId?: string) {
    let { chainId, codeId, codeHash, uploadTx, artifact } = this.load()
    chainId ??= defaultChainId
    codeId  = String(codeId)
    return new Contract({ artifact, codeHash, chainId, codeId, uploadTx })
  }

}

export interface UploadReceiptData {
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
}
