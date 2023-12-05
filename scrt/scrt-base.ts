/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Console, Error, bold } from '@fadroma/agent'
import type { Address, ChainId, Token } from '@fadroma/agent'

class ScrtError extends Error {}
class ScrtConsole extends Console { label = '@fadroma/scrt' }
const console = new ScrtConsole()

export {
  ScrtError   as Error,
  ScrtConsole as Console,
  console
}
