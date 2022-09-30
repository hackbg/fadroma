# Fadroma: Secret Network gRPC-specific features

```typescript
import assert from 'node:assert'
import { bip39, bip39EN } from '@hackbg/formati'
const mnemonic = bip39.generateMnemonic(bip39EN)
```

## Overriding the SecretJS implementation

```typescript
import { ScrtGrpc } from '@fadroma/scrt'

const raw = new ScrtGrpc('raw')

assert.equal(
  raw.SecretJS,
  ScrtGrpc.SecretJS
)

const SecretJS = {
  SecretNetworkClient: class { static async create () { return new this () } }
  Wallet:              class { /* mock */ }
}

const mod = new ScrtGrpc('mod', { SecretJS })

assert.equal(
  mod.SecretJS,
  SecretJS
)
assert.ok(
  (await mod.getAgent({ mnemonic })).wallet instanceof SecretJS.Wallet
)
assert.ok(
  (await mod.getAgent({ mnemonic })).api instanceof SecretJS.SecretNetworkClient
)
```

## Overriding the signer (`encryptionUtils` f.k.a. `EnigmaUtils`)

```typescript
import { ScrtGrpcAgent } from '@fadroma/scrt'
const encryptionUtils = Symbol()
```

**Preferred:** override from `ScrtGrpc#getAgent`.

```typescript
const agent1 = await raw.getAgent({ mnemonic, encryptionUtils })
assert.equal(
  agent1.api.encryptionUtils,
  encryptionUtils
)
```

**Fallback:** override through `ScrtGrpcAgent` constructor.
You shouldn't need to do this. Just use getAgent to pass `encryptionUtils` to
`new SecretNetworkClient` at construction time.

```typescript
const api    = { /* getAgent provides this */ }
const wallet = { /* getAgent provides this */ }
const agent2 = new ScrtGrpcAgent({ api, wallet, encryptionUtils })
assert.equal(
  agent2.api.encryptionUtils,
  encryptionUtils
)
```

**Fallback 2:** use Object.assign(agent.api, { encryptionUtils })
to bypass TSC warning about accessing a private member and manually override
the `encryptionUtils`.
