/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import assert, { equal, rejects } from 'node:assert'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as Devnets from '@fadroma/devnets'
import { fixture } from '@fadroma/fixtures'
import Scrt, { Batch, SecretJS } from '@fadroma/scrt'
import { Token, Tester } from '@fadroma/agent'
//import * as Mocknet from './scrt-mocknet'

//@ts-ignore
export const packageRoot = dirname(resolve(fileURLToPath(import.meta.url)))

const joinWith = (sep: string, ...strings: string[]) => strings.join(sep)
let chain: any // for mocking
let agent: Scrt
const mnemonic = 'define abandon palace resource estate elevator relief stock order pool knock myth brush element immense task rapid habit angry tiny foil prosper water news'

import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['chain',    testScrtChain],
  ['snip-20',  () => import('./snip-20.test')],
  ['snip-24',  () => import('./snip-24.test')],
  ['snip-721', () => import('./snip-721.test')],
  //['mocknet',  () => import('./scrt-mocknet.test')],
])

import { mainnet, testnet, Connection } from '.'
export async function testScrtChain () {
  assert(mainnet() instanceof Connection)
  assert(testnet() instanceof Connection)
  const { backend, alice, bob, guest } = await Tester.testChainSupport(
    Scrt,
    Devnets.ScrtContainer,
    'v1.9',
    'uscrt',
    fixture('scrt-null.wasm')
  )
  //const batch = () => alice.batch()
    //.instantiate('id', {
      //label:    'label',
      //initMsg:  {},
      //codeHash: 'hash',
    //} as any)
    //.execute('addr', {
      //address:  'addr',
      //codeHash: 'hash',
      //message:  {}
    //} as any, {})
  //assert(batch() instanceof Batch, 'ScrtBatch is returned')
  //assert.ok(await batch().save('test'))
  //assert.ok(await batch().submit({ memo: 'test' }))
}
