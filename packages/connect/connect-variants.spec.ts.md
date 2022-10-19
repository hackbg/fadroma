# Fadroma Connect Variants

```typescript
import assert from 'node:assert'
```

* `ScrtAmino`: creates secretjs@0.17.5 based agent using lcd/amino
* `Scrt`: creates secretjs@beta based agent using grpc

```typescript
import { ScrtGrpc } from '@fadroma/scrt'
import { ScrtAmino } from '@fadroma/scrt-amino'
import { Mocknet } from '@fadroma/mocknet'

const mnemonics = [
  'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy',
  'bounce orphan vicious end identify universe excess miss random bench coconut curious chuckle fitness clean space damp bicycle legend quick hood sphere blur thing'
]

const supportedChains = [
  ScrtGrpc,
  ScrtAmino,
  Mocknet
]

for (const Chain of supportedChains) {

  let chain: Chain
  let agent: Agent

  chain = new Chain('test')
  agent = await chain.getAgent({ mnemonic: mnemonics[0] })
  assert(agent instanceof Chain.Agent)

  assert.ok(await new Chain('main', { mode: Chain.Mode.Mainnet }))
  assert.ok(await new Chain('test', { mode: Chain.Mode.Testnet }))

  const node = { chainId: 'scrt-devnet', url: 'http://test:0' }
  chain = await new Chain('dev', { mode: Chain.Mode.Devnet, node })
  assert.ok(chain)
  assert.equal(chain.node, node)
  assert.equal(chain.url,  node.url)
  assert.equal(chain.id,   node.chainId)
}
```

Agent variants:

* **ScrtAmino.Agent** a.k.a. **ScrtAminoAgent**: uses secretjs 0.17.5
* **Scrt.Agent** a.k.a. **ScrtGrpcAgent**: which uses the new gRPC API
  provided by secretjs 1.2-beta - as opposed to the old HTTP-based ("Amino"?) API
  supported in secretjs 0.17.5 and older.

```typescript
for (const Chain of supportedChains) {
  const chain    = new Chain('test', {})
  const mnemonic = mnemonics[0]
  const agent    = await chain.getAgent({ mnemonic })
  assert.equal(agent.chain,    chain)
  assert.equal(agent.address, 'secret17tjvcn9fujz9yv7zg4a02sey4exau40lqdu0r7')
}
// waiting for next block
for (const Chain of [
  ScrtAmino
]) {
  await Testing.withMockAPIEndpoint(async endpoint => {
    const chain    = new Chain('test', { url: endpoint.url })
    const mnemonic = mnemonics[0]
    const agent    = await chain.getAgent({ mnemonic })
    const [ {header:{height:block1}}, account1, balance1 ] =
      await Promise.all([ agent.block, agent.account, agent.balance ])
    await agent.nextBlock
    const [ {header:{height:block2}}, account2, balance2 ] =
      await Promise.all([ agent.block, agent.account, agent.balance ])
    assert.equal(block1 + 1, block2)
    assert.deepEqual(account1, account2)
    assert.deepEqual(balance1, balance2)
  })
}

// native token balance and transactions
for (const Chain of [
  ScrtAmino
]) {
  continue // TODO
  await withMockAPIEndpoint(async endpoint => {
    const chain     = new Chain('test', { url: endpoint.url })
    const mnemonic1 = Testing.mnemonics[0]
    const mnemonic2 = Testing.mnemonics[1]
    const [agent1, agent2] = await Promise.all([
      chain.getAgent({mnemonic: mnemonic1}),
      chain.getAgent({mnemonic: mnemonic2}),
    ])
    endpoint.state.balances = {
      uscrt: {
        [agent1.address]: BigInt("2000"),
        [agent2.address]: BigInt("3000")
      }
    }
    assert.equal(await agent1.balance, "2000")
    assert.equal(await agent2.balance, "3000")
    await agent1.send(agent2.address, "1000")
    assert.equal(await agent1.balance, "1000")
    assert.equal(await agent2.balance, "4000")
    await agent2.send(agent1.address, 500)
    assert.equal(await agent1.balance, "1500")
    assert.equal(await agent2.balance, "3500")
  })
}

// bundles implemented on all chains
for (const Chain of supportedChains) {
  const mnemonic = Testing.mnemonics[0]
  const agent    = await new Chain('🤡', {}).getAgent({ mnemonic })
  const bundle   = agent.bundle()
  assert.ok(bundle instanceof Chain.Agent.Bundle)
}
```
