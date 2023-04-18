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

// And the converse: creating Snip20 clients
// from descriptors received over the wire:
ok(
  Snip20.fromDescriptor(null, yourToken.asDescriptor) instanceof Snip20
)

deepEqual(
  Snip20.fromDescriptor(null, yourToken.asDescriptor).asDescriptor,
  descriptor
)
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

