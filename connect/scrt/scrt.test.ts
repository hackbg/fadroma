/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import assert, { equal, rejects } from 'node:assert'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as Devnets from '../../ops/devnets'
import { fixture } from '../../fixtures/fixtures'
import Scrt, { SecretJS } from '@fadroma/scrt'
import { Token } from '@fadroma/agent'
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
  ['devnet',   testScrtDevnet],
  //['mocknet',  () => import('./scrt-mocknet.test')],
  ['snip-20',  () => import('./snip-20.test')],
  ['snip-24',  () => import('./snip-24.test')],
  ['snip-721', () => import('./snip-721.test')],
])

export async function testScrtChain () {
  assert(Scrt.mainnet() instanceof Scrt)
  assert(Scrt.testnet() instanceof Scrt)
  const chain = new Scrt({ chainId: 'scrt' })
  assert(chain.api instanceof SecretJS.SecretNetworkClient)
  const agent = await chain.authenticate({})
  assert(agent.api instanceof SecretJS.SecretNetworkClient)
}

export async function testScrtDevnet () {
  const sendFee   = new Token.Fee( "1000000", "uscrt")
  const uploadFee = new Token.Fee("10000000", "uscrt")
  const initFee   = new Token.Fee("10000000", "uscrt")
  // Just a devnet with a couple of genesis users.
  const devnet = new Devnets.Container({
    platform: 'scrt_1.9',
    genesisAccounts: { Alice: "123456789000", Bob: "987654321000", }
  })
  // Get a couple of accounts from the devnet.
  // This creates and launches the devnet in
  // order to be able to access the wallets.
  const [alice, bob] = await Promise.all([
    devnet.authenticate('Alice'),
    devnet.authenticate('Bob'),
  ])
  // Query block height
  console.log('Height:', await alice.height)
  // Query balance in default native token
  equal(await alice.balance, '123455739000')
  equal(await bob.balance,   '987654321000')
  //// Permissionsless: anyone can authenticate with their public key
  const guest = await new Scrt({ devnet }).authenticate({ mnemonic })
  //// Starting out with zero balance
  equal(await guest.balance, '0')
  //// Which may be topped up by existing users
  await alice.send(guest, [new Token.Coin("1", "uscrt")], { sendFee })
  //equal(await guest.balance, '1')
  await bob.send(guest, [new Token.Coin("10", "uscrt")], { sendFee })
  equal(await guest.balance, '11')
  //// User with balance may upload contract code
  //const uploaded = await alice.upload(fixture('fadroma-example-echo@HEAD.wasm'))
  //// Which is immediately queryable by other users
  //equal(await bob.getCodeHashOfCodeId(uploaded.codeId), uploaded.codeHash)
  ////// Who can create instances of the uploaded contract code
  //const label = 'my-contract-label'
  //const initMsg = null as any // actually a valid init message
  //const instance = await bob.instantiate(uploaded, { label, initMsg, initFee })
  ////// Which are immediately visible to all
  //equal(await guest.getCodeHashOfAddress(instance.address), uploaded.codeHash)
  ////// And can execute transactions for users
  //const txResult = await alice.execute(instance, null as any)
  //console.info('txResult:', txResult)
  // FIXME: Execute query (oops, empty string is not valid json)
  //const qResponse = await alice.query(instance, null as any) 
  //console.log({qResponse})

  //@ts-ignore
  //const signed = await guest.signer!.signAmino("", { test: 1 })

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
  //assert(batch() instanceof Scrt.BatchBuilder, 'ScrtBatch is returned')
  //assert(await batch().save('test'))
  //assert(await batch().submit('test'))
}
