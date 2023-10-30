/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import assert from 'node:assert'
import type { Agent } from './agent'
import { Batch } from './agent'
import * as Stub from './stub'
import { ContractClient } from './client'

export default async function testBatch () {

  let agent: Agent = await new Stub.Agent({ chainId: 'stub' })
    .authenticate({ name: 'test-batch', address: 'stub1testbatch' })

  assert(agent.batch() instanceof Batch)
  const batchedOperations = async (batch: Batch) => {
    assert(batch instanceof Batch)
    assert.rejects(()=>batch.query({} as any, {}))
    assert.rejects(()=>batch.upload({}))
    assert.rejects(()=>batch.sendMany([]))
    assert.rejects(()=>batch.send('', []))
    assert.rejects(()=>batch.getBalance(''))
    assert.throws(()=>batch.height)
    assert.throws(()=>batch.nextBlock)
    assert.throws(()=>batch.balance)
    assert.rejects(()=>batch.doUpload(undefined as any))
    await batch.instantiate('1', {} as any)
    await batch.instantiate({} as any, {} as any)
    await batch.execute('addr', {}, {})
    await batch.execute({ address: 'addr' }, {}, {})
  }
  const batch1 = new Stub.Batch(agent, batchedOperations)
  assert.equal(await batch1.ready, batch1)
  assert.equal(batch1.agent, agent)
  assert.equal(batch1.name,  `test-batch (batched)`)
  assert.equal(batch1.fees,  agent.fees)
  assert.equal(batch1.defaultDenom, agent.defaultDenom)
  assert(batch1.getClient() instanceof ContractClient)

  const batch2 = new Stub.Batch(agent)
  assert.deepEqual(batch2.msgs, [])
  assert.equal(batch2.id, 0)
  assert.throws(()=>batch2.assertMessages())
  assert.equal(batch2.add({}), 0)
  assert.deepEqual(batch2.msgs, [{}])
  assert.equal(batch2.id, 1)
  assert(batch2.assertMessages())

  const batch3 = new Stub.Batch(agent, batchedOperations)
  assert(await batch3.run())
  assert(await batch3.run({ memo: "", save: true }))
  assert.equal(batch3.depth, 0)

  const batch3a = batch3.batch()
  assert.equal(batch3a.depth, 1)
  assert.equal(await batch3a.run(), null)

}
