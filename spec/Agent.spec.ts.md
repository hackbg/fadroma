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

  async "get balance by denomination" ({ equal }) {
    class TestAgent extends Agent {
      defaultDenomination = 'foo'
      get account () {
        return Promise.resolve({
          balance: [
            {amount: 1, denom: 'foo'},
            {amount: 2, denom: 'bar'},
          ]
        })
      }
    }
    const agent = new TestAgent()
    equal(await agent.balance,           1)
    equal(await agent.getBalance(),      1)
    equal(await agent.getBalance('foo'), 1)
    equal(await agent.getBalance('bar'), 2)
    equal(await agent.getBalance('baz'), 0)
  },

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

  async "execute tx" () {
    class TestAgent extends Agent {
      doExecute (contract, msg) {}
    }
    await new TestAgent().execute()
  },

  async "query contract" () {
    class TestAgent extends Agent {
      doQuery (contract, msg) {}
    }
    await new TestAgent().query()
  },

})
```

## Chain-specific variants

* `Scrt_1_2.Agent` a.k.a. `ScrtAgent`: uses secretjs 0.17.5
* `Scrt_1_3.Agent` a.k.a. `ScrtRPCAgent`: which uses the new gRPC API
  provided by secretjs 1.2-beta - as opposed to the old HTTP-based ("Amino"?) API
  supported in secretjs 0.17.5 and older.

```typescript
import { Scrt_1_2, Scrt_1_3, toBase64, fromBase64, fromUtf8, fromHex } from '../index'
import { mockAPIEndpoint } from './_Harness'
for (const Scrt of [ Scrt_1_2, Scrt_1_3 ]) test({

  async [`${Scrt.name}: from mnemonic`] ({ equal, deepEqual }) {
    const chain = Symbol()
    const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
    const agent = await Scrt.Agent.create(chain, { mnemonic })
    equal(agent.chain,    chain)
    equal(agent.mnemonic, mnemonic)
    equal(agent.address, 'secret17tjvcn9fujz9yv7zg4a02sey4exau40lqdu0r7')
    deepEqual(agent.pubkey, {
      type:  'tendermint/PubKeySecp256k1',
      value: 'AoHyO3IEIOuffrGJoxwcYQnK+G1uMX/vQkzrjTXxMqTv'
    })
  },

  async [`${Scrt.name}: wait for next block`] ({ equal, deepEqual }) {
    const endpoint = await mockAPIEndpoint()
    const chain    = { apiURL: endpoint.url }
    const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
    const agent    = await Scrt.Agent.create(chain, { mnemonic })
    try {
      const [ {header:{height:block1}}, account1, balance1 ] =
        await Promise.all([ agent.block, agent.account, agent.balance ])
      await agent.nextBlock
      const [ {header:{height:block2}}, account2, balance2 ] =
        await Promise.all([ agent.block, agent.account, agent.balance ])
      equal(block1 + 1, block2)
      deepEqual(account1, account2)
      deepEqual(balance1, balance2)
    } finally {
      endpoint.close()
    }
  },

  async [`${Scrt.name}: native token balance and transactions`] ({ equal }) {
    const endpoint  = await mockAPIEndpoint()
    const chain     = { apiURL: endpoint.url }
    const mnemonic1 = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
    const mnemonic2 = 'bounce orphan vicious end identify universe excess miss random bench coconut curious chuckle fitness clean space damp bicycle legend quick hood sphere blur thing';
    const [agent1, agent2] = await Promise.all([
      Scrt.Agent.create(chain, {mnemonic: mnemonic1}),
      Scrt.Agent.create(chain, {mnemonic: mnemonic2}),
    ])
    try {
      endpoint.state.balances = { uscrt: { [agent1.address]: BigInt("2000"), [agent2.address]: BigInt("3000") } }
      equal(await agent1.balance, "2000")
      equal(await agent2.balance, "3000")
      await agent1.send(agent2.address, "1000")
      equal(await agent1.balance, "1000")
      equal(await agent2.balance, "4000")
      await agent2.send(agent1.address, 500)
      equal(await agent1.balance, "1500")
      equal(await agent2.balance, "3500")
    } finally {
      endpoint.close()
    }
  },

  async [`${Scrt.name}: full contract lifecycle`] ({ ok, equal, deepEqual }) {
    const endpoint = await mockAPIEndpoint()
    const chain    = { id: 'testing', apiURL: endpoint.url }
    const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
    const agent    = await Scrt.Agent.create(chain, { mnemonic })
    try {
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
    } finally {
      endpoint.close()
    }
  }

})
```
