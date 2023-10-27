/**
  Fadroma: copyright (C) 2023 Hack.bg, licensed under GNU AGPLv3 or exception.
  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/
import {
  Console, ContractTemplate, Error, UploadStore,
  base16, sha256
} from '@fadroma/connect'
import type { CodeId, ChainId, CodeHash } from '@fadroma/connect'
import $, { JSONDirectory, JSONFile, BinaryFile } from '@hackbg/file'
import type { Path } from '@hackbg/file'
import { fileURLToPath } from 'node:url'

export { UploadStore }

export class FSUploadStore extends UploadStore {
  log = new UploadConsole('FSUploadStore')

  constructor (
    readonly chainId: ChainId,
    readonly rootDir: JSONDirectory<any>
  ) {
    super()
  }

  get (codeHash: CodeHash|{ codeHash: CodeHash }): ContractTemplate|undefined {
    if (typeof codeHash === 'object') codeHash = codeHash.codeHash
    if (!codeHash) throw new UploadError.Missing.CodeHash()
    const receipt = this.rootDir.in('state').in(this.chainId)
      .in('upload').at(`${codeHash!.toLowerCase()}.json`)
      .as(JSONFile<any>)
    if (receipt.exists()) {
      const uploaded = receipt.load()
      this.log.receiptCodeId(receipt, uploaded.codeId)
      if (uploaded.codeId) {
        super.set(codeHash, uploaded)
      }
    }
    return super.get(codeHash)
  }

  set (codeHash: CodeHash|{ codeHash: CodeHash }, value: Partial<ContractTemplate>): this {
    if (typeof codeHash === 'object') codeHash = codeHash.codeHash
    if (!codeHash) throw new UploadError.Missing.CodeHash()
    super.set(codeHash, value)
    const receipt = this.rootDir.in('state').in(this.chainId)
      .in('upload').at(`${codeHash.toLowerCase()}.json`)
      .as(JSONFile<any>)
    this.log('writing', receipt.shortPath)
    receipt.save(super.get(codeHash)!.toUploadReceipt())
    return this
  }

  protected addCodeHash (uploadable: Partial<ContractTemplate> & { name: string }) {
    if (!uploadable.codeHash) {
      if (uploadable.codePath) {
        uploadable.codeHash = base16.encode(sha256(this.fetchSync(uploadable.codePath)))
        this.log(`hashed ${String(uploadable.codePath)}:`, uploadable.codeHash)
      } else {
        this.log(`no artifact, can't compute code hash for: ${uploadable?.name||'(unnamed)'}`)
      }
    }
  }

  protected async fetch (path: string|URL): Promise<Uint8Array> {
    return await Promise.resolve(this.fetchSync(path))
  }

  protected fetchSync (path: string|URL): Uint8Array {
    return $(fileURLToPath(new URL(path, 'file:'))).as(BinaryFile).load()
  }
}

/** Class that convert itself to a `Template`,
  * from which `Contract`s can subsequently be instantiated. */
export class UploadReceipt_v1 extends JSONFile<UploadReceiptData> {
  /** Create a Template object with the data from the receipt. */
  toTemplate (defaultChainId?: string) {
    let { chainId, codeId, codeHash, uploadTx, codePath } = this.load()
    chainId ??= defaultChainId
    codeId  = String(codeId)
    return new ContractTemplate({ codePath, codeHash, chainId, codeId, uploadTx })
  }
}

export interface UploadReceiptData {
  chainId?:           string
  codeHash:           string
  codeId:             number|string
  codePath?:          any
  compressedChecksum: string
  compressedSize:     string
  logs:               any[]
  originalChecksum:   string
  originalSize:       number
  transactionHash:    string
  uploadTx?:          string
}

export class UploadError extends Error {}

class UploadConsole extends Console {

  receiptCodeId (receipt: Path, id?: CodeId) {
    return id
      ? this.log('found code id', id, 'at', receipt.shortPath)
      : this.warn(receipt.shortPath, 'contained no "codeId"')
  }

}
