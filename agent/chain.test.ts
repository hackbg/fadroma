/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import assert from 'node:assert'
import { fixture } from '../fixtures/fixtures'

import { Agent, BatchBuilder, Mode } from './chain'
import { ContractClient } from './client'
import * as Stub from './stub'

import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['modes',           testModes],
  ['unauthenticated', testUnauthenticated],
  ['authenticated',   testAuthenticated],
])

export async function testModes () {
  assert(Stub.Agent.mainnet().isMainnet)
  assert(!(Stub.Agent.mainnet().devMode))
  assert(Stub.Agent.testnet().isTestnet)
  assert(!(Stub.Agent.testnet().devMode))
  assert(Stub.Agent.devnet().isDevnet)
  assert(Stub.Agent.devnet().devMode)
  assert(new Stub.Agent({ mode: Mode.Mocknet }).isMocknet)
  assert(new Stub.Agent({ mode: Mode.Mocknet }).devMode)
}

export async function testUnauthenticated () {
  let chain: Agent
  assert.throws(()=>Stub.Agent.mocknet())
  assert(chain = new Stub.Agent())
  assert(chain = new Stub.Agent({ mode: Mode.Testnet, chainId: 'stub', url: 'stub' }))

  assert(await chain.height)
  assert(await chain.nextBlock)
  Object.defineProperty(chain, 'height', { configurable: true, get () {
    return Promise.resolve('NaN')
  } })
  assert.equal(await chain.nextBlock, NaN)
  Object.defineProperty(chain, 'height', { configurable: true, get () {
    Object.defineProperty(chain, 'height', { configurable: true, get () {
      throw new Error('yeet')
    } })
    return Promise.resolve(0)
  } })
  assert.rejects(()=>chain.nextBlock)

  assert(await chain.query('', {}))

  assert(chain.contract() instanceof ContractClient)

  const state = new Stub.ChainState()
  state.uploads.set("123", { codeHash: "abc", codeData: new Uint8Array() } as any)
  state.instances.set("stub1abc", { codeId: "123" })
  chain = new Stub.Agent({ state })
  assert.equal(await chain.getCodeId('stub1abc'), "123")
  assert.equal(await chain.getCodeHashOfAddress('stub1abc'), "abc")
  assert.equal(await chain.getCodeHashOfCodeId('123'), "abc")
}

export async function testAuthenticated () {
  const agent = new Stub.Agent({ chainId: 'stub' }).connect({ name: 'testing1', address: '...' })
  //assert.equal(agent[Symbol.toStringTag], 'stub (mocknet): testing1')
  assert(agent instanceof Stub.Agent,  'an Agent was returned')
  assert(agent.address,                'agent has address')
  assert.equal(agent.name, 'testing1', 'agent.name assigned')
  agent.defaultDenom
  agent.height
  agent.nextBlock
  await agent.query('', {})
  await agent.send('', [])
  await agent.sendMany([])
  await agent.upload(fixture('null.wasm'), {})
  await agent.upload(new Uint8Array(), {})
  await agent.instantiate('1', { label: 'foo', initMsg: 'bar' })
  await agent.instantiate({ codeId: '1' }, { label: 'foo', initMsg: {} })
  assert.rejects(()=>agent.instantiate('foo', {}))
  assert.rejects(()=>agent.instantiate('', {}))
  assert.rejects(()=>agent.instantiate('1', { label: 'foo' }))
  assert.rejects(()=>agent.instantiate('1', { initMsg: {} }))
  await agent.execute('stub', {}, {})
  await agent.execute({ address: 'stub' }, {}, {})
  const batch = agent.batch()
    .upload({})
    .upload({})
    .instantiate({}, {})
    .instantiate({}, {})
    .execute({}, {})
    .execute({}, {})

  assert(batch instanceof BatchBuilder)
  await batch.submit()
}
