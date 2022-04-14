# Fadroma for Secret Network: Gas

```typescript
import assert from 'assert'
const Spec = {}
const test = tests => Object.assign(Spec, tests)
export default Spec
```

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
