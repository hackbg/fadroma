# `@fadroma/ops/Client` test suite

```typescript
const ClientSpec = {}
const test = tests => Object.assign(ClientSpec, tests)
export default ClientSpec
```

## Creating a client

```typescript
import { Agent, Client } from '../index'
test({
  'to create a Client you need an Agent' ({ ok }) {
    ok(new Client(new Agent(), {}))
  }
})
```

## Gas fees

```typescript
import { ScrtGas as LegacyScrtGas } from '@fadroma/client-scrt-amino'
import { ScrtGas }                  from '@fadroma/client-scrt-grpc'
for (const Gas of [LegacyScrtGas, ScrtGas]) test({

  [`${Gas.name}: scrt gas unit is uscrt`] ({ equal }) {
    equal(ScrtGas.denom, 'uscrt')
  },

  [`${Gas.name}: default gas fees are set`] ({ ok }) {
    ok(ScrtGas.defaultFees.upload instanceof ScrtGas)
    ok(ScrtGas.defaultFees.init   instanceof ScrtGas)
    ok(ScrtGas.defaultFees.exec   instanceof ScrtGas)
    ok(ScrtGas.defaultFees.send   instanceof ScrtGas)
  },

  [`${Gas.name}: can create custom gas fee specifier`] ({ deepEqual }) {
    const fee = new ScrtGas(123)
    deepEqual(fee.amount, [{amount: '123', denom: 'uscrt'}])
  }

})
```
