# Fadroma Client for Secret Network (gRPC/Protobuf API)

Uses `secretjs@1.x`.

[![](https://img.shields.io/npm/v/@fadroma/scrt-grpc?color=%2365b34c&label=%40fadroma%2Fscrt-grpc&style=for-the-badge)](https://www.npmjs.com/package/@fadroma/scrt-grpc)

## Overriding the SecretJS implementation

By default the static property `ScrtGrpc.SecretJS` points to the SecretJS module from the
dependencies of `@fadroma/scrt` (see [`package.json`](./package.json) for version info.)

```typescript
import { ScrtGrpc } from '@fadroma/scrt-grpc'

const raw = new ScrtGrpc('raw')

assert.equal(raw.SecretJS, ScrtGrpc.SecretJS)
```

To use a different version of SecretJS with `@fadroma/scrt`, install that version in your
package (next to `@fadroma/scrt`) and import it (`import * as SecretJS from 'secretjs'`).

By setting `ScrtGrpc.SecretJS` to a custom implementation, all subsequently created `ScrtGrpc`
instances will use that implementation. You can also override it for a specific `ScrtGrpc`
instance, in order to use multiple versions of the platform client side by side.

```typescript
// import * as SecretJS from 'secretjs'
const SecretJS = {

  SecretNetworkClient: class {
    static async create () { return new this () }
    query = {
      params: {
        params: () => ({param:{value:'{"max_gas":"1","max_bytes":"2"}'}})
      }
    }
  },

  Wallet: class {
    /* mock */
  }

}

const mod = new ScrtGrpc('mod', { SecretJS })

assert.equal(mod.SecretJS, SecretJS)
assert.notEqual(mod.SecretJS, raw.SecretJS)
```

The used `SecretJS` module will provide the `Wallet` and `SecretNetworkClient` classes,
whose instances are provided to `ScrtGrpcAgent` by `ScrtGrpc#getAgent`, so that the agent
can interact with the chain by signing and broadcasting transactions.

```typescript
const agent = await mod.getAgent()

assert.ok(agent.wallet instanceof SecretJS.Wallet)
assert.ok(agent.api    instanceof SecretJS.SecretNetworkClient)
```

## Overriding the signer (`encryptionUtils` f.k.a. `EnigmaUtils`)

In Keplr contexts, you may want to use the signer returned by `window.getEnigmaUtils(chainId)`.
Here's how to pass it into `ScrtGrpcAgent`.

```typescript
import { ScrtGrpcAgent } from '@fadroma/scrt-grpc'

const encryptionUtils = Symbol() // use window.getEnigmaUtils(chainId) to get this
```

* **Preferred:** override from `ScrtGrpc#getAgent`.

```typescript
const agent1 = await raw.getAgent({ encryptionUtils })

assert.equal(agent1.api.encryptionUtils, encryptionUtils)
```

* **Fallback:** override through `ScrtGrpcAgent` constructor.
  You shouldn't need to do this. Just use `ScrtGrpc#getAgent` to pass
  `encryptionUtils` to `new SecretNetworkClient` at construction time
  like the SecretJS API expects.

```typescript
const agent2 = new ScrtGrpcAgent({ api: {}, wallet: {}, encryptionUtils })
assert.equal(agent2.api.encryptionUtils, encryptionUtils)
```

* **Fallback 2:** you can use `Object.assign(agent.api, { encryptionUtils })`
  to bypass TSC warning about accessing a private member and manually override
  the `encryptionUtils` property of the `SecretNetworkClient` instance used
  by your `ScrtGrpcAgent`.

## Fetching the default gas limit from the chain

By default, the `Scrt` class exposes a conservative gas limit of 1 000 000 units.

```typescript
import { Scrt } from '@fadroma/scrt-grpc'

assert.equal(Scrt.defaultFees.send.gas,   1000000)
assert.equal(Scrt.defaultFees.upload.gas, 1000000)
assert.equal(Scrt.defaultFees.init.gas,   1000000)
assert.equal(Scrt.defaultFees.exec.gas,   1000000)
```

When constructing a `ScrtGrpcAgent` using `ScrtGrpc#getAgent`,
Fadroma tries to fetch the block limit from the chain:

```typescript
console.log((await new ScrtGrpc().getAgent()).fees)
```
