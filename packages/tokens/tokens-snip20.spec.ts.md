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
