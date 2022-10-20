```typescript
import assert from 'node:assert'
import { PatchedSigningCosmWasmClient_1_2 } from './scrt-amino-patch'
const client = new PatchedSigningCosmWasmClient_1_2()
assert.ok(client.queryClient)
assert.equal(client.shouldRetry(''), true)
```typescript
