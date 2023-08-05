# Generic CosmWasm-enabled chains

Fadroma supports CosmWasm LCD through CosmJS Stargate.

```typescript
import { OKP4 } from '@fadroma/connect'
const testnet = OKP4.testnet()
const agent = await testnet.getAgent().ready
console.log({agent}, agent.api)
```

```typescript
import assert from 'node:assert'
assert(testnet instanceof OKP4.Chain)
```
