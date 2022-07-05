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

## JS package setup

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

## TS package setup

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

## JS client class

:::warning We miss ES5 and CommonJS, too.
However, this example assumes an environment with native support for ES Modules,
the `class` keyword, and `async`/`await`.

If you need to target older environments, the
transpilation setup is up to you.
:::

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

## TS client class

For TypeScript, it's not much different, except that the `@fadroma/client`
library also exports type aliases corresponding to the types used by the
contract. They mostly resolve to either `number` or `string`, so the type
checker won't be much help, but at least you'll get type suggestions if
you use IntelliSense.

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

## Using client classes

`@fadroma/client` is a simple library, because the programming model of CosmWasm
is supremely simple. Under the hood, however, there are some complexities that
Fadroma handles for you.

The main example of this is Secret Network changing their API serialization,
from a JSON-based format called Amino, to gRPC. That's why you never use `@fadroma/client`
alone - you use it with conjunction with one of the `@fadroma/client-*` libraries that
knows exactly how to serialize and sign the messages that you pass to `this.query` and
`this.execute`.

These specifics are implemented in the `Agent` classes. You can get an `Agent`
by passing an identity to the `getAgent` method of an instance of a `Chain` class.
Here's an example for Secret Network:

```typescript
// MyWebApp.ts
import { MyContract } from 'my-client-library'
import { Scrt } from '@fadroma/client-scrt-grpc'

async function main () {
  const chain    = new Scrt()
  const agent    = await chain.getAgent({ keyPair: ... })
  const contract = agent.getClient(MyContract, "secret1...")
  const result   = await myContract.tx4(await myContract.q4("123"))
  return result
}
```
