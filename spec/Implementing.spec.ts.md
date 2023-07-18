# Guide to implementing support in Fadroma for new chains

## Before you begin

To benefit from Fadroma, the blockchain must be roughly OOP-shaped:
"smart contract" is understood as a persistent stateful entity with a
constructor (init procedure) and callable read-only and read-write
transaction methods.

You will also probably need to implement the methods for sending and
querying the native tokens that are used to pay transaction fees.

## Obtaining the source code

If you want to send us a pull request and do not have commit access
to the Fadroma repo, it's easiest to fork [`hackbg/fadroma` on GitHub](https://github.com/hackbg/fadroma),
replacing `hackbg` with your username in the following command:

```sh
# in your lab directory:
git clone --recursive git@github.com:hackbg/fadroma.git
cd fadroma
```

Note the `--recursive` flag which populates the submodules.

## Should you create a new package?

**If the chain you're adding is already accessible through
a supported client library (such as `secretjs` or `@cosmjs/stargate`),**
skip this step and perform the next one in the existing library package.[^0]

If you want to add support for a chain that uses its own client library,
create a new package in a subdirectory of `connect/`:

```sh
# in the repo root:
mkdir connect/nova
echo "{}" > connect/nova/package.json
```

Add the new connector module as a `peerDependency`.

```json
// in connect/nova/package.json
{
  "name": "@fadroma/nova",
  "version": "0.1.0",
  "type": "module",
  "main": "nova.ts",
  "dependencies": {
    "@fadroma/agent": "..."
  },
  "peerDependencies": {
    "novajs": "^1.2.3"
  }
}
```

Reexport the connector module through `@fadroma/connect`,
alongside preferred version of the original client library:

```json
// in connect/package.json
{
  "name": "@fadroma/connect",
  "//": "..."
  "dependencies": {
    "//": "...",
    "@fadroma/nova": "workspace:^0.x",
    "novajs": "^1.2.3"
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
export * as Nova from '@fadroma/nova'
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
`Chain`, `Agent`, and `Bundle` classes defined by `@fadroma/agent`:

```typescript
// in connect/nova/nova.ts
// (or e.g. connect/cw/cw-nova.ts if using @cosmjs/stargate)
import { Chain, Agent, Bundle, bindChainSupport } from '@fadroma/agent'
```

`Chain` should be a stateless representation for the whole chain
(user would create one instance for each mainnet, testnet, etc.
that they want to connect to during the application run).

```typescript
// in connect/nova/nova.ts etc.
class Nova extends Chain {
  // TODO add example
}
```

`Agent` is a wrapper binding a wallet to an API client.
The `upload` and `instantiate` methods allow contracts to
be created, and `execute` and `query` to transact with them.

```typescript
// in connect/nova/nova.ts etc.
class NewAgent extends Agent {
  // TODO add example
}
```

`Bundle` may be implemented if client-side transaction batching
is to be supported. This is the basis for exporting things like
multisig transactions to be manually signed and broadcast.

```typescript
// in connect/nova/nova.ts etc.
class NewBundle extends Bundle {
  // TODO add example
}
```

Use `bindChainSupport` to make sure that the three implementations
are aware of each other. This line must go after the class definitions:

```typescript
// in connect/nova/nova.ts etc.
bindChainSupport(Nova, NewAgent, NewBundle)
```

Afterwards, export the newly implemented classes
renamed to `Chain`, `Agent` and `Bundle` in the
eyes of the downstream:

```typescript
export { Nova as Chain, NewAgent as Agent, NewBundle as Bunde }
```

And that's it! You can now transact, deploy, and use smart contracts on this chain.

Note that it was not needed to extend `Client`, `Contract`, or `Template` to add
support for contracts on the new chain[^2].

[^2]: That sort of thing might only be necessary in the case of
a chain that implements custom modifications to its CosmWasm compute module.

## Adding support for new chains in Fadroma Devnet

Add `devnets/nova_1.0.Dockerfile`:

```dockerfile
FROM officialbaseimage:v1.0.1@sha256:...
RUN apt update && apt install -y nodejs && npm i -g n && n i 20
ADD devnet.init.mjs /
ENTRYPOINT [ "/usr/bin/node" ]
CMD [ "/devnet.init.mjs" ]
```

Don't forget to pin the `sha256` cheksum to the one you see
so that a malicious registry can't swap it out from under you.

In `fadroma-devnet.ts`, add identifier of new chain type
to the `DevnetPlatform` string union. This should be the
name and version of the chain node software, not a chain id.

You can use this kind of type interpolation to define version ranges[^3]:

```typescript
// in fadroma/devnet.ts
export type DevnetPlatform =
  | `scrt_1.${2|3|4|5|6|7|8|9}`
  | 'okp4_1.0'
  | 'nova_0.1'
```

[^3]: If you're the maniac who will make the TypeScript type system
      parse semver-style version strings, what are you waiting for,
      send us a PR!

Further on in the same file, bind the new devnet identifier you defined above
to `dockerfiles`, `dockerTags` and `readyMessage`.

```typescript
// still in fadroma/devnet.ts
//...
export class Devnet implements DevnetHandle {
  // ...
  static dockerfiles: Record<DevnetPlatform, string> = {
    // ...
    'nova_1.0': $(thisPackage, 'devnets', 'nova_1_0.Dockerfile').path
  }
  static dockerTags: Record<DevnetPlatform, string> = {
    // ...
    'nova_1.0': 'ghcr.io/hackbg/fadroma-devnet-nova-1.2:master',
  }
  static readyMessage: Record<DevnetPlatform, string> = {
    // ...
    'nova_1.0': 'Block validation continues',
  }
}
//...
```

In `fadroma.ts`, add a chain-constructing function to `Chain.variants`
using the environment variable-friendly name of the devnet:

```typescript
// now in fadroma.ts:
import Nova from '@fadroma/nova'
//...
Chain.variants['NovaDevnet'] =
  (options: Partial<Devnet> = { platform: 'nova_1.0' }): Scrt.Chain =>
    new Config().getDevnet(options).getChain(Nova.Chain as ChainClass<Scrt.Chain>)
//...
```

And that's it! Now you can invoke actions on the new devnet with:

```shell
FADROMA_CHAIN=NovaDevnet fadroma deploy
```
