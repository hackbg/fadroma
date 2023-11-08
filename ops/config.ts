/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Console } from '@fadroma/connect'
import $, { JSONFile } from '@hackbg/file'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Path to this package. Used to find the build script, dockerfile, etc.
  * WARNING: Keep the ts-ignore otherwise it might break at publishing the package. */
export const packageRoot = dirname(dirname(fileURLToPath(
  //@ts-ignore
  import.meta.url
)))

/** Version of Fadroma in use. */
export const {
  name:    packageName,
  version: packageVersion,
} = $(packageRoot, 'package.json').as(JSONFile).load() as {
  name:    string,
  version: string
}

export const console = new Console(`${packageName} ${packageVersion}`)
