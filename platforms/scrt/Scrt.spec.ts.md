# Fadroma: Secret Network support

Fadroma's support for Secret Network is achieved in this package,
by implementing the Fadroma Agent API (`Chain`, `Agent`, `Bundle`),
as well as SN-specific features (`ViewingKeyClient`).

Note that this package should be kept isomorphic (see `@fadroma/agent`).
Platform-specific logic and artifacts for Secret Network also exists
in `@fadroma/devnet`.

```typescript
import { Scrt } from '@fadroma/connect'
import assert from 'node:assert'
```

## Configuring

Several options are exposed as environment variables.

```typescript
const config = new Scrt.Config()
```

## Connecting

To connect to Secret Network with Fadroma, use one of the following:

```typescript
const mainnet = Scrt.Chain.Mainnet()
const testnet = Scrt.Chain.Testnet()
//const devnet  = Scrt.Devnet()
//const mocknet = Scrt.Mocknet()
```

This will give you a `Scrt` instance (subclass of `Chain`):

```typescript
import { Chain } from '@fadroma/agent'
for (const chain of [mainnet, testnet]) {
  assert.ok(chain instanceof Chain && chain instanceof Scrt)
}
```

## Authentication

To interact with Secret Network, you need to authenticate as an `Agent`:

### Authenticating with a fresh wallet

This gives you a randomly generated mnemonic.

```typescript
const agent0 = await mainnet.getAgent().ready

assert.ok(agent0 instanceof Scrt.Agent)
assert.ok(agent0.chain instanceof Scrt.Chain)
assert.ok(agent0.mnemonic)
assert.ok(agent0.address)
```

The `mnemonic` property of `Agent` will be hidden to prevent leakage.

### Authenticating with a known mnemonic

```typescript
const agent1 = await mainnet.getAgent({ mnemonic: '...' }).ready

ok(agent1 instanceof Scrt.Agent)
ok(agent1.chain instanceof Scrt.Chain)
ok(agent1.mnemonic)
ok(agent1.address)
```

### Authenticating in the browser with Keplr

```typescript
// TODO (these are not implemented yet)
//
// const agent2 = await mainnet.fromKeplr().ready
//
// ok(agent2 instanceof Scrt.Agent)
// ok(agent2.chain instanceof Scrt.Chain)
// ok(agent2.mnemonic)
// ok(agent2.address)
```

### Authenticating in a script with secretcli

```typescript
// TODO (these are not implemented yet)
//
// const agent3 = await mainnet.fromSecretCli()
//
// ok(agent3 instanceof Scrt.Agent)
// ok(agent3.chain instanceof Scrt.Chain)
// ok(agent3.mnemonic)
// ok(agent3.address)
```

## Authorization

### Using viewing keys

Fadroma provides the `VKClient` class for embedding into your own `Client` classes
for contracts that use SNIP20-compatible the viewing keys.

```typescript
const client = new Scrt.VKClient()
```

```typescript
import { Client } from '@fadroma/agent'
class MyClient extends Client {
  vk = new Scrt.VKClient()
}
```

### Using query permits

```typescript
// TODO add docs
```

## Implementation details

### Transaction bundling

A Secret Network-specific implementation of message bundling is included:

```typescript
const bundle = agent0.bundle()
ok(bundle instanceof Scrt.Bundle)
```

---

```typescript
import { ok } from 'node:assert'
```
