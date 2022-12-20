# Fadroma Tokens

## [Token descriptors](./tokens-desc.spec.ts.md)

```typescript
import './tokens-desc.spec.ts.md'
```

```typescript
import assert from 'node:assert'
```

## Token contract client

```typescript
import './tokens-snip20.spec.ts.md'
```

## Token manager

The token manager keeps track of token contracts
in a deployment, and can deploy them on demand.

```typescript
import './tokens-manager.spec.ts.md'
```
# Token descriptors

```typescript
import { ok, equal, deepEqual, throws } from 'assert'
```

```typescript
import {
  TokenKind, getTokenKind, getTokenId, isTokenDescriptor,
  nativeToken, customToken, isNativeToken, isCustomToken,
  TokenAmount,
} from '.'
```

* **Native tokens** are supported natively by the underlying chain.

```typescript
const native    = nativeToken('scrt')
const native100 = new TokenAmount(native, '100')
ok(isTokenDescriptor(native))
ok(isNativeToken(native))
ok(!isCustomToken(native))
equal(getTokenKind(native), TokenKind.Native)
equal(getTokenId(native), 'native')
deepEqual(native100.asNativeBalance, [{denom: "scrt", amount: "100"}])
```

* **Custom tokens** are implemented as a contract on top of the chain's compute module.

```typescript
const custom    = customToken('addr', 'hash')
const custom100 = new TokenAmount(custom, 100)
ok(isTokenDescriptor(custom))
ok(isCustomToken(custom))
ok(!isNativeToken(custom))
equal(getTokenKind(custom), TokenKind.Custom)
equal(getTokenId(custom), 'addr')
throws(()=>getTokenId(customToken()))
equal(custom100.asNativeBalance, undefined)
```

* **Token pair**s can be defined with or without amounts to describe swaps.

```typescript
import { TokenPair, TokenPairAmount } from '.'

deepEqual(
  new TokenPair(native, custom).reverse,
  new TokenPair(custom, native)
)

deepEqual(
  new TokenPairAmount(new TokenPair(native, custom), "100", "200").reverse,
  new TokenPairAmount(new TokenPair(custom, native), "200", "100")
)

new TokenPairAmount(new TokenPair(native, custom), "100", "200").asNativeBalance
new TokenPairAmount(new TokenPair(custom, native), "100", "200").asNativeBalance
new TokenPairAmount(new TokenPair(native, native), "100", "200").asNativeBalance
```
# Fadroma Token Manager Specification

```typescript
import assert from 'node:assert'
```

The Token Manager is an object that serves as a registry
of token contracts in a deployment.

```typescript
import { Deployment } from '@fadroma/core'
import { TokenManager, TokenPair, TokenError } from '@fadroma/tokens'

const context: Deployment = new Deployment({
  name: 'test',
  state: {}
  agent: {
    address: 'agent-address',
    getHash: async () => 'gotCodeHash'
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

import { ContractSlot, ContractTemplate } from '@fadroma/core'
const manager2 = new TokenManager({
  template: (options) => new ContractSlot(options)
}, new ContractTemplate({
  crate: 'snip20'
}))
```
## Token contract client

```typescript
import assert from 'node:assert'

import { Snip20 } from '@fadroma/tokens'

assert.ok(Snip20.init())

const agent = { address: 'agent-address', getHash: async () => 'gotCodeHash' }
const snip20 = new Snip20(agent, 'address', 'codeHash')
const descriptor = { custom_token: { contract_addr: 'address', token_code_hash: 'codeHash' } }
assert.deepEqual(snip20.asDescriptor, descriptor)
assert.deepEqual(Snip20.fromDescriptor(null, descriptor).asDescriptor, descriptor)

const name         = Symbol()
const symbol       = Symbol()
const decimals     = Symbol()
const total_supply = Symbol()
snip20.codeHash = undefined
snip20.agent.query = async () => ({ token_info: { name, symbol, decimals, total_supply } })
await snip20.populate()
assert.equal(snip20.codeHash, 'gotCodeHash')
assert.equal(snip20.tokenName, name)
assert.equal(snip20.symbol, symbol)
assert.equal(snip20.decimals, decimals)
assert.equal(snip20.totalSupply, total_supply)

const amount = Symbol()
snip20.agent.query = async () => ({ balance: { amount } })
assert.equal(
  await snip20.getBalance('address', 'vk'),
  amount
)

snip20.agent.execute = async (x, y) => y
assert.deepEqual(
  await snip20.send('amount', 'recipient', {callback:'test'}),
  { send: { amount: 'amount', recipient: 'recipient', msg: 'eyJjYWxsYmFjayI6InRlc3QifQ==' } }
)
```

### Query permits

```typescript
import { createPermitMsg } from '@fadroma/tokens'
assert.deepEqual(
  JSON.stringify(createPermitMsg('q', 'p')),
  '{"with_permit":{"query":"q","permit":"p"}}'
)
```
