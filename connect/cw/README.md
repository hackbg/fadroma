<div align="center">

# Fadroma Agent for generic CosmWasm

[![](https://img.shields.io/npm/v/@fadroma/scrt?color=%2365b34c&label=%40fadroma%2Fscrt&style=for-the-badge)](https://www.npmjs.com/package/@fadroma/scrt)

This package lets you use Fadroma Agent on CosmWasm-enabled networks.

See https://fadroma.tech for more info.

</div>

## Supported networks

### Others

There is basic support for all chains accessible via `@cosmjs/stargate`.
However, chain-specific features may not be directly available.

```typescript
// TODO add example for connecting to generic CW-enabled chain
```

---

# Generic CosmWasm-enabled chains

```typescript
import assert from 'node:assert'
```

Fadroma supports connecting to any chain that supports CosmWasm.

For this, we currently use our own fork of the `@cosmjs/*` packages,
unified into a single package, [`@hackbg/cosmjs-esm`](https://www.npmjs.com/package/@hackbg/cosmjs-esm).

## OKP4 support

In these tests, we'll connect to a local OKP4 devnet
managed by Fadroma on your local Docker installation.
(Make sure you can call `docker` without `sudo`!)

```typescript
import '@hackbg/fadroma' // installs devnet support
import { OKP4 } from '@fadroma/connect'

const okp4 = await OKP4.devnet({ deleteOnExit: true }).ready
assert(okp4 instanceof OKP4.Chain)
```

You can use the `cognitaria`, `objectaria` and `lawStones` methods
to get lists of the corresponding contracts.

```typescript
console.log(await okp4.cognitaria())
console.log(await okp4.objectaria())
console.log(await okp4.lawStones())
```

To interact with them, you need to authenticate. This is done with
the `getAgent` method. The returned `OKP4Agent` has the same listing
methods - only this time the contracts are returned ready to use.

```typescript
const signer = { /* get this from keplr */ }
const agent = await okp4.getAgent({ signer }).ready

console.log(await agent.cognitaria())
console.log(await agent.objectaria())
console.log(await agent.lawStones())
```
