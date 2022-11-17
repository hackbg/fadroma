## Chain

This package provides the abstract base class, `Chain`.

Platform packages extend `Chain` to represent connections to different chains.
  * Since the workflow is request-based, no persistent connection is maintained.
  * The `Chain` object keeps track of the globally unique chain `id` and the connection `url`.
    * **TODO:** Load balancing between multiple chain endpoints.

```typescript
import { Chain } from '@fadroma/core'
let chain: Chain = new Chain('id', { url: 'example.com', mode: 'mainnet' })
assert.equal(chain.id,   'id')
assert.equal(chain.url,  'example.com')
assert.equal(chain.mode, 'mainnet')
```

Chains can be in several `mode`s, enumerated by `ChainMode` a.k.a. `Chain.Mode`:

* **Mocknet** is a fast, nodeless way of executing contract code
  in the local JS WASM runtime.
* **Devnet** uses a real chain node, booted up temporarily in
  a local environment.
* **Testnet** is a persistent remote chain used for testing.
* **Mainnet** is the production chain where value is stored.

```typescript
assert(Chain.mocknet('any').isMocknet)
assert(Chain.devnet('any').isDevnet)
assert(Chain.testnet('any').isTestnet)
assert(Chain.mainnet('any').isMainnet)
```

### Dev mode

The `chain.devMode` flag basically corresponds to whether you
have the ability to reset the whole chain and start over.

  * This is true for mocknet and devnet, but not for testnet or mainnet.
  * This can be used to determine whether to e.g. deploy mocks of
    third-party contracts, or to use their official testnet/mainnet addresses.

```typescript
assert(Chain.mocknet('any').devMode)
assert(Chain.devnet('any').devMode)
assert(!Chain.testnet('any').devMode)
assert(!Chain.mainnet('any').devMode)
```

