# Fadroma Chains Spec

```typescript
import * as Testing from '../../TESTING.ts.md'
import * as Fadroma from '@fadroma/connect'
import assert, { ok, equal, deepEqual } from 'assert'
```

## Chain variants:

* `ScrtAmino`: creates secretjs@0.17.5 based agent using lcd/amino
* `Scrt`: creates secretjs@beta based agent using grpc

```typescript
import { Scrt } from '@fadroma/scrt'

const supportedChains = [
  Scrt,
]

for (const Chain of supportedChains) {
  const chain = new Chain('test')
  const agent = await chain.getAgent({ mnemonic: Testing.mnemonics[0] })
  assert(agent instanceof Chain.Agent)
}

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

Agent variants:

* **ScrtAmino.Agent** a.k.a. **ScrtAminoAgent**: uses secretjs 0.17.5
* **Scrt.Agent** a.k.a. **ScrtGrpcAgent**: which uses the new gRPC API
  provided by secretjs 1.2-beta - as opposed to the old HTTP-based ("Amino"?) API
  supported in secretjs 0.17.5 and older.

```typescript
for (const Chain of supportedChains) {
  const chain    = new Chain('test', {})
  const mnemonic = Testing.mnemonics[0]
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
    const mnemonic = Testing.mnemonics[0]
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
  const mnemonic = Testing.mnemonics[0]
  const agent    = await new Chain('🤡', {}).getAgent({ mnemonic })
  const bundle   = agent.bundle()
  ok(bundle instanceof Chain.Agent.Bundle)
}
```

## Connect config

```typescript
import { ConnectConfig } from '.'
const config = new ConnectConfig({ FADROMA_CHAIN: 'Mocknet' }, '')
```

## Connect context

```typescript
import { Connector, connect } from '.'
let context: Connector
//context = connect()
//context = connect({ config: { chain: 'id' } })
context = await config.connect()
```

## Connect events

```typescript
import { ConnectConsole } from '.'
const log = new ConnectConsole({
  log: () => {}, info: () => {}, warn: () => {}, error: () => {}
})
log.noName({})
log.noDeploy()
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
# Fadroma Connect Variants

```typescript
import assert from 'node:assert'
import * as Testing from '../../TESTING.ts.md'
```

* `ScrtAmino`: creates secretjs@0.17.5 based agent using lcd/amino
  * **ScrtAmino.Agent** a.k.a. **ScrtAminoAgent**: uses secretjs 0.17.5
* `Scrt`: creates secretjs@beta based agent using grpc
  * **Scrt.Agent** a.k.a. **ScrtGrpcAgent**: which uses the new gRPC API
    provided by secretjs 1.2-beta - as opposed to the old HTTP-based ("Amino"?) API
    supported in secretjs 0.17.5 and older.

```typescript
import { ScrtGrpc }  from '@fadroma/scrt'
import { ScrtAmino } from '@fadroma/scrt-amino'
import { Mocknet }   from '@fadroma/mocknet'

const mnemonics = [
  'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy',
  'bounce orphan vicious end identify universe excess miss random bench coconut curious chuckle fitness clean space damp bicycle legend quick hood sphere blur thing'
]
```

## Supported features

Fadroma wraps a common subset of underlying platform featuress into a common API.
This centers on the compute API (for executing contracts) and the bank API (for paying fees).

```typescript
const supportedChains = [
  ScrtGrpc,
  ScrtAmino,
]

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

### Agents and bundles

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

### Bank API

```typescript
async function supportsNativeTransfers (Chain) {
  const chain = new Chain('test')
  const mnemonic1 = Testing.mnemonics[0]
  const mnemonic2 = Testing.mnemonics[1]
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

### Compute API

```typescript
import { ContractInstance } from '@fadroma/core'
async function supportsSmartContracts (Chain) {
  const chain = new Chain('test')
  const agent = await chain.getAgent({ mnemonic: mnemonics[0] })
  mockChainApi(chain, agent)
  assert.ok(await agent.upload(new Uint8Array()))
  assert.ok(await agent.instantiate(new ContractInstance({codeId: 1, codeHash: 'hash'})))
  assert.ok(await agent.execute(new ContractInstance({})))
  assert.ok(await agent.query(new ContractInstance({})))
}
```

## Mocks of native chain APIs

This specification only tests whether the Fadroma packages
wrap the underlying chain APIs correctly. The underlying methods
are mocked out below.

```typescript
function mockChainApi (chain, ...agents) {
  if (chain instanceof ScrtGrpc) return mockScrtGrpcApi(chain, ...agents)
  if (chain instanceof ScrtAmino) return mockScrtAminoApi(chain, ...agents)
}
```

### Mock of SecretJS gRPC

```typescript
function mockScrtGrpcApi (chain, ...agents) {
  const balances = {}
  chain.SecretJS = {
    SecretNetworkClient: class MockSecretNetworkClient {
      static create = () => new this()
      query = {
        auth: {
          account: async () => ({})
        },
        bank: {
          async balance ({ address, denom }) {
            const amount = balances[address]
            return {balance:{amount}}
          }
        },
        tendermint: {
          getLatestBlock: async () => ({block:{header:{height:+new Date()}}})
        },
        compute: {
          codeHash: async () => ({}),
          queryContract: async () => ({})
        }
      }
      tx = {
        bank: {
          async send ({ fromAddress, toAddress, amount }) {
            balances[fromAddress] = String(Number(balances[fromAddress]) - Number(amount))
            balances[toAddress]   = String(Number(balances[toAddress]) + Number(amount))
          }
        },
        compute: {
          async storeCode () { return {} },
          async instantiateContract () { return { arrayLog: [] } },
          async executeContract () { return { code: 0 } }
        }
      }
    },
    Wallet: class MockSecretNetworkWallet {
    }
  }
  for (const i in agents) {
    const agent = agents[i]
    agent.address ??= `agent${i}`
    agent.api = new chain.SecretJS.SecretNetworkClient()
    assert.equal(chain, agent.chain)
    balances[agent.address] = '1000'
  }
}
```

### Mock of SecretJS Amino

```typescript
function mockScrtAminoApi (chain, ...agents) {
  const balances = {}
  for (const {address} of agents) balances[address] = '1000'
  chain.API = class MockCosmWasmClient {
    async getBlock () {
      return { header: { height: +new Date() } }
    }
  }
  for (const i in agents) {
    const agent = agents[i]
    agent.address ??= `agent${i}`
    agent.API = class MockSigningCosmWasmClient {
      async getAccount (address) {
        return { balance: [ { amount: balances[address], denom: 'uscrt' } ] }
      }
      async getBlock () {
        return { header: { height: +new Date() } }
      }
      async sendTokens (toAddress, amount) {
        const fromAddress = agent.address
        balances[fromAddress] = String(Number(balances[fromAddress]) - Number(amount))
        balances[toAddress]   = String(Number(balances[toAddress]) + Number(amount))
      }
      async upload () { return {} }
      async instantiate () { return { logs: [ { events: [ { attributes: [null, null, null, null, {}] } ] } ] } }
      async queryContractSmart () { return {} }
      async execute () { return {} }
    }
  }
}
```
```typescript
import assert from 'node:assert'
```

# Fadroma Core: Chains

This package provides the abstract base class, `Chain`.

Platform packages extend `Chain` to represent connections to different chains.
  * Since the workflow is request-based, no persistent connection is maintained.
  * The `Chain` object keeps track of the globally unique chain `id` and the connection `url`.
    * **TODO:** Load balancing between multiple chain endpoints.

```typescript
import { Chain } from '@fadroma/core'
let chain: Chain = new Chain('id', { url: 'example.com', mode: 'mainnet' })
assert.equal(chain.id,   'id')
assert.equal(chain.url,  'example.com')
assert.equal(chain.mode, 'mainnet')
```

Chains can be in several `mode`s, enumerated by `ChainMode` a.k.a. `Chain.Mode`:

* **Mocknet** is a fast, nodeless way of executing contract code
  in the local JS WASM runtime.
* **Devnet** uses a real chain node, booted up temporarily in
  a local environment.
* **Testnet** is a persistent remote chain used for testing.
* **Mainnet** is the production chain where value is stored.

```typescript
assert(Chain.mocknet('any').isMocknet)
assert(Chain.devnet('any').isDevnet)
assert(Chain.testnet('any').isTestnet)
assert(Chain.mainnet('any').isMainnet)
```

## Dev mode

The `chain.devMode` flag basically corresponds to whether you
have the ability to reset the whole chain and start over.

  * This is true for mocknet and devnet, but not for testnet or mainnet.
  * This can be used to determine whether to e.g. deploy mocks of
    third-party contracts, or to use their official testnet/mainnet addresses.

```typescript
assert(Chain.mocknet('any').devMode)
assert(Chain.devnet('any').devMode)
assert(!Chain.testnet('any').devMode)
assert(!Chain.mainnet('any').devMode)
```

# The `Agent` class: identifying to a backend

```typescript
import assert from 'node:assert'
```

To transact on a [chain](./Chains.ts.md) as a certain identity (account, wallet),
you obtain an `Agent` instance from the `Chain` object by providing credentials (mnemonic).

```typescript
import { Chain, Agent } from '@fadroma/core'
let chain: Chain = new Chain('id', { url: 'example.com', mode: 'mainnet' })
let agent: Agent = await chain.getAgent()
assert(agent instanceof Agent)
assert(agent.chain === chain)
```

* If you don't pass a mnemonic, a random mnemonic and address will be generated.
* Since some of the underlying platform APIs (such as cryptographical key generation)
  are asynchronous, so is the `getAgent` method.

## Chain metadata operations

### Getting the current block height

```typescript
await agent.height
```

### Waiting for the block height to increment

```typescript
await agent.nextBlock
```

## Native token operations

### Getting an agent's balance

```typescript
// In the default native token:
await agent.balance
await agent.getBalance()

// In a non-default native token:
await agent.getBalance('token')
```

### Sending native tokens

```typescript
// Sending the default native token:
await agent.send('recipient-address', 1000)
await agent.send('recipient-address', '1000')

// Sending a non-default native token:
await agent.send('recipient-address', [{denom:'token', amount: '1000'}])
```

## Smart contract operations

### Uploading a contract

```typescript
// Uploading a single piece of code:
await agent.upload('example.wasm')
await agent.upload(readFileSync('example.wasm'))
await agent.upload({ artifact: './example.wasm', codeHash: 'expectedCodeHash' })

// Uploading multiple pieces of code:
await agent.uploadMany([
  'example.wasm',
  readFileSync('example.wasm'),
  { artifact: './example.wasm', codeHash: 'expectedCodeHash' }
])
```

### Instantiating a contract

```typescript
// Instantiating a single contract:
await agent.instantiate({
  codeId:  '1',
  label:   'unique contract label',
  initMsg: { parameters: 'values' }
})

// Instantiating multiple contracts in a single transaction:
await agent.instantiateMany([
  { codeId: '2', label: 'unique contract label 2', initMsg: { parameters: 'values' } },
  { codeId: '3', label: 'unique contract label 3', initMsg: { parameters: 'values' } }
})
```

### Performing read-only queries

```typescript
await agent.query({ address: 'address', codeHash: 'codeHash' }, { parameters: 'values' })
```

### Executing contract transactions

```typescript
// Executing a single transaction
await agent.execute({ address: 'address', codeHash: 'codeHash' }, { parameters: 'values' })

// Broadcasting multiple execute calls as a single transaction message
await agent.bundle().wrap(bundle=>{
  await bundle.execute({ address: 'address', codeHash: 'codeHash' }, { parameters: 'values' })
  await bundle.execute({ address: 'address', codeHash: 'codeHash' }, { parameters: 'values' })
})
```

## Using genesis accounts

On devnet, Fadroma creates named genesis accounts for you,
which you can use by passing `name` to `getAgent`:

```typescript
const mockNode = { getGenesisAccount () { return {} }, respawn () {} }
chain = new Chain('id', { mode: Chain.Mode.Devnet, node: mockNode })
assert(await chain.getAgent({ name: 'Alice' }) instanceof Agent)
```

```typescript
import assert from 'node:assert'
```

# Fadroma Core: Transaction bundling

To submit multiple messages as a single transaction, you can
use Bundles.
  * A `Bundle` is a special kind of `Agent` that
    does not broadcast messages immediately.
  * Instead, messages are collected inside the bundle until
    the caller explicitly submits them.
  * Bundles can also be saved for manual signing of multisig
    transactions

```typescript
import { Chain, Agent, Bundle } from '@fadroma/core'
let chain: Chain = new Chain('id', { url: 'example.com', mode: 'mainnet' })
let agent: Agent = await chain.getAgent()
let bundle: Bundle
class TestBundle extends Bundle {
  async submit () { return 'submitted' }
  async save   () { return 'saved' }
}
```

A `Bundle` is designed to serve as a stand-in for its corresponding
`Agent`, and therefore implements the same API methods.
  * However, some operations don't make sense in the middle of a Bundle.
  * Most importantly, querying any state from the chain
    must be done either before or after the bundle.
  * Trying to query state from a `Bundle` agent will fail.

```typescript
import { Client } from '.'
bundle = new Bundle({ chain: {}, checkHash () { return 'hash' } })

assert(bundle.getClient(Client, '') instanceof Client)
assert.equal(await bundle.execute({}), bundle)
assert.equal(bundle.id, 1)
//assert(await bundle.instantiateMany({}, []))
//assert(await bundle.instantiateMany({}, [['label', 'init']]))
//assert(await bundle.instantiate({}, 'label', 'init'))
assert.equal(await bundle.checkHash(), 'hash')

assert.rejects(()=>bundle.query())
assert.rejects(()=>bundle.upload())
assert.rejects(()=>bundle.uploadMany())
assert.rejects(()=>bundle.sendMany())
assert.rejects(()=>bundle.send())
assert.rejects(()=>bundle.getBalance())
assert.throws(()=>bundle.height)
assert.throws(()=>bundle.nextBlock)
assert.throws(()=>bundle.balance)
```

To create and submit a bundle in a single expression,
you can use `bundle.wrap(async (bundle) => { ... })`:

```typescript
assert.equal(await new TestBundle(agent).wrap(async bundle=>{
  assert(bundle instanceof TestBundle)
}), 'submitted')

assert.equal(await new TestBundle(agent).wrap(async bundle=>{
  assert(bundle instanceof TestBundle)
}, undefined, true), 'saved')
```

```typescript
bundle = new TestBundle(agent)
assert.deepEqual(bundle.msgs, [])
assert.equal(bundle.id, 0)
assert.throws(()=>bundle.assertMessages())

bundle.add({})
assert.deepEqual(bundle.msgs, [{}])
assert.equal(bundle.id, 1)
assert.ok(bundle.assertMessages())
```

```typescript
bundle = new TestBundle(agent)
assert.equal(await bundle.run(""),       "submitted")
assert.equal(await bundle.run("", true), "saved")
assert.equal(bundle.depth, 0)

bundle = bundle.bundle()
assert.equal(bundle.depth, 1)
assert.equal(await bundle.run(), null)
```

```typescript
agent = new class TestAgent extends Agent { Bundle = class TestBundle extends Bundle {} }
bundle = agent.bundle()
assert(bundle instanceof Bundle)

agent = new class TestAgent extends Agent { Bundle = class TestBundle extends Bundle {} }
//await agent.instantiateMany(new Contract(), [])
//await agent.instantiateMany(new Contract(), [], 'prefix')
```

## `Fee`: Specifying per-transaction gas fees

```typescript
import { Fee } from '.'
```

* `client.fee` is the default fee for all transactions
* `client.fees: Record<string, IFee>` is a map of default fees for specific transactions
* `client.withFee(fee: IFee)` allows the caller to override the default fees.
  Calling it returns a new instance of the Client, which talks to the same contract
  but executes all transactions with the specified custom fee.

## `Fee`: Specifying per-transaction gas fees

```typescript
import { Fee } from '.'
```

* `client.fee` is the default fee for all transactions
* `client.fees: Record<string, IFee>` is a map of default fees for specific transactions
* `client.withFee(fee: IFee)` allows the caller to override the default fees.
  Calling it returns a new instance of the Client, which talks to the same contract
  but executes all transactions with the specified custom fee.

## Connect logs

```typescript
import { ConnectConsole } from '.'
const log = new ConnectConsole('(Test) Fadroma.Connect', {
  log: () => {}, info: () => {}, warn: () => {}, error: () => {}
})
log.noName({})
log.supportedChains()
log.selectedChain()
log.selectedChain({})
log.selectedChain({ chain: 'x' })
```
