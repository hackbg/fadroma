/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import assert from 'node:assert'
import { fixture } from '../fixtures/fixtures'

import { Agent, Mode } from './chain'
import * as Stub from './stub'

import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['chain',  testChain],
  ['agent',  testAgent],
  ['devnet', testDevnet],
])

export async function testChain () {
  let chain = new Stub.Agent()
  assert.throws(()=>chain.chainId)
  assert.throws(()=>chain.chainId='foo')
  assert.throws(()=>chain.mode)
  chain = new Stub.Agent({ mode: Mode.Testnet, chainId: 'stub', url: 'stub' })
  await chain.height
  await chain.nextBlock
  await chain.query('', {})
  Object.defineProperty(chain, 'height', {
    get () { return Promise.resolve('NaN') }
  })
  assert.equal(await chain.nextBlock, NaN)
  assert(Stub.Agent.mainnet().isMainnet)
  assert(!(Stub.Agent.mainnet().devMode))
  assert(Stub.Agent.testnet().isTestnet)
  assert(!(Stub.Agent.testnet().devMode))
  assert(Stub.Agent.devnet().isDevnet)
  assert(Stub.Agent.devnet().devMode)
  assert(new Stub.Agent({ mode: Mode.Mocknet }).isMocknet)
  assert(new Stub.Agent({ mode: Mode.Mocknet }).devMode)
}

export async function testAgent () {
  const chain = new Stub.Agent({ chainId: 'stub' })
  let agent: Agent = await chain.authenticate({ name: 'testing1', address: '...' })
  assert.equal(agent[Symbol.toStringTag], '... @ stub')
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
}

export async function testDevnet () {
  const devnet = {
    accounts: [],
    chainId: 'foo',
    platform: 'bar',
    running: false,
    stateDir: '/tmp/foo',
    url: new URL('http://example.com'),
    async start () { return this },
    async getAccount () { return {} },
    async assertPresence () {}
  }
  const chain = new Stub.Agent({
    mode: Mode.Mainnet,
    chainId: 'bar',
    url: 'http://asdf.com',
    devnet,
  })
  // Properties from Devnet are passed onto Chain
  assert.equal(chain.devnet, devnet)
  assert.equal(chain.chainId, 'foo')
  assert.equal(chain.url, 'http://example.com/')
  assert.equal(chain.mode, Mode.Devnet)
  assert.equal(chain.stopped, true)
  devnet.running = true
  assert.equal(chain.stopped, false)
  assert.throws(()=>chain.chainId='asdf')
  assert.throws(()=>chain.url='asdf')
  assert.throws(()=>{
    //@ts-ignore
    chain.mode='asdf'
  })
  assert.throws(()=>chain.devnet=devnet)
  assert.throws(()=>chain.stopped=true)
}
