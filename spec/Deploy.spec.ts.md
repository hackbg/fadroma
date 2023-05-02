# Fadroma Guide: Deploy API

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

The `Deployment#template` method allows you to add a `Template`
in the `Deployment`. A `Template` can be built and uploaded,
and then create multiple `Contract` instances that use to the same code,
via the `Template#instance` method.

```typescript
class MyDeployment3 extends MyDeployment {

  baz = this.template({ crate: 'fadroma-example-kv' })

  baz1 = this.baz.instance({ name: 'baz1', initMsg: {} })

  bazN = this.baz.instances([
    { name: 'baz2', initMsg: {} },
    { name: 'baz3', initMsg: {} },
    { name: 'baz4', initMsg: {} }
  ])

}

const deployment3 = await getDeployment(MyDeployment3).deploy()

import { Contract, Template } from '@fadroma/agent'

assert(deployment3.foo.expect() instanceof Client)
assert(deployment3.bar.expect() instanceof Client)

assert(deployment3.baz instanceof Template)

assert(deployment3.baz1 instanceof Contract)
assert(deployment3.baz1.expect() instanceof Client)
```

To deploy multiple contract instances from the same code,
you can use templates.

You can pass either an array or an object to `template.instances`:

```typescript
const [ templateInsanceThree, templateClientFour ] = await template.instances([
  { name: 'name3', initMsg: { parameter: 'value3' } },
  { name: 'name4', initMsg: { parameter: 'value4' } },
])
const { templateClientFoo, templateClientBar } = await template.instances({
  templateClientFoo: { name: 'name5', initMsg: { parameter: 'value5' } },
  templateClientFoo: { name: 'name6', initMsg: { parameter: 'value6' } },
})
```

### Building

```typescript
assert(deployment3.builder instanceof Builder) // required to build
await deployment3.baz.built // with defaults
// -or-
await deployment3.baz.build() // always builds
```

### Uploading

```typescript
assert(deployment3.uploader instanceof Uploader) // required to upload
await deployment3.baz.uploaded // with defaults
// -or-
await deployment3.baz.upload() // always builds
```

If the contract binary is not found, uploading will try to build it first.

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

### Naming

The chain requires labels to be unique.
Labels generated by Fadroma are of the format `[DeploymentName]/[ContractName]`.

### Lazy init

The `initMsg` property of `Contract` can be a function returning the actual message.
This function is only called during instantiation, and can be used to generate init
messages on the fly, such as when passing the address of one contract to another.

### Deploying

```typescript
await deployment3.baz1.deploy()
await deployment3.baz1.deployed

await deployment3.baz1.uploaded
await deployment3.baz1.upload()

await deployment3.baz1.built
await deployment3.baz1.build()
```
