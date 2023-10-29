/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import {
  Error, Console,
  StubChain,
  Agent, StubAgent,
  StubBatch,
  ContractCode, ContractClient,
  UploadStore, DeployStore,
  SourceCode, CompiledCode, UploadedCode,
  ContractInstance, Deployment, DeploymentContractLabel,
  assertChain,
  Builder, StubBuilder,
  Token, TokenFungible, TokenNonFungible, Swap,
  addZeros, Coin, Fee,
  into, intoArray, intoRecord,
} from './agent'
import assert from 'node:assert'
import { fixture } from '../fixtures/fixtures'
import { Suite } from '@hackbg/ensuite'

import * as Batches from './batch.test'
import * as Chains  from './chain.test'
import * as Clients from './client.test'
import * as Base    from './base.test'
import * as Deploys from './deploy.test'
import * as Codes   from './code.test'
import * as Tokens  from './token.test'

export default new Suite([
  ['agent',        testAgent],
  ['batch',        Batches.testBatch],
  ['chain',        Chains.testChain],
  ['client',       Clients.testClient],
  ['collections',  Base.testCollections],
  ['console',      Base.testConsole],
  ['errors',       Base.testErrors],
  ['contract',     Codes.testContracts],
  ['decimals',     Tokens.testDecimals],
  ['deploy',       Deploys.testDeployment],
  ['devnet',       Chains.testDevnet],
  ['labels',       Base.testLabels],
  ['token',        Tokens.testToken],
])


export async function testAgent () {
  const chain = new StubChain({ id: 'stub' })
  let agent: Agent = await chain.getAgent({ name: 'testing1', address: '...' })
  assert(agent instanceof StubAgent,    'an Agent was returned')
  assert(agent.address,             'agent has address')
  assert.equal(agent.name, 'testing1', 'agent.name assigned')
  assert.equal(agent.chain, chain,     'agent.chain assigned')
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
