/**
  Fadroma Connect. Copyright (C) 2023 Hack.bg. Licensed under GNU AGPLv3 or exception.
  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/
import connect, { ConnectConfig, ConnectError, ConnectConsole } from './connect'
import * as assert from 'node:assert'

import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['config',  testConnectConfig],
  ['errors',  testConnectErrors],
  ['console', testConnectConsole],
  ['scrt',    () => import('./scrt/scrt.test')],
  ['cw',      () => import('./cw/cw.test')]
])

export async function testConnectConfig () {
  const config = new ConnectConfig()
  config.getChain()
  config.getChain(null as any)
  assert.throws(()=>config.getChain('NoSuchChain' as any))
  config.getAgent()
  config.listChains()
}

export async function testConnectErrors () {
  new ConnectError.NoChainSelected()
  new ConnectError.UnknownChainSelected('', {})
}

export async function testConnectConsole () {
  new ConnectConsole('testing console').selectedChain()
}
