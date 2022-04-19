# Fadroma for Secret Network: Chain object

```typescript
import assert from 'assert'
const Spec = {}
const test = tests => Object.assign(Spec, tests)
export default Spec
```

```typescript
import { Chain } from '@fadroma/ops'
import { Scrt_1_2 } from './ScrtChain'
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
    const chain = await Scrt_1_2.chains.Devnet(node)
    ok(chain)
    equal(chain.node,   node)
    equal(chain.apiURL, node.apiURL)
    equal(chain.id,     node.chainId)
  },
})
```
