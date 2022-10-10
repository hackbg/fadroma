# Fadroma Tokens

```typescript
import { ok, equal, deepEqual, throws } from 'assert'
```

## Token contract client

```typescript
import { Snip20, createPermitMsg } from '.'

new Snip20()
deepEqual(Snip20.fromDescriptor(null, custom).asDescriptor, custom)

createPermitMsg()
```

## Token manager

This object keeps track of token contracts in a deployment,
and can deploy them on demand.

```typescript
import { TokenManager, TokenError } from '.'

const registry = new TokenManager({})
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

const registry2 = new TokenManager({
  contract: (options) => new Contract(options)
}, new ContractTemplate({
  crate: 'snip20'
}))
```
