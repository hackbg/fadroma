<div align="center">

# Fadroma Agent for generic CosmWasm

[![](https://img.shields.io/npm/v/@fadroma/scrt?color=%2365b34c&label=%40fadroma%2Fscrt&style=for-the-badge)](https://www.npmjs.com/package/@fadroma/scrt)

This package lets you use Fadroma Agent on CosmWasm-enabled networks.

See https://fadroma.tech for more info.

</div>

## Supported networks

### [OKP4](https://okp4.network/)

OKP4 is an Open Knowledge Platform For decentralized ontologies.

```typescript
import { OKP4 } from '@fadroma/cw'

const okp4 = OKP4.mainnet()
```

### Others

There is basic support for all chains accessible via `@cosmjs/stargate`.
However, chain-specific features may not be directly available.

```typescript
```
