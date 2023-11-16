<div align="center">

# Fadroma Agent for Secret Network

[![](https://img.shields.io/npm/v/@fadroma/scrt?color=%2365b34c&label=%40fadroma%2Fscrt&style=for-the-badge)](https://www.npmjs.com/package/@fadroma/scrt)

This package lets you use Fadroma Agent on Secret Network using
the SecretJS client library.

See https://fadroma.tech for more info.

</div>

---

## Connecting to mainnet or testnet

```typescript
import { Scrt } from '@fadroma/scrt'

/// with the default API URL (defined in scrt-config.ts):
const a = await Scrt.Mainnet().authenticate({ mnemonic: '...' })
const b = await Scrt.Testnet().authenticate({ mnemonic: '...' })

// with custom API URL:
const c = await Scrt.Mainnet({ url: '...' }).authenticate({ mnemonic: '...' })
const d = await Scrt.Testnet({ url: '...' }).authenticate({ mnemonic: '...' })

// multiple identities:
const e = Scrt.Mainnet()
const f = await e.authenticate({ mnemonic: '...' })
const g = await e.authenticate({ mnemonic: '...' })

// identity from Keplr:
const h = await e.authenticate({ encryptionUtils: window.getEnigmaUtils(e.chainId) })
```

## Overriding the SecretJS implementation

By default the static property `Scrt.SecretJS` points to the SecretJS module from the
dependencies of `@fadroma/scrt` (see [`package.json`](./package.json) for version info.)

```typescript
const raw = new Scrt('raw')
assert.equal(raw.SecretJS, Scrt.SecretJS)
```

To use a different version of SecretJS with `@fadroma/scrt`, install that version in your
package (next to `@fadroma/scrt`) and import it (`import * as SecretJS from 'secretjs'`).

By setting `Scrt.SecretJS` to a custom implementation, all subsequently created `Scrt`
instances will use that implementation. You can also override it for a specific `Scrt`
instance, in order to use multiple versions of the platform client side by side.

```typescript
// import * as SecretJS from 'secretjs'
const SecretJS = {

  SecretNetworkClient: class {
    static async create () { return new this () }
    query = {
      params: {
        params: () => ({param:{value:'{"max_gas":"1","max_bytes":"2"}'}})
      }
    }
  },

  Wallet: class {
    /* mock */
  }

}

const mod = new Scrt('mod', { SecretJS })

assert.equal(mod.SecretJS, SecretJS)
assert.notEqual(mod.SecretJS, raw.SecretJS)
```

The used `SecretJS` module will provide the `Wallet` and `SecretNetworkClient` classes,
whose instances are provided to `ScrtAgent` by `Scrt#authenticate`, so that the agent
can interact with the chain by signing and broadcasting transactions.

```typescript
const agent = await mod.authenticate()

assert.ok(agent.wallet instanceof SecretJS.Wallet)
assert.ok(agent.api    instanceof SecretJS.SecretNetworkClient)
```

## Overriding the signer (`encryptionUtils` f.k.a. `EnigmaUtils`)

In Keplr contexts, you may want to use the signer returned by `window.getEnigmaUtils(chainId)`.
Here's how to pass it into `ScrtAgent`.

```typescript
import { ScrtAgent } from '@fadroma/scrt'

const encryptionUtils = Symbol() // use window.getEnigmaUtils(chainId) to get this
```

* **Preferred:** override from `Scrt#authenticate`.

```typescript
const agent1 = await raw.authenticate({ encryptionUtils })

assert.equal(agent1.api.encryptionUtils, encryptionUtils)
```

* **Fallback:** override through `ScrtAgent` constructor.
  You shouldn't need to do this. Just use `Scrt#authenticate` to pass
  `encryptionUtils` to `new SecretNetworkClient` at construction time
  like the SecretJS API expects.

```typescript
const agent2 = new ScrtAgent({ api: {}, wallet: {}, encryptionUtils })
assert.equal(agent2.api.encryptionUtils, encryptionUtils)
```

* **Fallback 2:** you can use `Object.assign(agent.api, { encryptionUtils })`
  to bypass TSC warning about accessing a private member and manually override
  the `encryptionUtils` property of the `SecretNetworkClient` instance used
  by your `ScrtAgent`.

## Fetching the default gas limit from the chain

By default, the `Scrt` class exposes a conservative gas limit of 1 000 000 units.

```typescript
import { Scrt } from '@fadroma/scrt'

assert.equal(Scrt.defaultFees.send.gas,   1000000)
assert.equal(Scrt.defaultFees.upload.gas, 1000000)
assert.equal(Scrt.defaultFees.init.gas,   1000000)
assert.equal(Scrt.defaultFees.exec.gas,   1000000)
```

When constructing a `ScrtAgent` using `Scrt#authenticate`,
Fadroma tries to fetch the block limit from the chain:

```typescript
console.log((await new Scrt().authenticate()).fees)
```

---

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
const agent0 = await mainnet.authenticate().ready
assert.ok(agent0 instanceof Scrt.Agent)
assert.ok(agent0.chain instanceof Scrt.Chain)
assert.ok(agent0.mnemonic)
assert.ok(agent0.address)
```

The `mnemonic` property of `Agent` will be hidden to prevent leakage.

### By mnemonic

```typescript
const mnemonic = 'define abandon palace resource estate elevator relief stock order pool knock myth brush element immense task rapid habit angry tiny foil prosper water news'
const agent1 = await mainnet.authenticate({ mnemonic }).ready

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
FIXME: compare client implementation with actual snip20 spec

---

# Using Fadroma with blockchain tokens

Tokens are one core primitive of smart contract-based systems.
Fadroma provides several APIs for interfacing with tokens.

## Token descriptors

In the CosmWasm ecosystem, there's a distinction between **native** and **custom** tokens.

* A **native token** is implemented by the chain's `bank` module.
  Usually, you can pay gas fees with it.
* A **custom token** is implemented by a smart contract on the chain's `compute` module,
  and can do more things than the native token. The core specification for custom tokens on
  Secret Network is called [SNIP-20](https://docs.scrt.network/secret-network-documentation/development/snips/snip-20-spec-private-fungible-tokens).

```typescript
import type {

  Token,             // NativeToken|CustomToken
  NativeToken        // { native_token: { denom } }
  CustomToken        // { custom_token: { contract_addr, token_code_hash? } }

} from '@fadroma/tokens'
```

`@fadroma/tokens` represents references to tokens as plain serializable objects.
These are useful when you want to pass info about a token from TypeScript to a contract
(where parsing is stricter). You can create them like this:

```typescript
import {

  TokenKind,         // Enumeration with two members, Custom and Native.
  nativeToken,       // Create a token descriptor specifying a native token
  customToken,       // Create a token descriptor specifying a custom token

} from '@fadroma/tokens'

const native: Token = nativeToken('scrt')         // Native token: SCRT
const custom: Token = customToken('addr', 'hash') // SNIP-20 custom token: SecretSCRT (SSCRT)
```

And validate them like this:

```typescript
import {

  isTokenDescriptor, // isNativeToken|isCustomToken
  isNativeToken,     // True iff native token
  isCustomToken,     // True iff custom token

} from '@fadroma/tokens'

ok(isTokenDescriptor(native))
ok(isTokenDescriptor(custom))

ok(isNativeToken(native) && !isCustomToken(native))
ok(isCustomToken(custom) && !isNativeToken(custom))
```

And read their properties like this:

```typescript
import {

  getTokenKind,      // Return the kind of the token.
  getTokenId,        // Return either the native token's name or the custom token's address

} from '@fadroma/tokens'

equal(getTokenKind(native), TokenKind.Native)
equal(getTokenKind(custom), TokenKind.Custom)

equal(getTokenId(native), 'native')
equal(getTokenId(custom), 'addr')
throws(()=>getTokenId(customToken()))
```

### Token amount descriptors

To specify an integer amount of a token, use `TokenAmount`.

* **NOTE:** Token amounts are always integers to avoid errors with precision,
  so you need to add the appropriate amount of decimals.

```typescript
import {

  TokenAmount, // An object representing an integer amount of a native or custom token

} from '@fadroma/tokens'

const native100 = new TokenAmount(native, '100') // 100 uSCRT
const custom100 = new TokenAmount(custom, '100') // 100 uSSCRT
deepEqual(native100.asNativeBalance, [{denom: "scrt", amount: "100"}])
throws(()=>custom100.asNativeBalance)
```

### Token pair descriptors

To describe a pair of tokens that can be exchanged against each other,
you can use `TokenPair`.

Token pairs have the `reverse` property which returns a
new token pair with the places of the tow tokens swapped.

```typescript
import {

  TokenPair,      // A pair of tokens

} from '@fadroma/tokens'

deepEqual(
  new TokenPair(native, custom).reverse,
  new TokenPair(custom, native)
)
```

Respectively, `TokenPairAmount` establishes
an equivalence in value, e.g. `100 TOKENA = 200 TOKENB`.

```typescript
import {

  TokenPairAmount // A pair of tokens with specified amounts

} from '@fadroma/tokens'

deepEqual(
  new TokenPairAmount(new TokenPair(native, custom), "100", "200").reverse,
  new TokenPairAmount(new TokenPair(custom, native), "200", "100")
)

new TokenPairAmount(new TokenPair(native, custom), "100", "200").asNativeBalance
new TokenPairAmount(new TokenPair(custom, native), "100", "200").asNativeBalance

throws(()=>new TokenPairAmount(new TokenPair(native, native), "100", "200").asNativeBalance)
```

## Token contract client

To interact with a SNIP-20 token from TypeScript, you can use the `Snip20` client class.

```typescript
import {

  Snip20 // The Client class for SNIP-20 tokens

} from '@fadroma/tokens'

import * as some from './mocks'
// Let's mock out the info returned from the backend

// Create a client to a token contract
const yourToken = new Snip20(some.agent, some.address, some.codeHash)

// A Snip20 instance can be converted into a descriptor,
// in order to pass info about that contract to some other contract or JSON API.
deepEqual(yourToken.asDescriptor, {
  custom_token: {
    contract_addr:   some.address,
    token_code_hash: some.codeHash
  }
})
```

### Populating token metadata

A token's address uniquely identifies it (for the given chain, of course).
However, to interact with a token on the chain, as a minimum you also need
its code hash; and `Snip20` client instances also keep track of other token metadata,
such as decimals.

Those metadata fields start out as empty, and you can fetch their values
by calling `Snip20#populate`:

```typescript
await yourToken.populate()
equal(yourToken.codeHash,    'fetchedCodeHash')
equal(yourToken.tokenName,   name)
equal(yourToken.symbol,      symbol)
equal(yourToken.decimals,    decimals)
equal(yourToken.totalSupply, total_supply)
```

### Querying balance and sending amounts

```typescript
const amount = Symbol()
yourToken.agent.query = async () => ({ balance: { amount } })
yourToken.agent.execute = async (x, y) => y

equal(await yourToken.getBalance('address', 'vk'), amount)

deepEqual(
  await yourToken.send('amount', 'recipient', { callback:'test' }),
  { send: { amount: 'amount', recipient: 'recipient', msg: 'eyJjYWxsYmFjayI6InRlc3QifQ==' } }
)
```

### Deploying tokens

```typescript
// This generates an init message for the standard SNIP-20 implementation
ok(Snip20.init())

// TODO show instantiate
```

### Query permits

Fadroma supports generating [SNIP-24](https://docs.scrt.network/secret-network-documentation/development/snips/snip-24-query-permits-for-snip-20-tokens)
query permits.

```typescript
import {

  createPermitMsg // Create a permit message

} from '@fadroma/tokens'

assert.deepEqual(
  JSON.stringify(createPermitMsg('q', 'p')),
  '{"with_permit":{"query":"q","permit":"p"}}'
)
```

## Token manager

The Token Manager is an object that serves as a registry
of token contracts in a deployment. It keeps track of tokens,
and allows you to specify the cases where a contract in your project
depends on a custom token.

When working on devnet, Fadroma can deploy mocks of third-party tokens.

```typescript
import { Deployment } from '@fadroma/agent'
import { TokenManager, TokenPair, TokenError } from '@fadroma/tokens'

const context: Deployment = new Deployment({
  name: 'test',
  state: {}
  agent: {
    address: 'agent-address',
    getHash: async () => 'Hash'
  },
})

const manager = new TokenManager(context)

assert.throws(()=>manager.get())
assert.throws(()=>manager.get('UNKNOWN'))

const token = { address: 'a1', codeHash: 'c2' }
assert.ok(manager.add('KNOWN', token))
assert.ok(manager.has('KNOWN'))
assert.equal(manager.get('KNOWN').address,  token.address)
assert.equal(manager.get('KNOWN').codeHash, token.codeHash)

assert.ok(manager.define('DEPLOY', { address: 'a2', codeHash: 'c2' }))
assert.ok(manager.pair('DEPLOY-KNOWN') instanceof TokenPair)

new TokenError()

import { ContractSlot, Template } from '@fadroma/agent'
const manager2 = new TokenManager({
  template: (options) => new ContractSlot(options)
}, new Template({
  crate: 'snip20'
}))
```

```typescript
import { ok, equal, deepEqual, throws } from 'assert'
```

---

# Fadroma Guide: Mocknet

Testing the production builds of smart contracts can be slow and awkward.
Testnets are permanent and public; devnets can be temporary, but transactions
are still throttled by the block rate.

Mocknet is a lightweight functioning mock of a CosmWasm-capable
platform, structured as an implementation of the Fadroma Chain API.
It emulates the APIs that a CosmWasm contract expects to see when
running in production, on top of the JavaScript engine's built-in
WebAssembly runtime.

This way, you can run your real smart contracts without a real blockchain,
and quickly test their user-facing functionality and interoperation
in a customizable environment.

## Table of contents

* [Getting started with mocknet](#getting-started-with-mocknet)
* [Testing contracts on mocknet](#testing-contracts-on-mocknet)
* [Implementation details](#implementation-details)

## Getting started with mocknet

You can interact with a mocknet from TypeScript, the same way you interact with any other chain -
through the Fadroma Client API. 

* More specifically, `Mocknet` is an implementation of the `Chain`
  abstract class which represents connection info for chains.
* **NOTE:** Mocknets are currently not persistent.

```typescript
import { Mocknet } from '@fadroma/agent'
let chain = new Mocknet.Chain()
let agent = await chain.authenticate()

import { Chain, Agent, Mocknet } from '@fadroma/agent'
assert.ok(chain instanceof Chain)
assert.ok(agent instanceof Agent)
assert.ok(agent instanceof Mocknet.Agent)
```

When creating a mocknet, the block height starts at 0.
You can increment it manually to represent the passing of block time.

Native token balances also start at 0. You can give native tokens to agents by
setting the `Mocknet#balances` property:

```typescript
assert.equal(await chain.height, 0)

chain.balances[agent.address] = 1000
assert.equal(await chain.getBalance(agent.address), 1000)

assert.equal(agent.defaultDenom, chain.defaultDenom)
assert.ok(await agent.account)
assert.ok(!await agent.send())
assert.ok(!await agent.sendMany())
```

## Testing contracts on mocknet

Uploading WASM blob will return the expected monotonously incrementing code ID...

```typescript
import { pathToFileURL } from 'url'
import { examples } from './fixtures/Fixtures.ts.md'

assert.equal(chain.lastCodeId, 0)

const uploaded_a = await agent.upload(examples['KV'].data.load(), examples['KV'])
assert.equal(uploaded_a.codeId, 1)
assert.equal(chain.lastCodeId, 1)

const uploaded_b = await agent.upload(examples['Legacy'].data.load(), examples['Legacy'])
assert.equal(uploaded_b.codeId, 2)
assert.equal(chain.lastCodeId, 2)
```

...which you can use to instantiate the contract.

```typescript
const contract_a = uploaded_a.instance({ agent, name: 'kv', initMsg: { fail: false } })
const client_a = await contract_a.deployed

const contract_b = uploaded_b.instance({ agent, name: 'legacy', initMsg: { fail: false } })
const client_b = await contract_b.deployed

assert.deepEqual(
  await client_a.query({get: {key: "foo"}}),
  [null, null] // value returned from the contract
)

assert.ok(await client_a.execute({set: {key: "foo", value: "bar"}}))

const [data, meta] = await client_a.query({get: {key: "foo"} })
assert.equal(data, 'bar')
assert.ok(meta)

await chain.getLabel(client_a.address)
await chain.getHash(client_a.address)
await chain.getCodeId(client_a.codeHash)
```

## Backwards compatibility

Mocknet supports contracts compiled for CosmWasm 0.x or 1.x.

```typescript
assert.equal(chain.contracts[contract_a.address].cwVersion, '1.x')
assert.equal(chain.contracts[contract_b.address].cwVersion, '0.x')
```

## Snapshots

Currently, **Mocknet is not stateful:** it only exists for the duration of the script run.

You can instantiate Mocknet with pre-uploaded contracts:

```typescript
chain = new Mocknet.Chain({
  uploads: {
    1:   new Uint8Array(),
    234: new Uint8Array()
    567: new Uint8Array()
  }
})

assert.equal(chain.lastCodeId, 567)
```
