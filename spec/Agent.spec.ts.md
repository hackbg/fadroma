# Agents

The Agent class proxies the underlying API.

```typescript
const AgentSpec = {}
const test = tests => Object.assign(AgentSpec, tests)
export default AgentSpec
```

**TODO:** Reusable test suite for every agent subclass

## Base agent

```typescript
import { Agent } from '../index'

test({

  async "get balance for default denomination" ({ equal }) {
    const balances = { 'foo': '1', 'bar': '2' }
    class TestAgent extends Agent {
      defaultDenom = 'foo'
      getBalance (denom = this.defaultDenom) {
        return Promise.resolve(balances[denom] || '0')
      }
    }
    const agent = new TestAgent()
    equal(await agent.balance,           '1')
    equal(await agent.getBalance(),      '1')
    equal(await agent.getBalance('foo'), '1')
    equal(await agent.getBalance('bar'), '2')
    equal(await agent.getBalance('baz'), '0')
  },

  async "instantiate contract" ({ deepEqual }) {
    const instance = Symbol()
    const chainId  = Symbol()
    class TestAgent extends Agent {
      chain = { id: chainId }
      instantiate (template, label, msg, funds) {
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

  async "execute tx" ({ ok }) {
    class TestAgent extends Agent {
      async execute (contract, msg) { return {} }
    }
    ok(await new TestAgent().execute())
  },

  async "query contract" ({ ok }) {
    class TestAgent extends Agent {
      async query (contract, msg) { return {} }
    }
    ok(await new TestAgent().query())
  },

})
```

## Chain-specific variants

* `LegacyScrt.Agent` a.k.a. `LegacyScrtAgent`: uses secretjs 0.17.5
* `Scrt.Agent` a.k.a. `ScrtRPCAgent`: which uses the new gRPC API
  provided by secretjs 1.2-beta - as opposed to the old HTTP-based ("Amino"?) API
  supported in secretjs 0.17.5 and older.

```typescript
import { toBase64, fromBase64, fromUtf8, fromHex } from '../index'
import { withMockAPIEndpoint } from './_Harness'

import { LegacyScrt, Scrt } from '../index'

for (const Chain of [
  LegacyScrt,
  Scrt
  /* add other supported chains here */
]) test({

  async [`${Chain.name}: from mnemonic`] ({ equal, deepEqual }) {
    const chain    = new Chain('test')
    const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
    const agent    = await chain.getAgent({ mnemonic })
    equal(agent.chain,    chain)
    equal(agent.address, 'secret17tjvcn9fujz9yv7zg4a02sey4exau40lqdu0r7')
    /*deepEqual(agent.pubkey, {
      type:  'tendermint/PubKeySecp256k1',
      value: 'AoHyO3IEIOuffrGJoxwcYQnK+G1uMX/vQkzrjTXxMqTv'
    })*/
  },

  async [`${Chain.name}: wait for next block`] ({ equal, deepEqual }) {
    await withMockAPIEndpoint(async endpoint => {
      const chain    = new Chain('test', { url: endpoint.url })
      const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
      const agent    = await chain.getAgent({ mnemonic })
      const [ {header:{height:block1}}, account1, balance1 ] =
        await Promise.all([ agent.block, agent.account, agent.balance ])
      await agent.nextBlock
      const [ {header:{height:block2}}, account2, balance2 ] =
        await Promise.all([ agent.block, agent.account, agent.balance ])
      equal(block1 + 1, block2)
      deepEqual(account1, account2)
      deepEqual(balance1, balance2)
    })
  },

  async [`${Chain.name}: native token balance and transactions`] ({ equal }) {
    await withMockAPIEndpoint(async endpoint => {
      const chain     = new Chain('test', { url: endpoint.url })
      const mnemonic1 = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
      const mnemonic2 = 'bounce orphan vicious end identify universe excess miss random bench coconut curious chuckle fitness clean space damp bicycle legend quick hood sphere blur thing';
      const [agent1, agent2] = await Promise.all([
        chain.getAgent({mnemonic: mnemonic1}),
        chain.getAgent({mnemonic: mnemonic2}),
      ])
      endpoint.state.balances = { uscrt: { [agent1.address]: BigInt("2000"), [agent2.address]: BigInt("3000") } }
      equal(await agent1.balance, "2000")
      equal(await agent2.balance, "3000")
      await agent1.send(agent2.address, "1000")
      equal(await agent1.balance, "1000")
      equal(await agent2.balance, "4000")
      await agent2.send(agent1.address, 500)
      equal(await agent1.balance, "1500")
      equal(await agent2.balance, "3500")
    })
  },

  async [`${Chain.name}: full contract lifecycle`] ({ ok, equal, deepEqual }) {
    await withMockAPIEndpoint(async endpoint => {
      const chain    = new Chain('test', { url: endpoint.url })
      const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
      const agent    = await chain.getAgent({ mnemonic })
      const location = 'fixtures/empty.wasm'
      const codeHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      const artifact = { location, codeHash }
      const template = await agent.upload(artifact)
      equal(artifact.codeHash, template.codeHash)
      equal(template.codeId,   1)
      const label    = `contract_deployed_by_${agent.name}`
      const instance = await agent.instantiate(template, label, {})
      const { address } = instance
      ok(address, 'init tx returns contract address')
      console.debug(`test q ${address}`)
      throw 'TODO - how to decrypt/reencrypt query?'
      const queryResult = await agent.query({ address }, 'status')
      equal(queryResult, 'status')
      console.debug(`test tx ${address}`)
      const txResult = await agent.execute({ address }, 'tx', { option: "value" })
      deepEqual(txResult, {})
    })
  }

})
```
