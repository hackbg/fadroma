# Fadroma Tokens

```typescript
import { ok, equal, deepEqual, throws } from 'assert'
import {
  TokenKind, getTokenKind, getTokenId, isTokenDescriptor,
  nativeToken, customToken, isNativeToken, isCustomToken,
  TokenAmount, TokenPair, TokenPairAmount,
  TokenManager,
  Snip20, createPermitMsg,
  TokenError,
} from './tokens'

const native = nativeToken('scrt')
ok(isTokenDescriptor(native))
ok(isNativeToken(native))
ok(!isCustomToken(native))
equal(getTokenKind(native), TokenKind.Native)
equal(getTokenId(native), 'native')

const custom = customToken('addr', 'hash')
ok(isTokenDescriptor(custom))
ok(isCustomToken(custom))
ok(!isNativeToken(custom))
equal(getTokenKind(custom), TokenKind.Custom)
equal(getTokenId(custom), 'addr')
throws(()=>getTokenId(customToken()))

deepEqual(Snip20.fromDescriptor(null, custom).asDescriptor, custom)

new TokenAmount()
equal(
  new TokenAmount(customToken('addr', 'hash'), '100').asNativeBalance, undefined
)
deepEqual(
  new TokenAmount(nativeToken('scrt'), '100').asNativeBalance, [{denom: "scrt", amount: "100"}]
)

new TokenPair()
deepEqual(
  new TokenPair(native, custom).reverse,
  new TokenPair(custom, native)
)

new TokenPairAmount()
deepEqual(
  new TokenPairAmount(new TokenPair(native, custom), "100", "200").reverse,
  new TokenPairAmount(new TokenPair(custom, native), "200", "100")
)
new TokenPairAmount(new TokenPair(native, custom), "100", "200").asNativeBalance
new TokenPairAmount(new TokenPair(custom, native), "100", "200").asNativeBalance
new TokenPairAmount(new TokenPair(native, native), "100", "200").asNativeBalance

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

new Snip20()
new TokenError()
createPermitMsg()
```
