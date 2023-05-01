# Fadroma Guide: Secret Network

Fadroma's support for Secret Network is achieved in this package,
by implementing the core Fadroma Agent API (`Chain`, `Agent`, `Bundle`),
as well as SN-specific amenities on top of it (such as a `Snip20` token client
and a `ViewingKeyClient`).

* Like `@fadroma/agent`, this package aims to be *isomorphic*:
  one of its design goals is to be usable in Node and browsers without modification.
* `@fadroma/ops` automatically has this package through `@fadroma/connect`

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
const mainnet = Scrt.Chain.mainnet({ url: 'test' })
const testnet = Scrt.Chain.testnet({ url: 'test' })
const devnet  = Scrt.Chain.devnet({ id: 'test-scrt-devnet', url: 'test' })
const mocknet = Scrt.Chain.mocknet({ url: 'test' })
```

This will give you a `Scrt` instance (subclass of `Chain`):

```typescript
import { Chain } from '@fadroma/agent'
for (const chain of [mainnet, testnet]) {
  assert.ok(chain instanceof Chain && chain instanceof Scrt.Chain)
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
// TODO:
// const agent2 = await mainnet.fromKeplr().ready
// ok(agent2 instanceof Scrt.Agent)
// ok(agent2.chain instanceof Scrt.Chain)
// ok(agent2.mnemonic)
// ok(agent2.address)
```

### Authenticating in a script with secretcli

```typescript
// TODO:
// const agent3 = await mainnet.fromSecretCli()
// ok(agent3 instanceof Scrt.Agent)
// ok(agent3.chain instanceof Scrt.Chain)
// ok(agent3.mnemonic)
// ok(agent3.address)
```

## Querying data from Secret Network

The `SecretJS` module used by a `ScrtChain` is available on the `SecretJS` property.

```typescript
for (const chain of [mainnet, testnet, devnet, mocknet]) {
  await chain.api

  // FIXME: need mock
  //await chain.block
  //await chain.height

  // FIXME: rejects with "#<Object>" ?!
  // await chain.getBalance('scrt', 'address')
  // await chain.getLabel()
  // await chain.getCodeId()
  // await chain.getHash()
  // await chain.fetchLimits()

  // FIXME: Queries should be possible without an Agent.
  assert.rejects(()=>chain.query())
}
```

The `api`, `wallet`, and `encryptionUtils` properties of `ScrtAgent`
expose the `SecretNetworkClient`, `Wallet`, and `EncryptionUtils` (`EnigmaUtils`)
instances.

```typescript
await agent1.ready
ok(agent1.api)
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
import './Scrt.test.ts'
```
