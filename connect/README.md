<div align="center">

# Fadroma Connect

[![](https://img.shields.io/npm/v/@fadroma/connect?color=%2365b34c&label=%40fadroma%2Fconnect&style=for-the-badge)](https://www.npmjs.com/package/@fadroma/connect)

Catalog of Fadroma Agent implementations.

See https://fadroma.tech for more info.

</div>

This package acts as a hub for the available Fadroma Agent API implementations.
In practical terms, it allows you to connect to every chain (or other backend)
that Fadroma supports.

## Connect CLI

```sh
$ fadroma chain list
```

### Connection configuration

## Connect API

```typescript
import connect from '@fadroma/connect'

for (const platform of ['secretjs', 'secretcli']) {
  for (const mode of ['mainnet', 'testnet', 'devnet', 'mocknet']) {
    const { chain, agent } = connect({ platform, mode, mnemonic: '...' })
  }
}
```

## Configuration

```typescript
import { ConnectConfig } from '@fadroma/connect'
const config = new ConnectConfig()
config.getChain()
config.getChain(null)
assert.throws(()=>config.getChain('NoSuchChain'))
config.getAgent()
config.listChains()
```

## Errors

```typescript
import { ConnectError, ConnectConsole } from '@fadroma/connect'
new ConnectError.NoChainSelected()
new ConnectError.UnknownChainSelected()
new ConnectConsole().selectedChain()
```

---

```typescript
import assert from 'node:assert'
```
