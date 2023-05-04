<div align="center">

# Fadroma Scrt

[![](https://img.shields.io/npm/v/@fadroma/scrt?color=%2365b34c&label=%40fadroma%2Fscrt&style=for-the-badge)](https://www.npmjs.com/package/@fadroma/scrt)

Secret Network implementation of Fadroma Agent.

See https://fadroma.tech for more info.

</div>

---

## Connecting to mainnet or testnet

```typescript
import { Scrt } from '@fadroma/scrt'

/// with the default API URL (defined in scrt-config.ts):
const a = await Scrt.Mainnet().getAgent({ mnemonic: '...' })
const b = await Scrt.Testnet().getAgent({ mnemonic: '...' })

// with custom API URL:
const c = await Scrt.Mainnet({ url: '...' }).getAgent({ mnemonic: '...' })
const d = await Scrt.Testnet({ url: '...' }).getAgent({ mnemonic: '...' })

// multiple identities:
const e = Scrt.Mainnet()
const f = await e.getAgent({ mnemonic: '...' })
const g = await e.getAgent({ mnemonic: '...' })

// identity from Keplr:
const h = await e.getAgent({ encryptionUtils: window.getEnigmaUtils(e.chainId) })
```

## Overriding the SecretJS implementation

By default the static property `Scrt.SecretJS` points to the SecretJS module from the
dependencies of `@fadroma/scrt` (see [`package.json`](./package.json) for version info.)

```typescript
const raw = new Scrt('raw')
assert.equal(raw.SecretJS, Scrt.SecretJS)
```

To use a different version of SecretJS with `@fadroma/scrt`, install that version in your
package (next to `@fadroma/scrt`) and import it (`import * as SecretJS from 'secretjs'`).

By setting `Scrt.SecretJS` to a custom implementation, all subsequently created `Scrt`
instances will use that implementation. You can also override it for a specific `Scrt`
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

const mod = new Scrt('mod', { SecretJS })

assert.equal(mod.SecretJS, SecretJS)
assert.notEqual(mod.SecretJS, raw.SecretJS)
```

The used `SecretJS` module will provide the `Wallet` and `SecretNetworkClient` classes,
whose instances are provided to `ScrtAgent` by `Scrt#getAgent`, so that the agent
can interact with the chain by signing and broadcasting transactions.

```typescript
const agent = await mod.getAgent()

assert.ok(agent.wallet instanceof SecretJS.Wallet)
assert.ok(agent.api    instanceof SecretJS.SecretNetworkClient)
```

## Overriding the signer (`encryptionUtils` f.k.a. `EnigmaUtils`)

In Keplr contexts, you may want to use the signer returned by `window.getEnigmaUtils(chainId)`.
Here's how to pass it into `ScrtAgent`.

```typescript
import { ScrtAgent } from '@fadroma/scrt'

const encryptionUtils = Symbol() // use window.getEnigmaUtils(chainId) to get this
```

* **Preferred:** override from `Scrt#getAgent`.

```typescript
const agent1 = await raw.getAgent({ encryptionUtils })

assert.equal(agent1.api.encryptionUtils, encryptionUtils)
```

* **Fallback:** override through `ScrtAgent` constructor.
  You shouldn't need to do this. Just use `Scrt#getAgent` to pass
  `encryptionUtils` to `new SecretNetworkClient` at construction time
  like the SecretJS API expects.

```typescript
const agent2 = new ScrtAgent({ api: {}, wallet: {}, encryptionUtils })
assert.equal(agent2.api.encryptionUtils, encryptionUtils)
```

* **Fallback 2:** you can use `Object.assign(agent.api, { encryptionUtils })`
  to bypass TSC warning about accessing a private member and manually override
  the `encryptionUtils` property of the `SecretNetworkClient` instance used
  by your `ScrtAgent`.

## Fetching the default gas limit from the chain

By default, the `Scrt` class exposes a conservative gas limit of 1 000 000 units.

```typescript
import { Scrt } from '@fadroma/scrt'

assert.equal(Scrt.defaultFees.send.gas,   1000000)
assert.equal(Scrt.defaultFees.upload.gas, 1000000)
assert.equal(Scrt.defaultFees.init.gas,   1000000)
assert.equal(Scrt.defaultFees.exec.gas,   1000000)
```

When constructing a `ScrtAgent` using `Scrt#getAgent`,
Fadroma tries to fetch the block limit from the chain:

```typescript
console.log((await new Scrt().getAgent()).fees)
```
