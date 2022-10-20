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
  Mocknet
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
  assert.equal(devnet.node, node)
  assert.equal(devnet.url,  node.url)
  assert.equal(devnet.id,   node.chainId)
}
```

### Agents and bundles

```typescript
async function supportsAgent (Chain) {
  const chain = new Chain('test')
  const agent = await chain.getAgent({ mnemonic: mnemonics[0] })
  mockChainApi(chain, agent)
  assert(agent instanceof Chain.Agent)
  assert.equal(agent.address, 'secret17tjvcn9fujz9yv7zg4a02sey4exau40lqdu0r7')
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
    chain.getAgent({mnemonic: mnemonic1}),
    chain.getAgent({mnemonic: mnemonic2}),
  ])
  agent1.address = 'address1'
  agent2.address = 'address2'
  mockChainApi(chain, agent1, agent2)
  assert.equal(await agent1.balance, "1000")
  assert.equal(await agent2.balance, "2000")

  await agent1.send(agent2.address, "500")
  assert.equal(await agent1.balance,  "500")
  assert.equal(await agent2.balance, "2500")

  await agent2.send(agent1.address, 250)
  assert.equal(await agent1.balance,  "750")
  assert.equal(await agent2.balance, "2250")
}
```

### Compute API

```typescript
async function supportsSmartContracts (Chain) {
  // TODO
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
  const balances = {
    'address1': '1000',
    'address2': '2000'
  }
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
        }
      }
      tx = {
        bank: {
          async send ({ fromAddress, toAddress, amount }) {
            balances[fromAddress] = String(Number(balances[fromAddress]) - Number(amount))
            balances[toAddress]   = String(Number(balances[toAddress]) + Number(amount))
          }
        }
      }
    },
    Wallet: class MockSecretNetworkWallet {
    }
  }
  for (const agent of agents) {
    agent.api = new chain.SecretJS.SecretNetworkClient()
    assert.equal(chain, agent.chain)
  }
}
```

### Mock of SecretJS Amino

```typescript
function mockScrtAminoApi (chain, ...agents) {
  const balances = {
    'address1': '1000',
    'address2': '2000'
  }
  chain.API = class MockCosmWasmClient {
    async getBlock () {
      return { header: { height: +new Date() } }
    }
  }
  for (const agent of agents) {
    agent.API = class MockSigningCosmWasmClient {
      async getAccount () {
        return { balance: [] }
      }
      async getBlock () {
        return { header: { height: +new Date() } }
      }
    }
  }
}
```
