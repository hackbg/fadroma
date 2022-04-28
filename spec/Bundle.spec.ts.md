# Transaction bundling

```typescript
const Spec = {}
const test = tests => Object.assign(Spec, tests)
export default Spec
```

The Cosmos API allows for multiple messages to be sent as
part of the same transaction. However, `secretjs<=0.17.5`
did not expose this functionality, and every single thing
took 5 seconds. Hence, our TX bundling implementation.

## Base bundle

```typescript
import { Bundle } from '../index'
test({
  async "tx bundles" () {
    class TestAgent extends Agent {
      Bundle = class TestBundle extends Bundle {}
    }
    const agent = new TestAgent()
    const bundle = agent.bundle()
    ok(bundle instanceof Bundle)
  },

  async "agent uses bundle to instantiate many contracts in 1 tx" () {
    class TestAgent extends Agent {
      Bundle = class TestBundle extends Bundle {}
    }
    await new TestAgent().instantiateMany([])
    await new TestAgent().instantiateMany([], 'prefix')
  },
})
```

## Chain-specific variants

```typescript
for (const Scrt of [ Scrt_1_2, Scrt_1_3 ]) test({
  async [`get ${Scrt.name}.Agent.Bundle from agent`] ({ ok }) {
    const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
    const agent  = await Scrt_1_2.Agent.create({}, { mnemonic })
    const bundle = agent.bundle()
    ok(bundle instanceof Scrt_1_2.Agent.Bundle)
  }
})
```
