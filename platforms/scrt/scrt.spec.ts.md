# Fadroma: Secret Network gRPC-specific features

```typescript
import assert from 'node:assert'
import { bip39, bip39EN } from '@hackbg/formati'
const mnemonic = bip39.generateMnemonic(bip39EN)
```

## Overriding the SecretJS implementation

By default the static property `ScrtGrpc.SecretJS` points to the SecretJS module from the
dependencies of `@fadroma/scrt` (see [`package.json`](./package.json) for version info.)

```typescript
import { ScrtGrpc } from '@fadroma/scrt'

const raw = new ScrtGrpc('raw')

assert.equal(
  raw.SecretJS,
  ScrtGrpc.SecretJS
)
```

To use a different version of SecretJS with `@fadroma/scrt`, install that version in your
package (next to `@fadroma/scrt`) and import it (`import * as SecretJS from 'secretjs'`).

```typescript
// import * as SecretJS from 'secretjs'
const SecretJS = {
  SecretNetworkClient: class { static async create () { return new this () } }
  Wallet:              class { /* mock */ }
}
ScrtGrpc.SecretJS = SecretJS
```

By setting `ScrtGrpc.SecretJS` to a custom implementation, all subsequently created `ScrtGrpc`
instances will use that implementation. You can also override it for a specific `ScrtGrpc`
instance, in order to use multiple versions of the platform client side by side.

```typescript

const mod = new ScrtGrpc('mod', { SecretJS })

assert.equal(mod.SecretJS, SecretJS)

assert.notEqual(mod.SecretJS, raw.SecretJS)
```

The used `SecretJS` module will provide the `Wallet` and `SecretNetworkClient` classes,
whose instances are provided to `ScrtGrpcAgent` by `ScrtGrpc#getAgent`, so that the agent
can interact with the chain by signing and broadcasting transactions.

```typescript
const agent = await mod.getAgent({ mnemonic })

assert.ok(agent.wallet instanceof SecretJS.Wallet)

assert.ok(agent.api instanceof SecretJS.SecretNetworkClient)
```

## Overriding the signer (`encryptionUtils` f.k.a. `EnigmaUtils`)

In Keplr contexts, you may want to use the signer returned by `window.getEnigmaUtils(chainId)`.
Here's how to pass it into `ScrtGrpcAgent`.

```typescript
import { ScrtGrpcAgent } from '@fadroma/scrt'

const encryptionUtils = Symbol() // use window.getEnigmaUtils(chainId) to get this
```

* **Preferred:** override from `ScrtGrpc#getAgent`:

```typescript
const agent1 = await raw.getAgent({ mnemonic, encryptionUtils })
assert.equal(agent1.api.encryptionUtils, encryptionUtils)
```

* **Fallback:** override through `ScrtGrpcAgent` constructor.

```typescript
// You shouldn't need to do this. Just use `ScrtGrpc#getAgent` to pass
// `encryptionUtils` to `new SecretNetworkClient` at construction time
// like the SecretJS API normally expects.
const agent2 = new ScrtGrpcAgent({ api: {}, wallet: {}, encryptionUtils })
assert.equal(agent2.api.encryptionUtils, encryptionUtils)
```

* **Fallback 2:** you can use `Object.assign(agent.api, { encryptionUtils })`
  to bypass TSC warning about accessing a private member and manually override
  the `encryptionUtils` property of the `SecretNetworkClient` instance used
  by your `ScrtGrpcAgent`.

```typescript
// not showing you how to do this :D
```
