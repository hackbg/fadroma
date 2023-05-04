# Fadroma Deploy API

The **Deploy API** revolves around the `Deployment` class, and associated
implementations of `Client`, `Builder`, `Uploader`, and `DeployStore`.

These classes are used for describing systems consisting of multiple smart contracts,
such as when deploying them from source. By defining such a system as one or more
subclasses of `Deployment`, Fadroma enables declarative, idempotent, and reproducible
smart contract deployments.

## Deployment

The `Deployment` class represents a set of interrelated contracts.
To define your deployment, extend the `Deployment` class, and use the
`this.template({...})` and `this.contract({...})` methods to specify
what contracts to deploy:

```typescript
import { Deployment } from '@fadroma/agent'

export class MyDeployment extends Deployment {

  foo = this.contract({
    name: 'foo',
    crate: 'fadroma-example-kv',
    initMsg: {}
  })

  bar = this.contract({
    name: 'bar',
    crate: 'fadroma-example-kv',
    initMsg: {}
  })

}
```

### Deploying everything

To prepare a deployment for deploying, use `getDeployment`.
This will provide a populated instance of your deployment class.

```typescript
import { getDeployment } from '@hackbg/fadroma'
let deployment = getDeployment(MyDeployment, /* ...constructor args */)
```

Then, call its `deploy` method:

```typescript
await deployment.deploy()
```

For each contract defined in the deployment, this will do the following:

* If it's not compiled yet, this will **build** it.
* If it's not uploaded yet, it will **upload** it.
* If it's not instantiated yet, it will **instantiate** it.

Having deployed a contract, you want to obtain a `Client` instance
that points to it, so you can call the contract's methods.

There are two ways of doing this, awaiting and expecting.

### Deploying individual contracts and their dependencies

By `await`ing a `Contract`'s `deployed` property, you say:
"give me a handle to this contract; if it's not deployed,
deploy it, and all of its dependencies (as specified by the `initMsg` method)".

```typescript
const foo1 = await deployment.foo.deployed
const bar1 = await deployment.bar.deployed

import { Client } from '@fadroma/agent'
assert(foo1 instanceof Client)
assert(bar1 instanceof Client)
```

Since this does not call the deployment's `deploy` method,
it *only* deploys the requested contract and its dependencies
but not any other contracts defined in the deployment.

### Adding custom migrations

The default `Deployment#deploy` method simply instantiates all
contracts defined using the `Deployment#contract` method. To
implement a custom deploy order, you can override `deploy`.

Let's build on top of the first example and implement
a custom `deploy` method:

```typescript
class MyDeployment2 extends MyDeployment {

  async deploy (deployOnlyFoo?: boolean) {
    /** You can override the deploy method to deploy with custom logic. */
    await this.foo.deployed
    if (!deployOnlyFoo) await this.bar.deployed
    return this
  }

  async update (previous: Deployment) {
    /** Here you may implement an upgrade method that fetches
      * the state of existing contracts, and deploys new ones. */
  }

}

const deployment2 = await getDeployment(MyDeployment2).deploy()

assert(deployment2.foo.expect() instanceof Client)
assert(deployment2.bar.expect() instanceof Client)
```

### How state is stored

See the `DeployStore` implementation.

### Exporting the deployment

This feature is a work-in-progress.

### Connecting to an exported deployment

Having been deployed once, contracts may be used continously.
The `Deployment`'s `connect` method loads stored data about
the contracts in the deployment, populating the contained
`Contract` instances.

### Expecting contracts to be deployed

Using the `expect` method, you state: "I expect that
at the current point in time, this contract is deployed;
now, give me a handle to it".

```typescript
const foo2 = deployment.foo.expect()
const bar2 = deployment.bar.expect()

assert(foo2 instanceof Client)
assert(bar2 instanceof Client)
```

If the address of the request contract is not available,
this will throw an error.

```typescript
import assert from 'node:assert'
import './Deploy.test.ts'
```

## Template

The `Contract` class describes a smart contract's source, binary, and upload.

### Deploying multiple contracts from a template

The `deployment.template` method adds a `Template` to the `Deployment`.

A `Template` represents the code of a smart contract before instantiation.
A `Template` can be `built` and `uploaded`. Multiple `Contract` instances
can be created with the `template.instance` and `template.instances([...]|{...})` methods.

You can pass either an array or an object to `template.instances`.

```typescript
class DeploymentWithTemplates extends Deployment {

  t = this.template({ crate: 'fadroma-example-kv' })

  c1 = this.t.instance({ name: 'c1', initMsg: {} })

  c2 = this.t.instances([
    { name: 'c21', initMsg: {} },
    { name: 'c22', initMsg: {} },
    { name: 'c32', initMsg: {} }
  ])

  c3 = this.t.instances({
    c31: { name: 'c31', initMsg: {} },
    c32: { name: 'c32', initMsg: {} },
    c33: { name: 'c33', initMsg: {} }
  })

}

deployment = await getDeployment(DeploymentWithTemplates).deploy()
```

```typescript
import { Contract, Template } from '@fadroma/agent'

assert(deployment.t instanceof Template)

assert(deployment.c1 instanceof Contract)
assert(deployment.c1.expect() instanceof Client)

assert(Object.values(deployment.c2).every(c=>c instanceof Contract))
assert(Object.values(deployment.c2).map(c=>c.expect()).every(c=>c instanceof Client))

assert(Object.values(deployment.c3).every(c=>c instanceof Contract))
assert(Object.values(deployment.c3).map(c=>c.expect()).every(c=>c instanceof Client))
```

### Building from source code

To build, the `builder` property must be set to a valid `Builder`.
When obtaining instances from a `Deployment`, the `builder` property
is provided automatically from `deployment.builder`.

```typescript
import { Builder } from '@fadroma/agent'
assert(deployment.t.builder instanceof Builder)
assert.equal(deployment.t.builder, deployment.builder)
```

You can build a `Template` (or its subclass, `Contract`) by awaiting the
`built` property or the return value of the `build()` method.

```typescript
await deployment.t.built
// -or-
await deployment.t.build()
```

See [the **build guide**](./build.html) for more info.

### Uploading binaries

To upload, the `uploader` property must be set to a valid `Uploader`.
When obtaining instances from a `Deployment`, the `uploader` property
is provided automatically from `deployment.uploader`.

```typescript
import { Uploader } from '@fadroma/agent'
assert(deployment.t.uploader instanceof Uploader)
assert.equal(deployment.t.uploader, deployment.uploader)
```

You can upload a `Template` (or its subclass, `Contract`) by awaiting the
`uploaded` property or the return value of the `upload()` method.

If a WASM binary is not present (`template.artifact` is empty),
but a source and a builder are present, this will also try to build the contract.

```typescript
await deployment.t.uploaded
// -or-
await deployment.t.upload()
```

See [the **upload guide**](./upload.html) for more info.

## Contract

The `Contract` class describes an individual smart contract instance and uniquely identifies it
within the `Deployment`.

```typescript
import { Contract } from '@fadroma/agent'

new Contract({
  repository: 'REPO',
  revision:   'REF',
  workspace:  'WORKSPACE'
  crate:      'CRATE',
  artifact:   'ARTIFACT',
  chain:      { /* ... */ },
  agent:      { /* ... */ },
  deployment: { /* ... */ }
  codeId:     0,
  codeHash:   'CODEHASH'
  client:     Client,
  name:       'NAME',
  initMsg:    async () => ({})
})
```

### Naming and labels

The chain requires labels to be unique.
Labels generated by Fadroma are of the format `${deployment.name}/${contract.name}`.

### Lazy init

The `initMsg` property of `Contract` can be a function returning the actual message.
This function is only called during instantiation, and can be used to generate init
messages on the fly, such as when passing the address of one contract to another.

### Deploying contract instances

To instantiate a `Contract`, its `agent` property must be set to a valid `Agent`.
When obtaining instances from a `Deployment`, their `agent` property is provided
from `deployment.agent`.

```typescript
import { Agent } from '@fadroma/agent'
assert(deployment.c1.agent instanceof Agent)
assert.equal(deployment.c1.agent, deployment.agent)
```

You can instantiate a `Contract` by awaiting the `deployed` property or the return value of the
`deploy()` method. Since distributed ledgers are append-only, deployment is an idempotent operation,
so the deploy will run only once and subsequent calls will return the same `Contract` with the
same `address`.

```typescript
await deployment.c1.deploy()
await deployment.c1.deployed
```

If `contract.codeId` is not set but either source code or a WASM binary is present,
this will try to upload and build the code first.

```typescript
await deployment.c1.uploaded
await deployment.c1.upload()

await deployment.c1.built
await deployment.c1.build()
```
