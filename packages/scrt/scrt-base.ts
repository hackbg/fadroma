/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Core } from '@fadroma/agent'
export class ScrtError extends Core.Error {}
export class ScrtConsole extends Core.Console { label = '@fadroma/scrt' }
export const console = new ScrtConsole()
export const {
  Bip32,
  Bip39,
  Bip39EN,
  Ed25519,
  SHA256,
  Secp256k1,
  assign,
  base16,
  base64,
  bech32,
  bold,
  brailleDump,
  colors,
  into,
  randomBase64,
  randomBech32,
} = Core
