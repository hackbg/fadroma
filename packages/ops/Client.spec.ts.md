# `@fadroma/ops/Client` test suite

```typescript
const ClientSpec = {}
const test = tests => Object.assign(ClientSpec, tests)
export default ClientSpec
```

## Switching agent

The `switchAgent` returns a new instance of the same `Client` subclass,
pointing to the same contract, but interacting as a different `Agent`.

```typescript
import { Client } from './Client'
test({
  async 'client.switchAgent' (assert) {
    const clientA = new Client({ agent: 'A', address: 'C', codeHash: 'D' })
    const clientB = clientA.switchAgent('B')
    assert(clientA instanceof Client)
    assert(clientB instanceof Client)
    assert(clientA !== clientB)
    assert(clientA.agent    === 'A')
    assert(clientB.agent    === 'B')
    assert(clientA.address  === 'C')
    assert(clientB.address  === 'C')
    assert(clientA.codeHash === 'D')
    assert(clientB.codeHash === 'D')
  },
})
```
