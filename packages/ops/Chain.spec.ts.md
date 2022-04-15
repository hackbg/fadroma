# `@fadroma/ops/Chain` spec

```typescript
import assert from 'assert'
const ChainSpec = {}
const test = tests => Object.assign(ChainSpec, tests)
export default ChainSpec
```

## Chain config

```typescript
import { Chain } from './Chain'
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
import { ChainMode } from './Chain'
import type { Agent } from './Agent'
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
  async 'Chain#getNonce must be implemented in subclass' ({ rejects }) {
    const chain = new Chain('chainid')
    await rejects(chain.getNonce())
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
