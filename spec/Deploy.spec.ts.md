# Deploying contracts

## Deploy CLI

```sh
$ fadroma deploy
$ fadroma deploy path-to-script.ts
$ fadroma redeploy
```

## Deploy API basics

### Defining a `Deployment`

The `Deployment` class represents a set of interrelated contracts.
To define your deployment, extend the `Deployment` class, and specify
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

#### Contract labels

Since contract labels are required to be unique, Fadroma generates them
from the deployment name and the contract name. The deployment name
defaults to the current timestamp. The contract name you must specify explicitly.

#### Lazy initMsg

The `initMsg` property can be a function returning the actual message.
This is evaluated during instantiation, and can be used to generate init messages on the fly,
such as when passing the address of one contract to another.

### Deploying

To prepare a deployment for deploying, use `getDeployment`.
This will provide a populated instance of your deployment class.

```typescript
import { getDeployment } from '@fadroma/ops'
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

#### Deploying individual contracts

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

#### Custom deploy commands

The default `Deployment#deploy` method simply instantiates all
contracts defined using the `Deployment#contract` method. To
implement a custom deploy order, you can override `deploy`.

Let's build on top of the first example and implement
a custom `deploy` method:

```typescript
class MyDeployment2 extends MyDeployment {

  async deploy () {
    await this.foo.deployed
    await this.bar.deployed
    return this
  }

  async update (previous: Deployment) {
    /** Here you may implement a function that performs an upgrade,
      * in the form of deploying new versions of contracts,
      * and reusing others from the previous deployment. */
  }

}

const deployment2 = await getDeployment(MyDeployment2).deploy()

assert(deployment2.foo.expect() instanceof Client)
assert(deployment2.bar.expect() instanceof Client)
```

#### Deploying multiple instances of contracts

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

// FIXME: phat awaits
assert((await deployment3.bazN) instanceof Array)
assert((await (await deployment3.bazN)[0]) instanceof Client)
assert((await (await deployment3.bazN)[1]) instanceof Client)
assert((await (await deployment3.bazN)[2]) instanceof Client)
```

### Connecting

Having been deployed once, contracts may be used continously.
The `Deployment`'s `connect` method loads stored data about
the contracts in the deployment, populating the contained
`Contract` instances.

#### Expecting contracts to be present

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
```
