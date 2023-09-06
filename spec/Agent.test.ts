import { Chain, Agent, Bundle } from '@fadroma/agent'
import assert from 'node:assert'

import './Agent.spec.ts.md'

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

// Make sure each error subclass can be created with no arguments:
import { Error } from '@fadroma/agent'
for (const key of Object.keys(Error)) {
  const subtype = Error[key as keyof typeof Error] as any
  if (typeof subtype ==='function') assert(new subtype() instanceof Error, `error ${key}`)
}

// Make sure each log message can be created with no arguments:
import { Console } from '@fadroma/agent'
const log = new Console()
for (const key of Object.keys(log)) {
  const method = log[key as keyof typeof log] as any
  if (typeof method==='function') try { method.bind(log)() } catch (e) { console.warn(e) }
}

/***
## Introductory example

FIXME: add to spec (fix imports)

```typescript
import { Scrt } from '@hackbg/fadroma'
import { ExampleContract } from '@example/project'

export default async function main () {
  const chain    = new Scrt()
  const agent    = await chain.getAgent().ready
  const address  = "secret1..."
  const contract = new Client({ agent, address: "secret1..." })
  const response = await contract.myQuery()
  const result   = await contract.myTransaction()
  return result
}
```
*///
