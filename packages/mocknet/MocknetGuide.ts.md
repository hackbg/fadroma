# Fast full-stack testing of production builds with Fadroma Mocknet

Testing the production builds of smart contracts, and the associated client classes and deploy
scripts, can be slow and awkward. Testnets are permanent and public; devnets can be temporary, but
transactions are still throttled by the rate at which blocks are processed.

Smart contracts are just WASM programs. They are written with the expectation that they will
be run by the CosmWasm blockchain's WASM runtime (`compute` module), but WASM itself is a
portable, environment-independent format, and Node.js has native support for running WASM modules.

From this, it follows that by providing implementations of the contract-facing CosmWasm API,
we could run the production builds of smart contracts inside a simulated blockchain-like
environment.

Such an environment would not be bound to the distributed consensus mechanisms of a blockchain,
and would thus allow the contracts to be tested more quickly. This is especially useful in CI
environments, where launching a devnet container might not be possible or desirable.

## Enable mocknet

The easiest way to use Mocknet is to set `FADROMA_CHAIN=Mocknet` in your environment, and
run your deploy scripts as usual. They should work just the same - only way faster.

## Example: mocknet-only test command

Continuing our Fadroma Ops example from the previous chapter, let's add a `test` command
which only ever runs on Mocknet.

```typescript
import assert from 'assert'

Fadroma.command('test',
  () => { process.env.FADROMA_CHAIN = 'Mocknet' },
  ...common,
  Fadroma.Deploy.New,
  deployMyContract,
  configureMyContract,
  async function testMyContract (context) {
    assert(await context.myContract.q2(), "some expected value")
  }
)
```

