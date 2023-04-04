# Fadroma Connect Registry

This package acts as a hub for the available Fadroma Agent API implementations.
In practical terms, it allows you to connect to every backend that Fadroma supports.

## Connect CLI

```sh
$ fadroma chain list
```

### Connection configuration

## Connect API

```typescript
import connect from '@fadroma/connect'

const agent = await connect({})
```

### Connecting to...

#### Secret Network

```typescript
import { Chain as Scrt } from '@fadroma/scrt'
const supportedChains = [ Scrt, ]
```

```typescript
import { mnemonics } from '../../examples/Examples.spec.ts.md'
for (const Chain of supportedChains) {
  const chain = new Chain('test')
  const agent = await chain.getAgent({ mnemonic: mnemonics[0] })
  assert(agent instanceof Chain.Agent)
}
```

```typescript
for (const Chain of supportedChains) {
  ok(await new Chain('main', { mode: Chain.Mode.Mainnet }))
  ok(await new Chain('test', { mode: Chain.Mode.Testnet }))
  const node = { chainId: 'scrt-devnet', url: 'http://test:0' }
  const chain = await new Chain('dev', { mode: Chain.Mode.Devnet, node })
  ok(chain)
  equal(chain.node, node)
  equal(chain.url,  node.url)
  equal(chain.id,   node.chainId)
}
```

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
  await withMockAPIEndpoint(async endpoint => {
    const chain    = new Chain('test', { url: endpoint.url })
    const mnemonic = mnemonics[0]
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
}

// native token balance and transactions
for (const Chain of [
  ScrtAmino
]) {
  continue // TODO
  await withMockAPIEndpoint(async endpoint => {
    const chain     = new Chain('test', { url: endpoint.url })
    const mnemonic1 = mnemonics[0]
    const mnemonic2 = mnemonics[1]
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
    equal(await agent1.balance, "2000")
    equal(await agent2.balance, "3000")
    await agent1.send(agent2.address, "1000")
    equal(await agent1.balance, "1000")
    equal(await agent2.balance, "4000")
    await agent2.send(agent1.address, 500)
    equal(await agent1.balance, "1500")
    equal(await agent2.balance, "3500")
  })
}

// bundles implemented on all chains
for (const Chain of supportedChains) {
  const mnemonic = mnemonics[0]
  const agent    = await new Chain('🤡', {}).getAgent({ mnemonic })
  const bundle   = agent.bundle()
  ok(bundle instanceof Chain.Agent.Bundle)
}
```

### Connection to deployments

```typescript
import { Connector, connect } from '@fadroma/connect'
let context: Connector
//context = connect()
//context = connect({ config: { chain: 'id' } })
context = await config.connect()
```

### Connection events

```typescript
import { ConnectConsole } from '@fadroma/connect'
const log = new ConnectConsole()

log.noName({})        // Report When no chain has been selected.
log.supportedChains() // Report a list of supported chains

log.selectedChain()   // Report the currently selected chain
log.selectedChain({})
log.selectedChain({ chain: 'x' })

log.chainStatus({})
log.chainStatus({
  chain: { constructor: { name: 1 }, mode: 2, id: 3, url: new URL('http://example.com') }
})
log.chainStatus({
  chain: { constructor: { name: 1 }, mode: 2, id: 3, url: new URL('http://example.com') }
  deployments: { list () { return [] } }
})
log.chainStatus({
  chain: { constructor: { name: 1 }, mode: 2, id: 3, url: new URL('http://example.com') }
  deployments: { list () { return [] }, active: { name: 4 } }
})
```

### Connection errors

```typescript
import ConnectError from './ConnectError'

// When no target chain has been specified:
assert.ok(new ConnectError.NoChainSelected() instanceof ConnectError)

// When an unknown target chain has been requested:
assert.ok(new ConnectError.UnknownChainSelected() instanceof ConnectError)
```

```typescript
import * as Fadroma from '@fadroma/connect'
import assert, { ok, equal, deepEqual } from 'assert'
```

## Feature parity: chain internals

Fadroma wraps a common subset of underlying platform featuress into a common API.
This centers on the compute API (for executing contracts) and the bank API (for paying fees).

```typescript
for (const Chain of supportedChains) {
  await supportsMainnet(Chain)
  await supportsTestnet(Chain)
  await supportsDevnet(Chain)
  await supportsAgent(Chain)
  await supportsBundle(Chain)
  await supportsWaitingForNextBlock(Chain)
  await supportsNativeTransfers(Chain)
  await supportsSmartContracts(Chain)
}
```

### Chain modes

```typescript
async function supportsMainnet (Chain) {
  assert.ok(await new Chain('main', { mode: Chain.Mode.Mainnet }))
}

async function supportsTestnet (Chain) {
  assert.ok(await new Chain('test', { mode: Chain.Mode.Testnet }))
}

async function supportsDevnet (Chain) {
  const node   = { chainId: 'scrt-devnet', url: 'http://test:0' }
  const devnet = await new Chain('dev', { mode: Chain.Mode.Devnet, node })
  assert.ok(devnet)
}
```

### Agents and Bundles

```typescript
async function supportsAgent (Chain) {
  const chain = new Chain('test')
  const agent = await chain.getAgent({ mnemonic: mnemonics[0] })
  mockChainApi(chain, agent)
  assert(agent instanceof Chain.Agent)
  //assert.equal(agent.address, 'secret17tjvcn9fujz9yv7zg4a02sey4exau40lqdu0r7')
  const bundle = agent.bundle()
  assert.ok(bundle instanceof Chain.Agent.Bundle)
}

async function supportsBundle (Chain) {
  const chain = new Chain('test')
  const agent = await chain.getAgent({ mnemonic: mnemonics[0] })
  mockChainApi(chain, agent)
  const bundle = agent.bundle()
  assert.ok(bundle instanceof Chain.Agent.Bundle)
}

async function supportsWaitingForNextBlock (Chain) {
  const chain = new Chain('test')
  const agent = await chain.getAgent({ mnemonic: mnemonics[0] })
  mockChainApi(chain, agent)
  const [ height1, account1, balance1 ] = await Promise.all([ agent.height, agent.account, agent.balance ])
  await agent.nextBlock
  const [ height2, account2, balance2 ] = await Promise.all([ agent.height, agent.account, agent.balance ])
  assert.ok(height1 < height2)
  assert.deepEqual(account1, account2)
  assert.deepEqual(balance1, balance2)
}
```

### CosmWasm Bank API

```typescript
async function supportsNativeTransfers (Chain) {
  const chain = new Chain('test')
  const mnemonic1 = mnemonics[0]
  const mnemonic2 = mnemonics[1]
  const [agent1, agent2] = await Promise.all([
    chain.getAgent({mnemonic: mnemonic1}), chain.getAgent({mnemonic: mnemonic2}),
  ])
  mockChainApi(chain, agent1, agent2)

  assert.equal(await agent1.balance, "1000")
  assert.equal(await agent2.balance, "1000")

  await agent1.send(agent2.address,   "500")
  assert.equal(await agent1.balance,  "500")
  assert.equal(await agent2.balance, "1500")

  await agent2.send(agent1.address,    250)
  assert.equal(await agent1.balance,  "750")
  assert.equal(await agent2.balance, "1250")
}
```

### CosmWasm Compute API

```typescript
import { Contract } from '@fadroma/agent'
async function supportsSmartContracts (Chain) {
  const chain = new Chain('test')
  const agent = await chain.getAgent({ mnemonic: mnemonics[0] })
  mockChainApi(chain, agent)
  assert.ok(await agent.upload(new Uint8Array()))
  assert.ok(await agent.instantiate(new Contract({codeId: 1, codeHash: 'hash'})))
  assert.ok(await agent.execute(new Contract({})))
  assert.ok(await agent.query(new Contract({})))
}
```
