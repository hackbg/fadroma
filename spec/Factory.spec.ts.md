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
import { Deployment, Client } from '@fadroma/agent'

export default class FactoryDeployment extends Deployment {

  // Since there is going to be an arbitrary number of Product contracts
  // instantiated by the Factory, here we use `this.template` to define
  // just the initial source code and final client class.
  product = this.template({ crate: 'fadroma-example-factory-product', client: Product })

  // The Factory is a single contract instance, so we use `this.contract`
  // to also specify a name and an init message for it.
  factory = this.contract({
    name: 'factory',
    crate: 'fadroma-example-factory',
    client: Factory,
    initMsg: async () => ({
      // Here the `code` parameter to the Factory's init message is defined
      // as containing the code id and code hash of the uploaded Product template.
      // Using `await this.product.uploaded` here makes sure that,
      // if the template is not uploaded yet, instantiating a Factory will upload it first.
      // The `asInfo` getter converts a `Template` into the `ContractCode { id, code_hash }`
      // struct that the Factory expects.
      code: (await this.product.uploaded).asInfo
    })
  })

  // You can define methods directly on the deployment that call into individual contracts.
  // Here, `contract.expect()` is used to make the method call fail if the contract is not
  // already instantiated.
  create = (name: string) =>
    this.factory.expect().create(name)

  // This getter returns a list of `Product` instances, created from
  // the plain list of `{ address, code_hash }` structs returned by
  // the `factory.list()` method.
  get products () {
    return this.factory.expect().list().then(({entries, ...rest})=>({
      // Return other info unchanged
      ...rest,
      // Convert every `{address, code_hash}` entry into a `Product` instance
      // bound to the current `agent`.
      entries: entries.map(({address,code_hash})=>this.agent.getClient(
        Product, address, code_hash
      ))
    }))
  }

}

// A `Client` class can be used to compose the actual JSON messages passed to the contract.
// You can also put metadata, validation, etc. here
class Factory extends Client {

  create = (name: string) =>
    this.execute({ create: { name } })

  list = (pagination = { start: 0, limit: 100 }) =>
    this.query({ list: { pagination } })

}

// An empty `Client` class is just a marker for what kind of contract that it connects to.
class Product extends Client {

  // In practice, you would have your Product's methods here -
  // for example, if your factory instantiates AMM pools,
  // you would add things like `swap` and `add_liquidity`

}
```

## Testing

And here's how you would test it on mocknet and devnet:

```typescript
// test:

import { Chain, getDeployment } from '@hackbg/fadroma'
import * as Scrt from '@fadroma/scrt'
import assert from 'node:assert'

const chains = [
  Chain.variants['Mocknet'](),
  Chain.variants['ScrtDevnet']({ deleteOnExit: true }),
]

chains.forEach(chain=>{

  const agent = await chain.getAgent({ name: 'Admin' }).ready

  const deployment = getDeployment(FactoryDeployment, { agent })

  await deployment.deploy()

  assert.deepEqual(
    await deployment.products,
    { total: 0, entries: [] },
    'factory starts out empty'
  )

  await deployment.factory.expect().create('foo')

  assert(
    (await deployment.products).entries.every(entry=>entry instanceof Product),
    'the factory records the created contracts; deployment turns them into Producti nstances'
  )

}
```
