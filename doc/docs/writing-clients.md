# Writing client classes

Client classes let you invoke the methods of deployed smart contracts
from JavaScript or TypeScript applications, such as your dApp's frontend.

## Where to write client classes

### Option A: Polyglot packages

It might be tempting to add `package.json` and `MyContract.ts` in your contract's
crate directory, resulting in a "hybrid" or "polyglot" module:

* Cargo would see a `Cargo.toml` and consume the directory as a Rust crate
* Node would see a `package.json` and consumes it as a JavaScript package

This is suitable if your project repository consists of multiple smart contracts that aren't
necessarily going to be used together, e.g. a company-wide monorepo or a public repository of
contracts that can be mixed and matched.

If going with that option, make sure to set up `.npmignore` and the `exclude` setting in
`Cargo.toml`, so that you don't publish JS files to Cargo or Rust files to NPM.

### Option B: Client library

However, if your repository corresponds to a single dApp project, consisting of
multiple contracts that will generally be used together, it might be wiser to have a single
API client package containing all client classes for your whole smart contract system.

Either way, the setup is the same; if going with Option A, you'll need to do it
once per contract, and if going with Option B, you'll only do it once.

## Writing a client in JavaScript

The first thing any NPM package needs is a `package.json`.

```json
// package.json
{
  "name": "my-contract-client",
  "type": "module",
  "main": "MyContract.js",
  "dependencies": {
    "@fadroma/client": "^3"
  }
}
```

The main things that you need to know for implementing a client class
are the `query` and `execute` methods:

* You pass them the message as a JS object.
* They serialize it to JSON and pass it to the contract.
* Then, they return a `Promise` of the value returned by the contract.
* If the returned value is an error, the promise will reject (i.e. if you're
  `await`ing the promise chain, an `Error` will be thrown).

```javascript
// MyContract.js
import { Client } from '@fadroma/client'
export class MyContract extends Client {
  async q1  ()  { return await this.query("q1") }
  async q2  (n) { return await this.query({q2: n}) }
  async q3  ()  { return await this.query({q3: {}}) }
  async q4  (n) { return await this.query({q4: {my_value: n}}) }
  async tx1 ()  { return await this.execute("tx1") }
  async tx2 (n) { return await this.execute({tx2: n}) }
  async tx3 ()  { return await this.execute({tx3: {}}) }
  async tx4 (n) { return await this.execute({tx4: {my_value: n}}) }
}
```

:::info We miss ES5 and CommonJS, too.
However, this example assumes an environment with native support for ES Modules,
the `class` keyword, and `async`/`await`.

If you need to target older environments, the
transpilation setup is up to you.
:::

## Writing a client in TypeScript

:::warning Quo vadis, TypeScript?

You might not notice it immediately, but TypeScript is way stranger than you realize.
For example, even though it has native support for the `import` and `export` keywords,
as of version 4.7 its support for ES modules remains barely usable.

There are many small quirks in TypeScript that offset some of the benefits of static typing.
Sadly, there remains no practical alternative for the particular set of tradeoffs that TypeScript
imposes upon the JavaScript ecosystem.
:::

The practical implication of the above warning is that we had to build some extra tools for
seamless development and publishing of TypeScript packages, in order to maintain the widest
environment support and the least amount of hurdles during development.

```json
// package.json
{
  "name": "my-contract-client",
  "type": "module",
  "main": "./dist/cjs/MyContract.js",
  "exports": {
    "ganesha": "./MyContract.ts",
    "require": "./dist/cjs/MyContract.js",
    "default": "./dist/esm/MyContract.js"
  },
  "dependencies": {
    "@fadroma/client": "^3"
  },
  "devDependencies": {
    "typescript": "^4.7"
  }
}
```

```json
// tsconfig.json
```

```json
// tsconfig.esm.json
```

```typescript
// MyContract.ts
import { Client, Uint128 } from '@fadroma/client'
export class MyContract extends Client {
  async q1  ()           { return await this.query("q1") }
  async q2  (n: Uint128) { return await this.query({q2: n}) }
  async q3  ()           { return await this.query({q3: {}}) }
  async q4  (n: Uint128) { return await this.query({q4: {my_value: n}}) }
  async tx1 ()           { return await this.execute("tx1") }
  async tx2 (n: Uint128) { return await this.execute({tx2: n}) }
  async tx3 ()           { return await this.execute({tx3: {}}) }
  async tx4 (n: Uint128) { return await this.execute({tx4: {my_value: n}}) }
}
```

As you can see, the TypeScript client class implementation is not much different,
except that you're also encouraged to use the type aliases exported by
`@fadroma/client`, which correspond to the types used by the contract.

They mostly resolve to either `number` or `string`, so the type
checker won't be much help, but at least you'll get type suggestions if
you use IntelliSense.

## Using client classes

`@fadroma/client` is a simple library, because the programming model of CosmWasm
is supremely simple. Under the hood, however, there are some complexities that
Fadroma handles for you.

The main example of this is Secret Network changing their API serialization,
from a JSON-based format called Amino, to gRPC. That's why you never use `@fadroma/client`
alone - you use it with conjunction with one of the `@fadroma/client-*` libraries that
knows exactly how to serialize and sign the messages that you pass to `this.query` and
`this.execute`.

These specifics are implemented in the **agent classes**. You can get an agent
by passing an identity to the `getAgent` method of an instance of a **chain class**.
Here's an example for Secret Network:

```typescript
// MyWebApp.ts
import { MyContract } from 'my-client-library'
import { Scrt } from '@fadroma/client-scrt-grpc'

async function main () {
  const chain    = new Scrt()
  const keyPair  = "???"
  const agent    = await chain.getAgent({ keyPair })
  const address  = "secret1..."
  const contract = agent.getClient(MyContract, address)
  const result   = await myContract.tx4(await myContract.q4("123"))
  return result
}
```

There are a few things going on here:

### Chain class

`Scrt` is the **chain class** representing the Secret Network mainnet.
`Scrt` is a subclass of the `Chain` class which is exported by `@fadroma/client`.

### Agent class

Calling `chain.getAgent({ keyPair })` returns an instance of `ScrtRPCAgent`.
This is the **agent class** that uses `secretjs@beta` to talk to Secret Network API via gRPC
and sign transactions with the `keyPair`.

**The agent class corresponds to a wallet**. You can have multiple authenticated agents with
different addresses and keys, to interact with the chain as different identities from the same
script.

### Client class

Calling `agent.getClient(MyContract, address)` returns an instance of `MyContract` that is bound
to the contract at `address`. You can now query and make transactions, and the transactions will
be signed with the agent's key and broadcast from the agent's address.

### Portability and the single-responsibility principle

If we wanted to use the legacy Amino encoding, we'd simply change `@fadroma/client-scrt-grpc`
to `@fadroma/client-scrt-amino`, and import `LegacyScrt` intead of `Scrt`. The agent would then
use `secretjs@0.17` instead of `secretjs@beta`.

This way we can implement client classes once, and make them work across different blockchains
and versions - the client class' only responsibility is generating the messages.

To support other blockchains in Fadroma, all we need to do is implement corresponding `Chain` and
`Agent` classes in e.g. `@fadroma/client-cw-1-0`; and, as far as the two chains are the same, no
changes to your `Client` class would be required.
