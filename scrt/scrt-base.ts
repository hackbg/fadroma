/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Core } from '@fadroma/agent'
export class ScrtError extends Core.Error {}
export class ScrtConsole extends Core.Console { label = '@fadroma/scrt' }
export const console = new ScrtConsole()
export const {
  assign,
  base16,
  base64,
  bech32,
  bip32,
  bip39,
  bip39EN,
  bold,
  brailleDump,
  colors,
  into,
  randomBech32,
  randomBase64,
} = Core
