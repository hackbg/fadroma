# `@fadroma/scrt-next` Agent class (ScrtRPCAgent)

This is the test specification for the `ScrtRPCAgent` class,
which uses the new gRPC API provided by SecretJS 1.2-beta -
as opposed to the old HTTP-based ("Amino"?) API from SecretJS 0.17.5 and older.

```typescript
import { ScrtRPCAgent } from './ScrtRPCAgent'
```

* [ ] TODO: These tests are mostly identical between ScrtRPCAgent and ScrtRPCAgent,
      but don't really belong upstream (in `@fadroma/ops`). To deduplicate them
      (and compare that all `Agent` implementations work equally), we gotta put
      them downstream, in a private package e.g. `@fadroma/tests`

```typescript
export default {

  async 'from mnemonic' ({ equal, deepEqual }) {
    const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
    const agent = await ScrtRPCAgent.create({ mnemonic })
    equal(agent.mnemonic, mnemonic)
    equal(agent.address, 'secret17tjvcn9fujz9yv7zg4a02sey4exau40lqdu0r7')
    deepEqual(agent.pubkey, {
      type:  'tendermint/PubKeySecp256k1',
      value: 'AoHyO3IEIOuffrGJoxwcYQnK+G1uMX/vQkzrjTXxMqTv'
    })
  },

  async 'wait for next block' ({ equal, deepEqual }) {
    const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
    const [agent, endpoint] = await Promise.all([ScrtRPCAgent.create({ mnemonic }), mockAPIEndpoint()])
    try {
      agent.chain = { url: endpoint.url }
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

  async 'native token balance and transactions' ({ equal }) {
    const mnemonic1 = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
    const mnemonic2 = 'bounce orphan vicious end identify universe excess miss random bench coconut curious chuckle fitness clean space damp bicycle legend quick hood sphere blur thing';
    const [agent1, agent2, endpoint] = await Promise.all([
      ScrtRPCAgent.create({mnemonic: mnemonic1}),
      ScrtRPCAgent.create({mnemonic: mnemonic2}),
      mockAPIEndpoint()
    ])
    try {
      agent1.chain = agent2.chain = { url: endpoint.url }
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

  async "full contract lifecycle" ({ ok, equal, deepEqual }) {
    const mnemonic = 'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy';
    const [agent, endpoint] = await Promise.all([ScrtRPCAgent.create({ mnemonic }), mockAPIEndpoint()])
    agent.chain = { id: 'testing', url: endpoint.url }
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

}
```
