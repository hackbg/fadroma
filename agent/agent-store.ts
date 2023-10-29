/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Console, Error } from './agent-base'
import type { Class, Name } from './agent-base'
import type { CodeHash } from './agent-code'
import type { ChainId } from './agent-chain'
import { SourceCode, CompiledCode, UploadedCode } from './agent-code'
import { Deployment } from './agent-deploy'
import type { DeploymentClass, DeploymentState } from './agent-deploy'

export class UploadStore extends Map<CodeHash, UploadedCode> {
  log = new Console('UploadStore')

  constructor () {
    super()
  }

  get (codeHash: CodeHash): UploadedCode|undefined {
    return super.get(codeHash)
  }

  set (codeHash: CodeHash, value: Partial<UploadedCode>): this {
    if (!(value instanceof UploadedCode)) value = new UploadedCode(value)
    if (value.codeHash && (value.codeHash !== codeHash)) throw new Error.Invalid('code hash mismatch')
    return super.set(codeHash, value as UploadedCode)
  }
}

/** A deploy store collects receipts corresponding to individual instances of Deployment,
  * and can create Deployment objects with the data from the receipts. */
export class DeployStore extends Map<Name, Deployment> {
  log = new Console('DeployStore')

  constructor () {
    super()
  }

  get (name: Name): Deployment|undefined {
    return super.get(name)
  }

  set (name: Name, deployment: Partial<Deployment>): this {
    if (!(deployment instanceof Deployment)) deployment = new Deployment(deployment)
    return super.set(name, deployment as Deployment)
  }
}
