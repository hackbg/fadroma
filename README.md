<div align="center">

```
"I was always willing to be reasonable until I had to be unreasonable.
 Sometimes reasonable men must do unreasonable things."
                                     - Marvin Heemeyer
```

[![](/doc/logo.svg)](https://fadroma.tech)

**Industrial strength components and workflows for smart contract development in Rust.**

Made with [💚](mailto:hello@hack.bg) at [Hack.bg](https://hack.bg).

Help yourselves to the [contribution guidelines](CONTRIBUTING.md).

[![Coverage Status](https://coveralls.io/repos/github/hackbg/fadroma/badge.svg?branch=22.01)](https://coveralls.io/github/hackbg/fadroma?branch=22.01)

</div>

<table>

<tr><td valign="top">

## Fadroma [CLI](./packages/cli) + [Ops](./packages/ops)

**Contract deployment tools for Secret Network.**

> See also:
> * [`@fadroma/scrt`](./packages/scrt)
> * [`@fadroma/scrt-1.0`](./packages/scrt-1.0)
> * [`@fadroma/scrt-1.2`](./packages/scrt-1.2).

Just import `@hackbg/fadroma` to start scripting deployments and migrations.

* The `Contract` and `Client` classes represent smart contracts
  and allow you to write scripts that compile them, deploy them,
  and interact with them.
* The `Deployment` and `Migration` system helps you keep track
  of groups of connected contracts that work together.
* The `Agent`'s `Bundle` mode allows you to run multiple
  transactions simultaneously - including contract instantiations.
* Modular architecture, open to extension for other
  Cosmos-based blockchains.

</td><td>

> See [Fadroma CLI documentation](./packages/cli/README.md#example-deployment-script)
> for the big example.

**This is the format of a deployment script.**
It's a JavaScript or TypeScript module that
lets you define migrations as plain async functions
invoked by name from the command line.

```typescript
// cat.ts
import Fadroma from '@hackbg/fadroma'
Fadroma.command('do something',
  async function meow ({ agent }) {
    // go wild here
  })
export default Fadroma.module(import.meta.url)
```

**This is what you need in `package.json`**
to be able to run the deployment script.

```jsonc
// package.json
{
  "scripts": {
    "cat": "ganesha-node cat.ts"
  },
  "dependencies": {
    "@hackbg/ganesha": "^1",
    "@hackbg/fadroma": "github:hackbg/fadroma"
  }
}
```

If you don't want to type **environment variables** every time:

```sh
# .env
FADROMA_CHAIN=localnet-1.2
```

Then you can run your Fadroma-enabled script with:

```sh
pnpm cat do something    # basic form
pnpm -w cat do something # in workspace
yarn cat do something    # if using Yarn
npm run cat do something # if using NPM
```

</td></tr>

<tr><!--spacer--></tr>

<tr><td>

## Fadroma Ops for [Secret Network](./packages/scrt) (versions [1.0](./packages/scrt-1.0) and [1.2](./packages/scrt-1.2))

</td><td>

```rust
Needs introductory example :)
```

</td></tr>

<tr><!--spacer--></tr>

<tr><td>

## Fadroma Derive

**Attribute macros for writing smart contracts.**

CosmWasm's raw syntax is a little verbose. We wrap all the repetitive bits
into familiar tags such as `#[init]`, `#[handle]` and `#[query]`.

* See [fadroma-derive-contract](./crates/fadroma-derive-contract)

</td><td>

```rust
Needs introductory example :)
```

</td>
</tr>

<tr><!--back to da 90s lol--></tr>

<tr><td>

## Fadroma Composability

**Composable contract traits.**

Replicate the same management functionality across your whole fleet of contracts,
by implementing it as a reusable Rust trait.

* See [fadroma-composability](./crates/fadroma-composability)

</td>
```rust
Needs introductory example :)
```
<td>

</td></tr>

</table>
