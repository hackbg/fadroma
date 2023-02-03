# Writing smart contract frontends with Fadroma Client

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
    "@fadroma/core": "^6.1"
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

Here's an example client implementation for the contract from the previous section.

```javascript
// MyContract.js
import { Client } from '@fadroma/core'
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
Remember that there are two mutually incompatible ways of defining methods with
no parameters (`"q1"` vs. `{"q3":{}}`). It's just how the deserialization works
on the Rust end.

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
    "@fadroma/core": "^3"
  },
  "devDependencies": {
    "typescript": "^4.9"
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
import { Client, Uint128 } from '@fadroma/core'
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
`@fadroma/core`, which correspond to the types used by the contract (`Uint128`, `Address`, etc.)

In practice, those type aliases mostly resolve to either `number` or `string`, so the type
checker won't be much help, but at least the caller will get type suggestions
if they use LSP.

## Using client classes

`@fadroma/core` is a simple library, because the programming model of CosmWasm
is supremely simple. Under the hood, however, there are some complexities that
Fadroma handles for you.

The main example of this is Secret Network changing their API serialization,
from a JSON-based format called Amino, to gRPC. That's why you never use `@fadroma/core`
alone - you use it with conjunction with one of the `@fadroma/core-*` libraries that
knows exactly how to serialize and sign the messages that you pass to `this.query` and
`this.execute`.

These specifics are implemented in the **agent classes**. You can get an agent
by passing an identity to the `getAgent` method of an instance of a **chain class**.
Here's an example for Secret Network:

```typescript
// MyWebApp.ts
import { MyContract } from 'my-client-library'
import { Scrt } from '@fadroma/core-scrt-grpc'

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

## The three-tier model

Now we're getting somewhere! There are a few things going on in the above example -
most importantly, it demonstrates the three-tier model of Fadroma Client.

When using a client class, you're broadcasting transactions from a **specific address** on a
**specific chain**, to a a **specific smart contract** on the **same chain**. This is specified
in terms of the following entities:

### `Chain`s

Chain objects correspond to separate execution environments, i.e. **they represent blockchains**.

Chains inherit from the base `Chain` class exported by `@fadroma/core`.

`Scrt` is the **chain class** representing the Secret Network mainnet.

### `Agent`s

Agent objects correspond to identities operating in a specific environment, i.e.
**they represent wallets**.

Agents inherit from the base `Agent` class exported by `@fadroma/core`.

Calling `chain.getAgent({ keyPair })` returns an instance of `ScrtRPCAgent`.
This is the **agent class** that uses `secretjs@beta` to talk to Secret Network API via gRPC
and sign transactions with the `keyPair`.

Of course, you can have multiple authenticated agents with different addresses and keys,
and interact with the chain as different identities from the same script.

### `Client`s

Client objects are interfaces to programs deployed in a specific environment, i.e.
**they represent smart contracts**.

Clients inherit from the base `Client` class exported by `@fadroma/core`.

Calling `agent.getClient(MyContract, address)` returns an instance of `MyContract` that is bound
to the contract at `address`. You can now query and make transactions, and the transactions will
be signed with the agent's key and broadcast from the agent's address.

## Cross-chain portability

In the above example, if we wanted to use the legacy Amino encoding, we'd simply replace

```typescript
import { Scrt } from '@fadroma/core-scrt-grpc'
```

to:

```typescript
import { LegacyScrt as Scrt } from '@fadroma/core-scrt-amino'
```

Then, `secretjs@0.17` would be used in place of `secretjs@beta`. Normally, NPM would not even
allow the same package to depend on two versions of `secretjs` at once - but since this is going
through two different Fadroma packages, there's no problem.

Right now, we only support Secret Network, but cross-chain portability is one of our main
priorities. Adding support for other chains in Fadroma would be as simple as implementing the
corresponding `Chain` and `Agent` subclasses in e.g. `@fadroma/core-cw-1-0`.

## Single-responsibility principle

Furthermore, in the above scenario, no changes to `MyContract` would be required. This is because
`MyContract`'s only responsibility is to generate the API messages corresponding to its methods.

This way, contract authors can implement client classes once, and make them work across
all blockchains supported by the contract.

## Specifying transaction fees

When executing a transaction, a gas limit is specified so that invoking a transaction cannot
consume too much gas. However, each smart contract transaction method performs different
computations, and therefore need a different amount of gas.

You can specify default gas limits for each method by defining the `fees: Record<string, IFee>`
property of your client class:

```typescript
import { Client, Fee } from '@fadroma/core'
export class MyContract extends Client {
  fees = {
    tx1: new Fee('10000', 'uscrt'),
    tx2: new Fee('20000', 'uscrt'),
    tx3: new Fee('30000', 'uscrt'),
    tx4: new Fee('40000', 'uscrt'),
  }
  async tx1 ()  { return await this.execute("tx1") }
  async tx2 (n) { return await this.execute({tx2: n}) }
  async tx3 ()  { return await this.execute({tx3: {}}) }
  async tx4 (n) { return await this.execute({tx4: {my_value: n}}) }
}
```

You can also specify one fee for all transactions. This will replace the
default `exec` fee configured in the agent.

You can override these defaults by using the `withFee(fee: IFee)` method:

```typescript
const result = await client.withFee(new Fee('100000', 'uscrt')).tx1()
```

This method works by returning a new instance of `MyContract` that has
the fee overridden.

## Switching identities

Similarly to `withFee`, the `as` method returns a new instance of your
client class, bound to a different `agent`, thus allowing you to execute
transactions as a different identity.

```typescript
const agent1 = await chain.getAgent(/*...*/)
const agent2 = await chain.getAgent(/*...*/)
const client = agent1.getClient(MyContract, "...")
client.tx1() // signed by agent1
client.as(agent2).tx1() // signed by agent2
```

## Getting contract info

The `async populate()` method fetches the code ID, code hash, and label of the contract.

```typescript
await client.populate()
console.log(
  client.label,
  client.codeId,
  client.codeHash,
  client.address,
)
```
