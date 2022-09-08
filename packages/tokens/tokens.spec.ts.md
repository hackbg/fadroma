# Fadroma Tokens

```typescript
import { ok } from 'assert'
import {
  nativeToken, customToken,
  isNativeToken, isCustomToken,
  TokenAmount, TokenPair, TokenPairAmount,
  TokenRegistry,
  Snip20, createPermitMsg,
  TokenError,
} from './tokens'
ok(isNativeToken(nativeToken('scrt')))
ok(!isCustomToken(nativeToken('scrt')))
ok(isCustomToken(customToken('addr', 'hash')))
ok(!isNativeToken(customToken('addr', 'hash')))
new TokenAmount()
new TokenPair()
new TokenPairAmount()
new TokenRegistry()
new Snip20()
new TokenError()
createPermitMsg()
```
