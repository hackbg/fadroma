/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import $, { JSONFile, JSONDirectory, Directory } from '@hackbg/file'
import type { Path } from '@hackbg/file'
import type { CodeId, ChainId, Address, Uint128, CompiledCode } from '@fadroma/agent'
import Container from './devnet-base'
export { default as Container } from './devnet-base'
export { default as ScrtContainer } from './devnet-scrt'
export { default as OKP4Container } from './devnet-okp4'

/** Identifiers of supported platforms. */
export type Platform =
  | `scrt_1.${2|3|4|5|6|7|8|9}`
  | `okp4_5.0`

/** Identifiers of supported API endpoints.
  * These are different APIs exposed by a node at different ports. 
  * One of these is used by default - can be a different one
  * depending on platform version. */
export type APIMode =
  |'http'
  |'rpc'
  |'grpc'
  |'grpcWeb'
