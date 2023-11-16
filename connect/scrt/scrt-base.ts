/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Config } from '@hackbg/conf'
import type { Environment } from '@hackbg/conf'
import { Console, Error, bold } from '@fadroma/agent'
import type { Address, ChainId, Token } from '@fadroma/agent'

class ScrtError extends Error {}

class ScrtConsole extends Console {
  label = '@fadroma/scrt'
}

export {
  ScrtError   as Error,
  ScrtConsole as Console,
}
