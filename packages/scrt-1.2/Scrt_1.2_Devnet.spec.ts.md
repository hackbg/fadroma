# Fadroma for Secret Network: Devnet

```typescript
import assert from 'assert'
const Spec = {}
const test = tests => Object.assign(Spec, tests)
export default Spec
```

```typescript
import { getScrt_1_2_Devnet } from './Scrt_1.2_Devnet'
test({
  'get scrt devnet' ({ ok }) {
    ok(getScrt_1_2_Devnet())
  },
})
```
