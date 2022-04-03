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
