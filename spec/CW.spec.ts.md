# Generic CosmWasm-enabled chains

```typescript
import assert from 'node:assert'
```

Fadroma supports connecting to any chain that supports CosmWasm.

For this, we currently use our own fork of `@cosmjs/*`,
unified into a single package, `@hackbg/cosmjs-esm`.

## OKP4 support

In these tests, we'll connect to the OKP4 testnet.

```typescript
import { OKP4 } from '@fadroma/connect'

const testnet = await OKP4.testnet().ready
assert(testnet instanceof OKP4.Chain)
```

You can use the `cognitaria`, `objectaria` and `lawStones` methods
to get lists of the corresponding contracts.

```typescript
console.log(await testnet.cognitaria())
console.log(await testnet.objectaria())
console.log(await testnet.lawStones())
```

To interact with them, you need to authenticate. This is done with
the `getAgent` method. The returned `OKP4Agent` has the same listing
methods - only this time the contracts are returned ready to use.

```typescript
const agent = await testnet.getAgent().ready

console.log(await agent.cognitaria())
console.log(await agent.objectaria())
console.log(await agent.lawStones())
```
