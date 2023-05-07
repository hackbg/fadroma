# The Fadroma Factory Pattern

Given the code hash and code id of a binary, a `Factory` instantiates
multiple `Product`s, which `reply` to the factory with their `address`es
so that the factory can provide a list of the contracts it has instantiated.

Here's how this pattern can be described as a `Deployment`:

```typescript
import { Deployment, Client } from '@fadroma/agent'

class FactoryDeployment extends Deployment {
  product = this.template({
    crate: 'fadroma-example-factory-product',
    client: Product
  })
  factory = this.contract({
    name: 'factory',
    crate: 'fadroma-example-factory',
    client: Factory,
    initMsg: async () => ({ code: (await this.product.uploaded).asInfo })
  })
  get products () {
    return this.factory.expect().list().then(({entries, ...rest})=>({
      ...rest,
      entries: entries.map(({address,code_hash})=>this.agent.getClient(
        Product, address, code_hash
      ))
    }))
  }
}

class Factory extends Client {
  create = (name: string) => this.execute({ create: { name } })
  list = (pagination = { start: 0, limit: 100 }) => this.query({ list: { pagination } })
}

class Product extends Client {}
```

For the Rust code, see the `factory`, `factory-product` and `factory-shared`
in the `examples/` directory of the Fadroma repo.

Testing this on mocknet and devnet:

```typescript
// test:

import { getDevnet, getDeployment } from '@hackbg/fadroma'
import * as Scrt from '@fadroma/scrt'
import assert from 'node:assert'

const devnet = getDevnet({ ephemeral: true, chainId: 'test-devnet' })

for (const chain of [
  Scrt.Chain.mocknet(),
  Scrt.Chain.devnet({ devnet }),
]) {
  console.log({chain})

  const agent = await chain.getAgent().ready
  console.log({agent})

  const deployment = getDeployment(FactoryDeployment, { agent })
  console.log({deployment})

  await deployment.deploy()

  assert.deepEqual(
    await deployment.products,
    { total: 0, entries: [] },
    'factory starts out empty'
  )

  await deployment.factory.expect().create('foo')

  assert(
    (await deployment.products).entries.every(entry=>entry instanceof Product),
    'factory records created contract and deployment wraps them in Product class'
  )

}
```
