# `@fadroma/ops/Chain` spec

```typescript
import assert from 'assert'
const ChainSpec = {}
const test = tests => Object.assign(ChainSpec, tests)
export default ChainSpec
```

## Chain config

```typescript
import { Chain } from '../index'
test({
  'chain id' () {
    const chain = new Chain('chainid')
    assert(chain.id === 'chainid')
  },
  'chain API URL' () {
    const apiURL = 'http://example.com'
    const chain = new Chain('chainid', { apiURL })
    assert(chain.url === apiURL)
  }
})
```

## Chain modes

```typescript
import { ChainMode, Agent } from '../index'
test({
  'mainnet' () {
    const mode = ChainMode.Mainnet
    const chain = new Chain('chainid', { mode })
    assert(chain.isMainnet)
    assert(!chain.isTestnet)
    assert(!chain.isDevnet)
  },
  'testnet' () {
    const mode = ChainMode.Testnet
    const chain = new Chain('chainid', { mode })
    assert(!chain.isMainnet)
    assert(chain.isTestnet)
    assert(!chain.isDevnet)
  },
  'devnet' () {
    const mode = ChainMode.Devnet
    const chain = new Chain('chainid', { mode })
    assert(!chain.isMainnet)
    assert(!chain.isTestnet)
    assert(chain.isDevnet)
  },
})
```

## Chain features

```typescript
test({
  'Chain#getNonce must be implemented in subclass' ({ throws }) {
    const chain = new Chain('chainid')
    throws(()=>chain.getNonce())
  },
  async 'Chain#getAgent takes string only on devnet' ({ rejects, equal }) {
    const agent = Symbol()
    class TestChain extends Chain {
      Agent = { async create () { return agent } }
    }
    const chain = new TestChain('chainid')
    await rejects(chain.getAgent(''))
    chain.node = { getGenesisAccount () { return {} } }
    equal(await chain.getAgent(''), agent)
  },
  async 'Chain#getAgent takes Identity object' ({ rejects, ok }) {
    const chain = new Chain('chainid')
    ok(await chain.getAgent({}) instanceof Agent)
  }
})
```

## Secret Network 1.2 Chain Interface

```typescript
import { Chain, Scrt_1_2 } from '../index'
test({
  async 'SN mainnet' ({ ok }) {
    ok(await Chain.getNamed('Scrt_1_2_Mainnet'))
  },
  async 'SN testnet' ({ ok }) {
    ok(await Chain.getNamed('Scrt_1_2_Testnet'))
  },
  async 'SN devnet' ({ ok, equal }) {
    const node = {
      chainId: 'scrt-devnet',
      apiURL:  'http://test:0'
    }
    const chain = await Scrt_1_2.chains.Devnet({ node })
    ok(chain)
    equal(chain.node,   node)
    equal(chain.apiURL, node.apiURL)
    equal(chain.id,     node.chainId)
  },
})
```

## Secret Network 1.3 Chain Interface
