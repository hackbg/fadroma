# `@fadroma/ops` Agent

```typescript
import assert from 'assert'
const AgentSpec = {}
const test = tests => Object.assign(AgentSpec, tests)
export default AgentSpec
```

## Agent config

```typescript
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

  async "instantiate contract" () {
    class TestAgent extends Agent {
      doInstantiate (template, label, msg, funds) {
        return {template, label, msg, funds}
      }
    }
    const agent = new TestAgent()
    const template = {chain, codeId}
    const label    = 'label'
    const msg      = {}
    const funds    = []
    assert(
      await agent.instantiate(template, label, init, funds) === {template, label, init, funds}
    )
  },

  async "instantiate multiple contracts in 1 tx" () {
    throw 'TODO'
  },

  async "query contract" () {
    throw 'TODO'
  },

  async "execute tx" () {
    throw 'TODO'
  },

  async "execute many msgs in 1 tx" () {
    throw 'TODO'
  }
})
```
