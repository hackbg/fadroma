/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import * as Devnets from '@fadroma/devnet'
import * as Scrt from './scrt'
import { fixture, testConnectionWithBackend } from '@fadroma/fixtures'
import { mainnet, testnet, ScrtConnection, ScrtMnemonicIdentity, ScrtBatch, SecretJS } from '@fadroma/scrt'
import { Token } from '@fadroma/agent'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { webcrypto } from 'node:crypto'
import { ok, equal, rejects } from 'node:assert'

//@ts-ignore
globalThis.crypto ??= webcrypto
//import * as Mocknet from './scrt-mocknet'

//@ts-ignore
export const packageRoot = dirname(resolve(fileURLToPath(import.meta.url)))

const joinWith = (sep: string, ...strings: string[]) => strings.join(sep)
let chain: any // for mocking
let agent: Scrt.ScrtConnection
const mnemonic = 'define abandon palace resource estate elevator relief stock order pool knock myth brush element immense task rapid habit angry tiny foil prosper water news'

import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['chain',    testScrtChain],
  ['snip-20',  () => import('./snip-20.test')],
  ['snip-24',  () => import('./snip-24.test')],
  ['snip-721', () => import('./snip-721.test')],
  //['mocknet',  () => import('./scrt-mocknet.test')],
])

export async function testScrtChain () {
  ok(mainnet() instanceof ScrtConnection)
  ok(testnet() instanceof ScrtConnection)
  const { backend, alice, bob, guest } = await testConnectionWithBackend({
    Connection:      ScrtConnection,
    Identity:        ScrtMnemonicIdentity,
    Backend:         Devnets.DevnetContainer,
    platformName:    'scrt',
    platformVersion: '1.12',
    gasToken:        'uscrt',
    code:            fixture('scrt-null.wasm')
  })
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
