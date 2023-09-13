# Secret Network

To use Fadroma Agent with SecretJS, you need the `@fadroma/scrt` package.
This package implements the core Fadroma Agent API with SecretJS.
It also exposes SN-specifics, such as a `Snip20` token client
and a `ViewingKeyClient`.

* Like `@fadroma/agent`, this package aims to be *isomorphic*:
  one of its design goals is to be usable in Node and browsers without modification.

* `@hackbg/fadroma` automatically has this package through `@fadroma/connect`

```typescript
import { Scrt } from '@fadroma/connect'
import { Devnet } from '@hackbg/fadroma'
import assert from 'node:assert'
```

## Configuring

Several options are exposed as environment variables.

```typescript
const config = new Scrt.Config()
```

|ScrtConfig property|Env var|Description|
|-|-|-|
|agentName     |FADROMA_SCRT_AGENT_NAME      |agent name|
|agentMnemonic |FADROMA_SCRT_AGENT_MNEMONIC  |agent mnemonic for scrt only|
|mainnetChainId|FADROMA_SCRT_MAINNET_CHAIN_ID|chain id for mainnet|
|testnetChainId|FADROMA_SCRT_TESTNET_CHAIN_ID|chain id for mainnet|
|mainnetUrl    |FADROMA_SCRT_MAINNET_URL     |mainnet URL|
|testnetUrl    |FADROMA_SCRT_TESTNET_URL     |testnet URL|

## Connecting and authenticating

To connect to Secret Network with Fadroma, use one of the following:

```typescript
const mainnet = Scrt.Chain.mainnet({ url: 'test' })
const testnet = Scrt.Chain.testnet({ url: 'test' })
const devnet  = new Devnet({ platform: 'scrt_1.9' }).getChain(Scrt.Chain)
const mocknet = Scrt.Chain.mocknet({ url: 'test' })
```

This will give you a `Scrt` instance (subclass of `Chain`):

```typescript
import { Chain } from '@fadroma/agent'
for (const chain of [mainnet, testnet]) {
  assert.ok(chain instanceof Chain && chain instanceof Scrt.Chain)
}
```

To interact with Secret Network, you need to authenticate as an `Agent`:

### Fresh wallet

This gives you a randomly generated mnemonic.

```typescript
const agent0 = await mainnet.getAgent().ready
assert.ok(agent0 instanceof Scrt.Agent)
assert.ok(agent0.chain instanceof Scrt.Chain)
assert.ok(agent0.mnemonic)
assert.ok(agent0.address)
```

The `mnemonic` property of `Agent` will be hidden to prevent leakage.

### By mnemonic

```typescript
const mnemonic = 'define abandon palace resource estate elevator relief stock order pool knock myth brush element immense task rapid habit angry tiny foil prosper water news'
const agent1 = await mainnet.getAgent({ mnemonic }).ready

ok(agent1 instanceof Scrt.Agent)
ok(agent1.chain instanceof Scrt.Chain)
ok(agent1.mnemonic)
ok(agent1.address)
```

### Keplr

```typescript
// TODO:
// const agent2 = await mainnet.fromKeplr().ready
// ok(agent2 instanceof Scrt.Agent)
// ok(agent2.chain instanceof Scrt.Chain)
// ok(agent2.mnemonic)
// ok(agent2.address)
```

### secretcli

```typescript
// TODO:
// const agent3 = await mainnet.fromSecretCli()
// ok(agent3 instanceof Scrt.Agent)
// ok(agent3.chain instanceof Scrt.Chain)
// ok(agent3.mnemonic)
// ok(agent3.address)
```

## Querying

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

```typescript
const agent    = agent0
const address  = 'some-addr'
const codeHash = 'some-hash'
```

## Tokens

`@fadroma/scrt` exports a `Snip20` client class with most of the SNIP-20 methods exposed.

```typescript
const token = new Scrt.Snip20({ agent, address, codeHash })
```

There is also a `Snip721` stub client. See [#172](https://github.com/hackbg/fadroma/issues/172)
if you want to contribute a SNIP-721 client implementation:

```typescript
const nft = new Scrt.Snip721({ agent, address, codeHash })
```

## Viewing keys

`@fadroma/scrt` exports the **`ViewingKeyClient`** class.

```typescript
const client = new Scrt.ViewingKeyClient({ agent, address, codeHash })
```

This is meant for embedding into your own `Client` classes
for contracts that implement the SNIP20-compatible viewing key API.

```typescript
class MyClient extends Client {
  get vk () { return new Scrt.ViewingKeyClient(this) }
}
```

Each `Snip20` instance already has a `vk` property that is a `ViewingKeyClient`.

```typescript
assert(token.vk instanceof Scrt.ViewingKeyClient)
```

This is an example of composing client APIs by ownership rather than inheritance,
as shown above.

## Query permits

```typescript
// TODO add docs
```

---

```typescript
import { ok } from 'node:assert'
import { Client } from '@fadroma/agent'
import './Scrt.test.ts'
```
