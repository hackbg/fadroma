# Guide to implementing support in Fadroma for new chains

## Before you begin

To benefit from Fadroma, the blockchain must be roughly OOP-shaped:
"smart contract" is understood as a persistent stateful entity with a
constructor (init procedure) and callable read-only and read-write
transaction methods.

You will also probably need to implement the methods for sending and
querying the native tokens that are used to pay transaction fees.

## Obtaining the source code

```sh
# in your lab directory:
git clone --recursive git@github.com:hackbg/fadroma.git
cd fadroma
```

Note the `--recursive` flag and the SSH clone.

## Should you create a new package?

If the chain you're adding is already accessible through
a supported client library (such as `secretjs` or `@cosmjs/stargate`),
skip this step and continue with the corresponding library package.[^0]

If you want to add support for a chain that uses its own client library,
create a new package in a subdirectory of `connect/`:

```sh
# in the repo root:
mkdir connect/newchain
echo "{}" > connect/newchain/package.json
```

* Add the new connector module as a `peerDependency`.

```json
// in connect/newchain/package.json
{
  "name": "@fadroma/newchain",
  "version": "0.1.0",
  "type": "module",
  "main": "newchain.ts",
  "dependencies": {
    "@fadroma/agent": "..."
  },
  "peerDependencies": {
    "newchainjs": "^1.2.3"
  }
}
```

* Reexport the connector module through `@fadroma/connect`,
  alongside preferred version of the original client library:

```json
// in connect/package.json
{
  "name": "@fadroma/connect",
  "//": "..."
  "dependencies": {
    "//": "...",
    "@fadroma/newchain": "workspace:^0.x",
    "newchainjs": "^1.2.3"
    "//": "..."
  }
}
```

Using `peerDependencies` lets the downstream update the
client library independently of the one that we use
for testing.

```typescript
// in connect/connect.ts:
// ...
export * as NewChain from '@fadroma/newchain'
// ...
```

The reexport means users can either depend on `@fadroma/connect`
for immediate full access to all supported chains, OR they can
depend only on a particular subpackage and not download the
dependencies for any of the others.

[^0]: Whether `@fadroma/eth` would be based on `web3`/`ethers`/`viem`;
whether we would want to support one or more of those; and whether
that would be 1 or 3 connector modules is an open-ended question.

## Implementing the Fadroma Agent API

Having set up your connector package, you should now implement the
`Chain`, `Agent`, and `Batch` classes defined by `@fadroma/agent`:

```typescript
// in connect/newchain/newchain.ts
// (or e.g. connect/cw/cw-newchain.ts if using @cosmjs/stargate)
import { Chain, Agent, Batch, bindChainSupport } from '@fadroma/agent'
```

`Chain` should be a stateless representation for the whole chain
(user would create one instance for each mainnet, testnet, etc.
that they want to connect to during the application run).

```typescript
// in connect/newchain/newchain.ts etc.
class NewChain extends Chain {
  // TODO add example
}
```

`Agent` is a wrapper binding a wallet to an API client.
The `upload` and `instantiate` methods allow contracts to
be created, and `execute` and `query` to transact with them.

```typescript
// in connect/newchain/newchain.ts etc.
class NewAgent extends Agent {
  // TODO add example
}
```

`Batch` may be implemented if client-side transaction batching
is to be supported. This is the basis for exporting things like
multisig transactions to be manually signed and broadcast.

```typescript
// in connect/newchain/newchain.ts etc.
class NewBatch extends Batch {
  // TODO add example
}
```

Finally, use `bindChainSupport` to make sure that
the three implementations are aware of each other.

This line must go after the class definitions:

```typescript
// in connect/newchain/newchain.ts etc.
bindChainSupport(NewChain, NewAgent, NewBatch)
```

And that's it! You can now transact, deploy, and use smart contracts on this chain.

Note that it was not needed to extend `Client`, `Contract`, or `Template` to add
support for contracts on the new chain[^2].

[^2]: That sort of thing might only be necessary in the case of
a chain that implements custom modifications to its CosmWasm compute module.

## Implementing the devnet and build environments

TODO
