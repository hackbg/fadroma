# Fadroma Connect Registry

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

const platforms = ['secretjs', 'secretcli']
const modes     = ['mainnet', 'testnet', 'devnet', 'mocknet']
const mnemonic  = '...'

for (const platform of platforms) {
  for (const mode of modes) {
    const { chain, agent } = connect({ platform, mode, mnemonic })
  }
}
```
