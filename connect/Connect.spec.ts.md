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

for (const platform of ['secretjs', 'secretcli']) {
  for (const mode of ['mainnet', 'testnet', 'devnet', 'mocknet']) {
    const { chain, agent } = connect({ platform, mode, mnemonic: '...' })
  }
}
```

This package is responsible for selecting and dispatching to the
appropriate implementation; the implementations themselves reside
in the corresponding packages: `@fadroma/scrt`, etc.

```typescript
import '../platforms/scrt/Scrt.spec.ts.md'
import '../platforms/cw/CW.spec.ts.md'
import '../platforms/evm/EVM.spec.ts.md'
```
