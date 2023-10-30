/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import assert from 'node:assert'
import { fixture } from '../fixtures/fixtures'

import { Chain, assertChain } from './chain'
import type { Agent } from './agent'
import { StubChain, StubAgent } from './stub'

import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['chain',  testChain],
  ['agent',  testAgent],
  ['devnet', testDevnet],
])

export async function testChain () {
  assert.throws(()=>Chain.mocknet())

  let chain = new StubChain()
  assert.throws(()=>chain.id)
  assert.throws(()=>chain.id='foo')
  assert.throws(()=>chain.mode)
  assert.throws(()=>new StubChain({ mode: StubChain.Mode.Devnet, id: 'stub', url: 'stub' }).ready)
  assert.equal(chain.chain, chain)
  assert.equal(assertChain({ chain }), chain)
  chain = new StubChain({ mode: StubChain.Mode.Testnet, id: 'stub', url: 'stub' })
  assert((await chain.ready).api)
  await chain.height
  await chain.nextBlock
  await chain.getBalance('','')
  await chain.query('', {})
  await chain.getCodeId('')
  await chain.getHash('')
  await chain.getHash(0)
  await chain.getLabel('')
  Object.defineProperty(chain, 'height', {
    get () { return Promise.resolve('NaN') }
  })
  assert.equal(await chain.nextBlock, NaN)
  assert(StubChain.mainnet().isMainnet)
  assert(!(StubChain.mainnet().devMode))
  assert(StubChain.testnet().isTestnet)
  assert(!(StubChain.testnet().devMode))
  assert(StubChain.devnet().isDevnet)
  assert(StubChain.devnet().devMode)
  assert(new StubChain({ mode: Chain.Mode.Mocknet }).isMocknet)
  assert(new StubChain({ mode: Chain.Mode.Mocknet }).devMode)
}

export async function testAgent () {
  const chain = new StubChain({ id: 'stub' })
  let agent: Agent = await chain.getAgent({ name: 'testing1', address: '...' })
  assert.equal(agent[Symbol.toStringTag], '... @ stub')
  assert(agent instanceof StubAgent,    'an Agent was returned')
  assert(agent.address,                 'agent has address')
  assert.equal(agent.name, 'testing1',  'agent.name assigned')
  assert.equal(agent.chain, chain,      'agent.chain assigned')
  const ready = agent.ready
  assert(await ready)
  assert(agent.ready === ready)
  agent.defaultDenom
  agent.balance
  agent.height
  agent.nextBlock
  await agent.getBalance('a','b')
  await agent.query('', {})
  await agent.getCodeId('')
  await agent.getHash('')
  await agent.getHash(0)
  await agent.getLabel('')
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
  const chain = new StubChain({
    mode: Chain.Mode.Mainnet,
    devnet,
    id: 'bar',
    url: 'http://asdf.com',
  })
  const ready = chain.ready
  assert(await ready)
  assert(chain.ready === ready)
  // Properties from Devnet are passed onto Chain
  assert.equal(chain.devnet, devnet)
  assert.equal(chain.id, 'foo')
  assert.equal(chain.url, 'http://example.com/')
  assert.equal(chain.mode, StubChain.Mode.Devnet)
  assert.equal(chain.stopped, true)
  devnet.running = true
  assert.equal(chain.stopped, false)
  assert.throws(()=>chain.id='asdf')
  assert.throws(()=>chain.url='asdf')
  assert.throws(()=>{
    //@ts-ignore
    chain.mode='asdf'
  })
  assert.throws(()=>chain.devnet=devnet)
  assert.throws(()=>chain.stopped=true)
}
