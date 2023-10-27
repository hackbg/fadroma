/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import {
  Config, Console, Error,
  ContractTemplate, UploadStore,
  base16, sha256
} from '@fadroma/connect'
import type { CodeId, ChainId, CodeHash, Environment } from '@fadroma/connect'
import $, { JSONDirectory, JSONFile, BinaryFile } from '@hackbg/file'
import type { Path } from '@hackbg/file'
import { fileURLToPath } from 'node:url'

/** Upload a single contract with default settings. */
export function upload (...args: Parameters<Agent["upload"]>) {
  return getAgent().upload(...args)
}

/** Upload multiple contracts with default settings. */
export function uploadMany (...args: Parameters<Agent["uploadMany"]>) {
  return getAgent().uploadMany(...args)
}

export { UploadStore }

export class FSUploadStore extends UploadStore {
  log = new UploadConsole('FSUploadStore')

  rootDir: JSONDirectory<unknown>

  constructor (
    rootDir: string
  ) {
    super()
    this.rootDir = $(rootDir).as(JSONDirectory)
  }

  get (codeHash: CodeHash|{ codeHash: CodeHash }): ContractTemplate|undefined {
    if (typeof codeHash === 'object') codeHash = codeHash.codeHash
    if (!codeHash) throw new UploadError.Missing.CodeHash()
    const receipt = this.rootDir.at(`${codeHash!.toLowerCase()}.json`).as(JSONFile<any>)
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
    const receipt = this.rootDir.at(`${codeHash.toLowerCase()}.json`).as(JSONFile<any>)
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

export class UploadConfig extends Config {
  constructor (
    options: Partial<UploadConfig> = {},
    environment?: Environment
  ) {
    super(environment)
    this.override(options)
  }
  /** Whether to always upload contracts, ignoring upload receipts that match. */
  reupload = this.getFlag(
    'FADROMA_REUPLOAD',
    () => false
  )
  /** Variant of uploader to use */
  uploader = this.getString(
    'FADROMA_UPLOADER',
    () => 'FS'
  )
  getUploadStore () {
    return new UploadStore()
  }
}

export class UploadError extends Error {}

class UploadConsole extends Console {

  receiptCodeId (receipt: Path, id?: CodeId) {
    return id
      ? this.log('found code id', id, 'at', receipt.shortPath)
      : this.warn(receipt.shortPath, 'contained no "codeId"')
  }

}
