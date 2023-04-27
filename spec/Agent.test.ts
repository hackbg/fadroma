import { Chain, Agent, Bundle } from '@fadroma/agent'
import assert from 'node:assert'

let chain: Chain = Chain.mocknet()
let agent: Agent = await chain.getAgent({ address: 'testing1agent0' })
let bundle: Bundle

class TestBundle extends Bundle {
  async submit () { return 'submitted' }
  async save   () { return 'saved' }
}

assert.equal(await new TestBundle(agent, async bundle=>{
  assert(bundle instanceof TestBundle)
}).run(), 'submitted')

assert.equal(await new TestBundle(agent, async bundle=>{
  assert(bundle instanceof TestBundle)
}).save(), 'saved')

bundle = new TestBundle(agent)
assert.deepEqual(bundle.msgs, [])
assert.equal(bundle.id, 0)
assert.throws(()=>bundle.assertMessages())

bundle.add({})
assert.deepEqual(bundle.msgs, [{}])
assert.equal(bundle.id, 1)
assert.ok(bundle.assertMessages())

bundle = new TestBundle(agent)
assert.equal(await bundle.run(""),       "submitted")
assert.equal(await bundle.run("", true), "saved")
assert.equal(bundle.depth, 0)

bundle = bundle.bundle()
assert.equal(bundle.depth, 1)
assert.equal(await bundle.run(), null)

agent = new class TestAgent extends Agent { Bundle = class TestBundle extends Bundle {} }
bundle = agent.bundle()
assert(bundle instanceof Bundle)

agent = new class TestAgent extends Agent { Bundle = class TestBundle extends Bundle {} }
//await agent.instantiateMany(new Contract(), [])
//await agent.instantiateMany(new Contract(), [], 'prefix')
