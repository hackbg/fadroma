/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Console, Error } from './base'
import type { Name } from './base'
import type { CodeHash } from './code'
import { UploadedCode } from './code'
import { Deployment } from './deploy'
import type { DeploymentState } from './deploy'

export class UploadStore extends Map<CodeHash, UploadedCode> {
  log = new Console('UploadStore')

  constructor () {
    super()
  }

  get (codeHash: CodeHash): UploadedCode|undefined {
    return super.get(codeHash)
  }

  set (codeHash: CodeHash, value: Partial<UploadedCode>): this {
    if (!(value instanceof UploadedCode)) {
      value = new UploadedCode(value)
    }
    if (value.codeHash && (value.codeHash !== codeHash)) {
      throw new Error('tried to store upload under different code hash')
    }
    return super.set(codeHash, value as UploadedCode)
  }
}

/** A deploy store collects receipts corresponding to individual instances of Deployment,
  * and can create Deployment objects with the data from the receipts. */
export class DeployStore extends Map<Name, DeploymentState> {
  log = new Console('DeployStore')

  constructor () {
    super()
  }

  selected?: DeploymentState = undefined

  get (name?: Name): DeploymentState|undefined {
    if (arguments.length === 0) {
      return this.selected
    }
    return super.get(name!)
  }

  set (name: Name, state: Partial<Deployment>|DeploymentState): this {
    if (state instanceof Deployment) state = state.toReceipt()
    return super.set(name, state)
  }
}
