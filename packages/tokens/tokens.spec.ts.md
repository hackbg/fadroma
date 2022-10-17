# Fadroma Tokens

```typescript
import { ok, equal, deepEqual, throws } from 'assert'
```

## Token contract client

```typescript
import { Snip20 } from '@fadroma/tokens'
new Snip20()
```

### Query permits

```typescript
import { createPermitMsg } from '@fadroma/tokens'
createPermitMsg()
```

## Token manager

This object keeps track of token contracts in a deployment,
and can deploy them on demand.

```typescript
import { TokenManager, TokenError } from '@fadroma/tokens'

const registry = new TokenManager({})
throws(()=>registry.get())
throws(()=>registry.get('UNKNOWN'))

const token = {}
ok(registry.add('KNOWN', token))
ok(registry.has('KNOWN'))
equal(registry.get('KNOWN'), token)

new TokenError()

import { Contract, ContractTemplate } from '@fadroma/client'
const registry2 = new TokenManager({
  template: (options) => new Contract(options)
}, new ContractTemplate({
  crate: 'snip20'
}))
```
