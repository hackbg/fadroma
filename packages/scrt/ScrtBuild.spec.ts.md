# Fadroma for Secret Network: Builders

```typescript
import assert from 'assert'
const Spec = {}
const test = tests => Object.assign(Spec, tests)
export default Spec
```

```typescript
import { getScrtBuilder } from './ScrtBuild'
test({
  'get dockerode builder' ({ ok }) {
    ok(getScrtBuilder())
  },
  'get raw builder' ({ ok }) {
    ok(getScrtBuilder({ raw: true }))
  },
})
```
