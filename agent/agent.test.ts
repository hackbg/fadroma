/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['base',   ()=>import('./base.test')],
  ['chain',  ()=>import('./chain.test')],
  ['client', ()=>import('./client.test')],
  ['code',   ()=>import('./code.test')],
  ['deploy', ()=>import('./deploy.test')],
  ['devnet', ()=>import('./devnet.test')],
  ['store',  ()=>import('./store.test')],
  ['token',  ()=>import('./token.test')]
])

import type { Agent, Devnet } from '.'
import { Fee } from './token'
export function testChainSupport <
  A extends typeof Agent, D extends Devnet<A>
> (
  Agent:  A,
  devnet: D,
  token:  string
) {
  const sendFee   = new Fee( "1000000", "uknow")
  const uploadFee = new Fee("10000000", "uknow")
  const initFee   = new Fee("10000000", "uknow")
}
