/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program. If not, see <http://www.gnu.org/licenses/>. **/
import { CompiledCode } from './Compile.ts'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

/** An object representing a given compiled binary that may be on the local filesystem. */
export class LocalCompiledCode extends CompiledCode {
  protected override async fetchImpl () {
    if (typeof this.codePath === 'string') {
      return await readFile(this.codePath)
    } else if (this.codePath instanceof URL) {
      if (this.codePath.protocol === 'file:') {
        return await readFile(fileURLToPath(this.codePath))
      } else {
        return super.fetchImpl()
      }
    } else {
      throw new Error("can't fetch: invalid codePath")
    }
  }
}

