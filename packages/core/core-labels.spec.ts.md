# Fadroma Core Spec: Contract label handling

```typescript
import assert from 'node:assert'
```

The label of a contract has to be unique per chain.
Fadroma introduces prefixes and suffixes to be able to navigate that constraint.

## Fetching the label

```typescript
import { fetchLabel, parseLabel, writeLabel } from '@fadroma/core'

let c = { address: 'addr' }
let a = { getLabel: () => Promise.resolve('label') }
assert.ok(await fetchLabel(c, a))
assert.ok(await fetchLabel(c, a, 'label'))
assert.rejects(fetchLabel(c, a, 'unexpected'))
```

## Label structure
