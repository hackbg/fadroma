/**
  Fadroma Connect. Copyright (C) 2023 Hack.bg. Licensed under GNU AGPLv3 or exception.
  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/
import assert from 'node:assert'

import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['config', () => testConnectConfig],
  ['scrt',   () => import('./scrt/scrt.test')],
  ['cw',     () => import('./cw/cw.test')]
])

export async function testConnectConfig () {
  const { ConnectConfig } = await import('./connect')
  const config = new ConnectConfig()
  config.listChains()
}
