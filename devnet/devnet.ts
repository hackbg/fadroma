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

/** Delete multiple devnets. */
export async function deleteDevnets (
  path: string|Path, ids?: ChainId[]
): Promise<void> {
  const state = $(path).as(Directory)
  const chains = (state.exists()&&state.list()||[])
    .map(name => $(state, name))
    .filter(path => path.isDirectory())
    .map(path => path.at(Container.stateFile).as(JSONFile))
    .filter(path => path.isFile())
    .map(path => $(path, '..'))
  await Promise.all(
    chains.map(dir=>Container.fromFile(dir, true).delete())
  )
}

export type Platform =
  | `scrt_1.${2|3|4|5|6|7|8|9}`
  | `okp4_5.0`
