# Fadroma for Secret Network: Chain object

```typescript
import assert from 'assert'
const Spec = {}
const test = tests => Object.assign(Spec, tests)
export default Spec
```

```typescript
import { Scrt_1_2 } from './ScrtChain'
test({
  async 'Scrt_1_2.chains.Mainnet' ({ ok }) {
    ok(await Scrt_1_2.chains.Mainnet())
  },
  async 'Scrt_1_2.chains.Testnet' ({ ok }) {
    ok(await Scrt_1_2.chains.Testnet())
  },
  async 'Scrt_1_2.chains.Devnet' ({ ok, equal }) {
    const node = {
      chainId: 'scrt-devnet',
      apiURL:  'http://test:0'
    }
    const chain = await Scrt_1_2.chains.Devnet(node)
    ok(chain)
    equal(chain.node,   node)
    equal(chain.apiURL, node.apiURL)
    equal(chain.id,     node.chainId)
  },
})
```
