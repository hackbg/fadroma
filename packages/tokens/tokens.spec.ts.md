# Fadroma Tokens

```typescript
import { ok, equal, deepEqual, throws } from 'assert'
```

## Token descriptors

```typescript
import {
  TokenKind, getTokenKind, getTokenId, isTokenDescriptor,
  nativeToken, customToken, isNativeToken, isCustomToken,
  TokenAmount,
} from '.'

const native    = nativeToken('scrt')
const native100 = new TokenAmount(native, '100')
ok(isTokenDescriptor(native))
ok(isNativeToken(native))
ok(!isCustomToken(native))
equal(getTokenKind(native), TokenKind.Native)
equal(getTokenId(native), 'native')
equal(custom100.asNativeBalance, undefined)

const custom    = customToken('addr', 'hash')
const custom100 = new TokenAmount(custom, 100)
ok(isTokenDescriptor(custom))
ok(isCustomToken(custom))
ok(!isNativeToken(custom))
equal(getTokenKind(custom), TokenKind.Custom)
equal(getTokenId(custom), 'addr')
throws(()=>getTokenId(customToken()))
deepEqual(native100.asNativeBalance, [{denom: "scrt", amount: "100"}])
```

## Token pair descriptors

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

## Token contract client

```typescript
import { Snip20, createPermitMsg } from '.'

new Snip20()
deepEqual(Snip20.fromDescriptor(null, custom).asDescriptor, custom)

createPermitMsg()
```

## Token manager

```typescript
import { TokenManager, TokenError } from '.'

const registry = new TokenManager()
throws(()=>registry.get())
throws(()=>registry.get('UNKNOWN'))

const token = Symbol()
ok(registry.add('KNOWN', token))
throws(()=>registry.add('KNOWN', token))
ok(registry.has('KNOWN'))
equal(registry.get('KNOWN'), token)
ok(registry.set('KNOWN', null))
throws(()=>registry.get('KNOWN'))
ok(registry.add('KNOWN', token))
equal(registry.get('KNOWN'), token)

new TokenError()
```
