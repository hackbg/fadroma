<div align="center">

# Fadroma Agent for CosmWasm

[![](https://img.shields.io/npm/v/@fadroma/cw?color=%2365b34c&label=%40fadroma%2Fcw&style=for-the-badge)](https://www.npmjs.com/package/@fadroma/cw)

This package lets you use Fadroma Agent on most CosmWasm-enabled networks.
For Secret Network, see `@fadroma/cw` instead.

See https://fadroma.tech for more info.

</div>

## Supported networks

There is basic support for all CosmWasm chains that are accessible via `@cosmjs/stargate`.
For this, we currently use our own fork of the `@cosmjs/*` packages,
unified into a single package, [`@hackbg/cosmjs-esm`](https://www.npmjs.com/package/@hackbg/cosmjs-esm).

However, availability of chain-specific features is subject to implementation
within `@fadroma/cw`. For now, we have basic support for OKP4's chain-specific features.

```typescript
// TODO add example for connecting to generic CW-enabled chain
```
