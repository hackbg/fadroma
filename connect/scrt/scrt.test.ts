/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import assert from 'node:assert'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as SecretJS from '@hackbg/secretjs-esm'
import { Devnet } from '../../ops/devnets'
import * as Scrt from '@fadroma/scrt'
import { Agent, ChainId, Address, randomBech32 } from '@fadroma/agent'
//import * as Mocknet from './scrt-mocknet'

//@ts-ignore
export const packageRoot = dirname(resolve(fileURLToPath(import.meta.url)))

const joinWith = (sep: string, ...strings: string[]) => strings.join(sep)
let chain: any // for mocking
let agent: Agent
const mnemonic = 'define abandon palace resource estate elevator relief stock order pool knock myth brush element immense task rapid habit angry tiny foil prosper water news'

import { Suite } from '@hackbg/ensuite'
import { testScrtChain, testScrtDevnet } from './scrt-chain.test'
export default new Suite([
  ['chain',    testScrtChain],
  //['devnet',   testScrtDevnet],
  //['mocknet',  () => import('./scrt-mocknet.test')],
  ['snip-20',  () => import('./snip-20.test')],
  ['snip-24',  () => import('./snip-24.test')],
  ['snip-721', () => import('./snip-721.test')],
])
