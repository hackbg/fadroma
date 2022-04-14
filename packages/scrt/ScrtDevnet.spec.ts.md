# Fadroma for Secret Network: Devnet

```typescript
import assert from 'assert'
const Spec = {}
const test = tests => Object.assign(Spec, tests)
export default Spec
```

```typescript
import { getScrtDevnet } from './ScrtDevnet'
test({
  'get scrt devnet' ({ ok }) {
    ok(getScrtDevnet())
  },
})
```
