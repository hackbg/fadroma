# `@fadroma/ops` Agent

```typescript
import assert from 'assert'
const AgentSpec = {}
const test = tests => Object.assign(AgentSpec, tests)
export default AgentSpec
```

**TODO:** Reusable test suite for every agent subclass

## Interacting with the chain

```typescript
import { Agent } from './Agent'
test({
  async "get balance by denomination" () {
    class TestAgent extends Agent {
      defaultDenomination = 'foo'
      get account () {
        return Promise.resolve({
          balance: [
            {amount:1,denom:'foo'},
            {amount:2,denom:'bar'},
          ]
        })
      }
    }
    const agent = new TestAgent()
    assert(await agent.balance === 1)
    assert(await agent.getBalance() === 1)
    assert(await agent.getBalance('foo') === 1)
    assert(await agent.getBalance('bar') === 2)
    assert(await agent.getBalance('baz') === 0)
  },
})
```

## Interacting with a contract on the chain

```typescript
import { Bundle } from './Agent'
test({

  async "instantiate contract" ({ deepEqual }) {
    const instance = Symbol()
    const chainId  = Symbol()
    class TestAgent extends Agent {
      chain = { id: chainId }
      doInstantiate (template, label, msg, funds) {
        return {instance, template, label, msg, funds}
      }
    }
    const codeId   = Symbol()
    const template = {chainId, codeId}
    const label    = Symbol()
    const msg      = Symbol()
    const funds    = Symbol()
    const agent = new TestAgent()
    deepEqual(
      await agent.instantiate(template, label, msg, funds),
      {instance, template, label, msg, funds}
    )
  },

  async "instantiate multiple contracts in 1 tx" () {
    class TestAgent extends Agent {
      Bundle = class TestBundle extends Bundle {}
    }
    await new TestAgent().instantiateMany([])
    await new TestAgent().instantiateMany([], 'prefix')
  },

  async "execute tx" () {
    class TestAgent extends Agent {
      doExecute (contract, msg) {}
    }
    await new TestAgent().execute()
  },

  async "tx bundles" () {
    class TestAgent extends Agent {
      Bundle = class TestBundle extends Bundle {}
    }
    const agent = new TestAgent()
    const bundle = agent.bundle()
    assert(bundle instanceof Bundle)
  },

  async "query contract" () {
    class TestAgent extends Agent {
      doQuery (contract, msg) {}
    }
    await new TestAgent().query()
  },

})
```
