# A Fadroma Pattern: Factory

## Overview

This is a common pattern that uses simple ICC (inter-contract communication) to let users
instantiate contracts in a semi-controlled way.

In the following example, there are two contracts involved, `Factory` and `Product`.
(For their code, see the `factory`, `factory-product` and `factory-shared` crates
in the `examples/` directory of the Fadroma repo.)

The control flow goes something like this:

* Build and upload Factory and Product.
* Instantiate a Factory, providing it with code id and code hash for Product.
* User requests from the Factory to create a Product.
* Factory instantiates a Product.
* The Product calls back to factory to register itself.
* That way, the Factory can list all Products created through it.

## Defining

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
    crate: 'fadroma-example-factory-product',
    client: Product
  })

  // The `Factory`, on the other hand, is a single contract instance.
  // So, let's use `this.contract` to provide its name and init message:
  factory = this.contract({
    name: 'factory',
    crate: 'fadroma-example-factory',
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
  create = (name: string) =>
    // Here, `contract.expect()` makes the method call fail
    // if the `Factory` is not already instantiated. Otherwise,
    // it will return an instance of the `client` class specified
    // in the definition above.
    //
    // Having made sure that there is a contract to call, the
    // `factory.client` method is called. (This is defined on the
    // `Factory` client class below.)
    this.factory.expect().create(name)

  // Finally, here's a getter which fetches the list of `Product`
  // instances that have been created so far.
  get products () {
    // Once again, we `expect` the factory to already exist,
    // and call the `factory.list` method (defined below).
    return this.factory.expect().list().then(({entries, ...rest})=>({
      // Return any other info from the response unchanged...
      ...rest,
      // ...only convert the array of plain `{ address, code_hash }`
      // structs returned by the contract into an array of `Product`
      // instances that are bound to the current `agent`.
      entries: entries.map(({address,code_hash})=>this.agent.getClient(
        Product, address, code_hash
      ))
    }))
  }

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

## Testing

And here's how you would deploy and test it on mocknet and devnet:

```typescript
// tes.ts

// import { FadromaDeployment } from './api.ts'

import { Chain, getDeployment } from '@hackbg/fadroma'
import * as Scrt from '@fadroma/scrt'
import assert from 'node:assert'

const chains = [
  Chain.variants['Mocknet'](),
  Chain.variants['ScrtDevnet']({ deleteOnExit: true }),
]

for (const chain of chains) {

  // Get a populated instance of `FactoryDeployment`:
  const deployment = getDeployment(FactoryDeployment, {
    // You need to provide an authenticated `Agent`:
    agent: await chain.getAgent({ name: 'Admin' }).ready
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
    await deployment.products,
    { total: 0, entries: [] },
    'factory starts out empty'
  )

  // Let's instantiate a `Product` now:
  await deployment.create('foo')

  // And make sure that the `products` getter converts
  // all returned values to `Product` client instances.
  assert(
    (await deployment.products).entries.every(
      entry=>entry instanceof Product
    ),
    'factory tracks created contracts; deployment returns them as Product instances'
  )

}
```

This is how you would use the [Fadroma Agent API](./agent.html)
and [Fadroma Deploy API](./deploy.html) to manage the deployment
and operations of your smart contracts.

## Exporting and connecting

The next step after validating a successful deployment is
to provide access to it downstream, i.e. let a front-end
connect to it so that people can use it as any Web app.

⚠️ This API is a work in progress.

```typescript
// your-frontend.ts

// import FadromaDeployment, { mainnetState, testnetState } from '@your/project'

// const testnet = FadromaDeployment.connect(testnetState, {
//   agent: Chain.variants['ScrtTestnet'].getAgent()
// })

// const mainnet = FadromaDeployment.connect(mainnetState, {
//   agent: Chain.variants['ScrtMainnet'].getAgent()
// })
```
