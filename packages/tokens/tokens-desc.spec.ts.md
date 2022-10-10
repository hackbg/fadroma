# Token descriptors

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
