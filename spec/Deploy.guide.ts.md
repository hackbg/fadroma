Cosmos contracts can be seen as essentially equivalent to **persistent objects**:
they encapsulate some data alongside the methods used to operate on that data.
In this model, instantiating a contract is equivalent to constructing an object,
which then continues to exist forever on an append-only ledger of transactions.

The details are slightly more involved, since you need to compile the code and
upload it to the network before you can instantiate and operate it. That's why,
in order to deploy a contract, you must first describe it.

Fadroma provides the `Contract` object for that purpose:

```typescript
import { Contract } from '@fadroma/agent'
const nullContract = deployment.contract()
assert(nullContract instanceof Contract)
```

This gives you an instance of the `Contract` class, representing a specific instance of a
specific contract. The `Contract` class represents the fullest description of a smart contract
in the Fadroma model: besides the usual address and code hash, it may contain info about
contract source, upload and init transactions, etc. (In comparison, `Template` contains metadata
up to right before instantiation, and `Client` does not concern itself with where the contract
came from.)

```typescript
assert.rejects(async () => await nullContract.deployed)
```

### Defining and deploying a contract

Now let's define a contract, assuming an existing [code ID](./core-code.spec.ts.md)
(that is, a contract that is already built and uploaded):

```typescript
const aContract = deployment.contract({
  name: 'contract1',
  initMsg: { parameter: 'value' },
  codeId: 1,
})

assert(aContract instanceof Contract)

const bContract = deployment
  .template({ codeId: 1 })
  .instance({ name: 'contract1', initMsg: { parameter: 'value' } })

assert(bContract instanceof Contract)
```

To deploy the contract uploaded as code ID 1, just call `aContract`, passing two things:
* an **instance ID**. This is the "friendly name" of the contract instance,
  and is used to construct its full unique label.
* an **init message**. This contains the "constructor parameters" that will be passed to the
  contract's init method.

```typescript
const aClient = await aContract.deployed
```

The call will resolve resolve to a `Client` instance. You can use this to talk to the deployed
contract by invoking its query and transaction methods.

```typescript
import { Client } from '@fadroma/agent'
assert.ok(aClient instanceof Client)
assert.equal(aClient.address, '(address #1)')
assert.equal(typeof aClient.query,   'function')
assert.equal(typeof aClient.execute, 'function')
```

Congratulations, you've deployed a globally persistent object!

### Retrieving existing contracts from the `Deployment`

> You can't step in the same river twice
> *-Parmenides*

Since chains are append-only, and contract labels are unique,
it's not possible to deploy a contract more than once, or
deploy another contract with the same label as an existing one.

Enter the `Deployment` object, which keeps track of the contracts that you deploy.

```typescript
import { Deployment } from '@fadroma/agent'
deployment = new Deployment({
  name: 'testing'
  agent,
})
```

Then, you can use `deployment.contract` in place of `new Contract()`:

```typescript
const contractOne = deployment.contract({
  codeId: 1,
  name: 'name',
  initMsg: { parameter: 'value' }
})
```

Deployments add their names to the labels of deployed contracts:

```typescript
const clientToContractOne = await contractOne.deploy()
assert.equal(clientToContractOne.meta.label, 'testing/name')
assert.equal(clientToContractOne.meta.address, '(address #2)')
```

And they also keep track of the deployed contracts, so that later you
can call up the same contract:

```typescript
const anotherClientToContractOne = await contractOne.expect()
assert.equal(clientToContractOne.address, anotherClientToContractOne.address)
```

This creates a new `Client` pointing to the same contract.

### Deploying more contracts; overriding defaults

What if you want to deploy another contract of the same kind?
That's easy, just provide a different name, as in the following example;

```typescript
const template = await deployment.template({ codeId: 2 })
const templateClientOne = await template.instance({ name: 'template-instance-1', initMsg: {} })
const templateClientTwo = await template.instance({ name: 'template-instance-2', initMsg: {} })
assert.equal(templateClientOne.address,    '(address #3)')
assert.equal(templateClientTwo.address,    '(address #4)')
assert.equal(templateClientOne.meta.label, 'testing/template-instance-1')
assert.equal(templateClientTwo.meta.label, 'testing/template-instance-2')
```

### Deploying multiple instances

```typescript
import assert from 'node:assert'
import { Deployment } from '@fadroma/agent'
import { withTmpFile } from '@hackbg/file'
import { mockAgent } from '../fixtures/Fixtures.ts.md'
function inTmpDeployment (cb) {
  return withTmpFile(f=>{
    const d = new Deployment(f, mockAgent())
    return cb(d)
  })
}
import { Client } from '@fadroma/agent'
```

```typescript

import { Builder } from '@fadroma/agent'

deployment = new Deployment({
  agent: new Agent({ chain: new Chain({ id: 'test', mode: Chain.Mode.Devnet }) }),
  builder: new Builder()
})

assert.ok(deployment.devMode, 'deployment is in dev mode')
assert.equal(deployment.size, 0)

template = await deployment.template({
  codeId: 2,
  client: MyClient,
  crate: 'fadroma-example-kv'
})

assert.ok(template.info)

instance = template.instance({
  name: 'custom-client-contract',
  initMsg: {}
})

assert.equal(deployment.size, 1)
assert.ok(await template.compiled)
assert.ok(await template.uploaded)
//assert.ok(instance instanceof MyClient) // FIXME
//assert.ok(await instance.myMethod())
//assert.ok(await instance.myQuery())
```
