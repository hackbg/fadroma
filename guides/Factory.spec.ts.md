# A Fadroma Pattern: Factory

## Introduction

This is a common pattern that uses simple ICC (inter-contract communication) to let end users
instantiate contracts in a semi-controlled way: the "factory" contract determines the code of
the contract to instantiate, and callers can specify init parameters for the individual
"product" contract instances that they request from the factory. This factory also keeps track
of all contracts instantiated through it, and can be queried to provide a paginated list.

In the following example, there are two contracts involved, `Factory` and `Product`.
(For their code, see the [`factory`](https://github.com/hackbg/fadroma/tree/master/examples/factory),
[`factory-product`](https://github.com/hackbg/fadroma/tree/master/examples/factory-product),
and [`factory-shared`](https://github.com/hackbg/fadroma/tree/master/examples/factory-shared) crates
in the [`examples/` directory of the Fadroma repo](https://github.com/hackbg/fadroma/tree/master/examples))

The control flow goes something like this:

* Build and upload Factory and Product.
* Instantiate a Factory, providing it with code id and code hash for Product.
* User requests from the Factory to create a Product.
* Factory instantiates a Product.
* The Product calls back to factory to register itself.
* That way, the Factory keeps track of all Products created through it.

## Defining a Deployment subclass

Here's how this pattern can be described as a `Deployment` in your project's `api.ts` or similar.

```typescript
// api.ts

import { Deployment, Client } from '@fadroma/agent'

export default class FactoryDeployment extends Deployment {

  // There will be an unlimited number of `Product` contracts
  // instantiated by the `Factory`. Let's use `this.template`
  // to define the initial source code and final client class
  // for each one of them:
  product = this.template({
    workspace: '.',
    crate: 'examples/factory-product',
    client: Product
  })

  // The `Factory`, on the other hand, is a single contract instance.
  // So, let's use `this.contract` to provide its name and init message:
  factory = this.contract({
    workspace: '.',
    name: 'factory',
    crate: 'examples/factory',
    client: Factory,
    initMsg: async () => ({
      // This `Factory` takes one configuration parameter, `code`,
      // which contains the code id and code hash needed to
      // instantiate `Product`s.
      //
      // Using `await this.product.uploaded` here makes sure that
      // instantiating a Factory will automatically upload the
      // `Product` template if it's not uploaded yet.
      //
      // The `asContractCode` getter converts a `Template` into
      // the `ContractCode { id, code_hash }` struct that the
      // `Factory` expects.
      code: (await this.product.uploaded).asContractCode
    })
  })

  // Defining custom methods directly on the `Deployment`
  // lets you interact with the deployed multi-contract system
  // as a coherent whole.
  //
  // Here, `contract.expect()` makes the method call fail
  // if the `Factory` is not already instantiated. Otherwise,
  // it will return an instance of the `client` class specified
  // in the definition above.
  //
  // Having made sure that there is a contract to call, the
  // `factory.client` method is called. (This is defined on the
  // `Factory` client class below.)
  create = (name: string) =>
    this.factory.expect().create(name)

  // Finally, here's a getter which fetches the list of `Product`
  // instances that have been created so far.
  // Once again, we `expect` the factory to already exist,
  // and call the `factory.list` method (defined below).
  // We return all other info from the response unchanged,
  // only convert the array of plain `{ address, code_hash }`
  // structs returned by the contract into an array of
  // ready-to-use `Product` clients bound to `deployment.agent`
  getProducts = () =>
    this.factory.expect().list().then(({entries, ...rest})=>({
      ...rest,
      entries: entries.map(({address,code_hash})=>this.agent.getClient(
        Product, address, code_hash
      ))
    }))

}

// A `Client` class can be used to compose the actual JSON messages
// that are passed to the contract. You can also add metadata,
// validation, etc.
class Factory extends Client {

  create = (name: string) =>
    this.execute({ create: { name } })

  list = (pagination = { start: 0, limit: 100 }) =>
    this.query({ list: { pagination } })

}

// An empty `Client` class is just a marker
// for what kind of contract it connects to.
class Product extends Client {

  // In practice, you would have your `Product`'s methods here -
  // for example, if your `Factory` instantiates AMM pools,
  // you could define add things like `swap` or `addLiquidity`.

}
```

## Integration testing

Here's how you would deploy and test the system described above,
using Fadroma's Mocknet and Devnet features to avoid cluttering the
public testnet with intermediate iterations.

The Mocknet uses JavaScript's built-in WebAssembly runtime
and a quick and dirty simulation of a CosmWasm environment, while
the Devnet launches a temporary `localsecret`-based container to
test your contracts on the real thing.

```typescript
// tes.ts

// import { FactoryDeployment } from './api.ts'

import { Chain, getDeployment } from '@hackbg/fadroma'
import * as Scrt from '@fadroma/scrt'
import assert from 'node:assert'

const chains = [
  Chain.variants['Mocknet'](),
  Chain.variants['ScrtDevnet'](),
]

for (const chain of chains) {

  // Get a populated instance of `FactoryDeployment`:
  const deployment = getDeployment(FactoryDeployment, {
    // You need to provide an authenticated `Agent`:
    agent: await chain.authenticate({ name: 'Admin' }).ready
  })

  // Deploy all contracts:
  await deployment.deploy()

  // In our case, the above will build+upload+instantiate `Factory`
  // (because it's defined with `deployment.contract`), and it will
  // only build+upload `Product` (because it's defined with
  // `deployment.template`).

  // Smoke check: in the initial state of the deployment,
  // the `products` getter should return zero things:
  assert.deepEqual(
    await deployment.getProducts(),
    { total: 0, entries: [] },
    'factory starts out empty'
  )

  // Let's instantiate a `Product` now:
  await deployment.create('foo')

  // And make sure that the `products` getter converts
  // all returned values to `Product` client instances.
  const products = await deployment.getProducts()
  assert(
    products.entries.every(entry=>entry instanceof Product),
    'factory tracks products; deployment returns them as Product instances'
  )

}
```

## Deploying

From a script, you can use the `deploy` method of your `Deployment` class
to deploy, as shown in the testing section.

In the project structure created by `fadroma create`, your `Deployment`
class is also hooked up via your `Project` class in `ops.ts` to NPM scripts,
allowing you to deploy from the terminal like this:

```sh
npm run mainnet deploy
npm run testnet deploy
npm run devnet deploy
npm run mocknet deploy
```

## Exporting and connecting

After validating a successful deployment to mainnet or testnet,
exporting a list of contracts makes it possible to find and connect to
your deployment from outside the deploy script - e.g. from a dApp frontend,
a backend service, or a third-party script.

You can export JSON snapshots of your deployment using the `fadroma export`
command, or manually by serializing the `deployment.snapshot` property.
By including those snapshots in your project's API client library, you
can allow users to easily connect to your official mainnet and testnet deployments.

Reconstructing a deployment from a snapshot can look like this:

```typescript
// some-downstream.ts

// import FactoryDeployment, { mainnetState, testnetState } from '@some/project'

const mainnetState = {/* ... */} // mock
const testnetState = {/* ... */} // mock

const mainnet = true // process.env.MAINNET, or a toggle in your UI, etc.
const chain = mainnet ? 'ScrtMainnet' : 'ScrtTestnet'
const state = mainnet ? mainnetState : testnetState
const agent = Chain.variants[chain]().authenticate({/* mnemonic: '...' */})
const app = new FactoryDeployment({ ...state, agent })
```

Here's a nice way to simplify that even further, for the users of your API client:
define "connect" entrypoints - either as functions (as show below):

```typescript
// api.ts

// import * as mainnetState from './mainnet-snapshot.json'
// import * as testnetState from './testnet-snapshot.json'

export const connectToFactory = {
  onMainnet: () => (mnemonic: string) => new FactoryDeployment({
    ...mainnetState,
    agent: Chain.variants['ScrtMainnet']().authenticate({ mnemonic })
  }),
  onTestnet: () => (mnemonic: string) => new FactoryDeployment({
    ...testnetState,
    agent: Chain.variants['ScrtTestnet']().authenticate({ mnemonic })
  })
}
```

or as static methods:

```typescript
// api.ts

// import * as mainnetState from './mainnet-snapshot.json'
// import * as testnetState from './testnet-snapshot.json'

export class imagine_this_is_FactoryDeployment {
  // ... the rest of your Deployment class ...
  static mainnet = () => (mnemonic: string) => new FactoryDeployment({
    ...mainnetState,
    agent: Chain.variants['ScrtMainnet'].authenticate({ mnemonic })
  })
  static testnet = () => (mnemonic: string) => new FactoryDeployment({
    ...testnetState,
    agent: Chain.variants['ScrtTestnet'].authenticate({ mnemonic })
  })
  // ... the rest of your Deployment class ...
}
```

Furthermore: you may have noticed that the `FactoryDeployment` definition
uses the arrow syntax to define methods. This allows users of your API
client library to directly destructure a `FactoryDeployment` instance,
and get nice free-standing functions that represent the relevant actions
from your business logic:

```typescript
const { getProducts, createProduct } = connectToFactory.onMainnet(/*'mnemonic'*/)
// await getProducts()
// await createProduct('...')
// et cetera.
```

## Conclusion

This concludes the Fadroma Factory Pattern example, which demonstrates
the main client-side features of Fadroma.

You've just seen how Fadroma can simplify and automate the fiddly
manual task of deploying multiple interconnected smart contracts,
reducing it to simple declarative programming and taking care of
all the steps behind the scenes.

In the future, we hope to expand this functionality to other
Cosmos-compatible chains, and allow deploying contracts across
multiple chains from the same unified definition.

For now, we hope that this abstraction expands your horizons about
all the exciting and novel things that you can build on the distributed
compute backend of the [Secret Network](https://scrt.network).

## See also

* [Fadroma Agent API](./agent.html) reference
* [Fadroma Deploy API](./deploy.html) reference
* [Example factory contract](https://github.com/hackbg/fadroma/tree/master/examples/factory)
* [Example product contract](https://github.com/hackbg/fadroma/tree/master/examples/factory-product)
* [Example factory/product shared interface library](https://github.com/hackbg/fadroma/tree/master/examples/factory-shared)
