# Fadroma Token Manager Specification

```typescript
import assert from 'node:assert'
```

The Token Manager is an object that serves as a registry
of token contracts in a deployment.

```typescript
import { Deployment } from '@fadroma/client'
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

import { ContractSlot, ContractTemplate } from '@fadroma/client'
const manager2 = new TokenManager({
  template: (options) => new ContractSlot(options)
}, new ContractTemplate({
  crate: 'snip20'
}))
```
