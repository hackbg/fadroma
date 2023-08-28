# Generic CosmWasm-enabled chains

Fadroma supports connecting to any chain that supports CosmWasm.

For this, we currently use our own fork of `@cosmjs/*`,
unified into a single package, `@hackbg/cosmjs-esm`.

In these tests, we'll connect to the OKP4 testnet.

import assert from 'node:assert'
```typescript
import assert from 'node:assert'

import { OKP4 } from '@fadroma/connect'

const testnet = await OKP4.testnet().ready
assert(testnet instanceof OKP4.Chain)

console.log(await testnet.cognitaria())

console.log(await testnet.objectaria())

console.log(await testnet.lawStones())

const agent = await testnet.getAgent().ready
```

```typescript
```
