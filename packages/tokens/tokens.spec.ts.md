# Fadroma Tokens

## [Token descriptors](./tokens-desc.spec.ts.md)

```typescript
import './tokens-desc.spec.ts.md'
```

```typescript
import { ok, equal, deepEqual, throws } from 'assert'
```

## Token contract client

```typescript
import { Snip20 } from '@fadroma/tokens'

ok(Snip20.init())

const agent = { getHash: async () => 'gotCodeHash' }
const snip20 = new Snip20(agent, 'address', 'codeHash')
const descriptor = { custom_token: { contract_addr: 'address', token_code_hash: 'codeHash' } }
deepEqual(snip20.asDescriptor, descriptor)
deepEqual(Snip20.fromDescriptor(null, descriptor).asDescriptor, descriptor)

const name         = Symbol()
const symbol       = Symbol()
const decimals     = Symbol()
const total_supply = Symbol()
snip20.codeHash = undefined
snip20.agent.query = async () => ({ token_info: { name, symbol, decimals, total_supply } })
await snip20.populate()
equal(snip20.codeHash, 'gotCodeHash')
equal(snip20.tokenName, name)
equal(snip20.symbol, symbol)
equal(snip20.decimals, decimals)
equal(snip20.totalSupply, total_supply)

const amount = Symbol()
snip20.agent.query = async () => ({ balance: { amount } })
equal(
  await snip20.getBalance('address', 'vk'),
  amount
)

snip20.agent.execute = async (x, y) => y
deepEqual(
  await snip20.send('amount', 'recipient', {callback:'test'}),
  { send: { amount: 'amount', recipient: 'recipient', msg: 'eyJjYWxsYmFjayI6InRlc3QifQ==' } }
)
```

### Query permits

```typescript
import { createPermitMsg } from '@fadroma/tokens'
deepEqual(
  JSON.stringify(createPermitMsg('q', 'p')),
  '{"with_permit":{"query":"q","permit":"p"}}'
)
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
