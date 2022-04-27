# `@fadroma/ops/Client` test suite

```typescript
const ClientSpec = {}
const test = tests => Object.assign(ClientSpec, tests)
export default ClientSpec
```

## Creating a client

```typescript
import { Client } from './Client'
test({
  'create client' ({ ok }) {
    ok(new Client())
  }
})
```

## Switching agent

The `switchAgent` returns a new instance of the same `Client` subclass,
pointing to the same contract, but interacting as a different `Agent`.

```typescript
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

## Gas fees

```typescript
import { ScrtGas } from './ScrtGas'
test({
  'scrt gas unit is uscrt' ({ equal }) {
    equal(ScrtGas.denom, 'uscrt')
  },
  'default gas fees' ({ ok }) {
    ok(ScrtGas.defaultFees.upload instanceof ScrtGas)
    ok(ScrtGas.defaultFees.init   instanceof ScrtGas)
    ok(ScrtGas.defaultFees.exec   instanceof ScrtGas)
    ok(ScrtGas.defaultFees.send   instanceof ScrtGas)
  },
  'custom gas fee' ({ deepEqual }) {
    const fee = new ScrtGas(123)
    deepEqual(fee.amount, [{amount: '123', denom: 'uscrt'}])
  }
})
```
