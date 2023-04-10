# Fadroma Deploy Specification

## Deploy CLI

```sh
$ fadroma deploy
$ fadroma deploy path-to-script.ts
$ fadroma redeploy
```

## Deploy API

### Defining a deployment

To define your deployment, extend the `Deployment` class:

```typescript
import { Deployment } from '@fadroma/agent'

export class MyDeployment extends Deployment {
  foo = this.contract({ name: 'foo', crate: 'fadroma-example-kv', initMsg: {} })
  bar = this.contract({ name: 'bar', crate: 'fadroma-example-kv', initMsg: {} })
}
```

### Deploying a contract

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

#### Awaiting deployment

By `await`ing a `Contract`'s `deployed`, property, you say:
"give me a handle to this contract; if it's not deployed,
deploy it, and all of its dependencies (as specified by the `initMsg` method)".

```typescript
const foo1 = await deployment.foo.deployed
const bar1 = await deployment.bar.deployed

assert(foo1 instanceof Client)
assert(bar1 instanceof Client)
```

#### Expecting deployment to have been completed

Using the `expect` method, you state: "I expect that
at the current point in time, this contract is deployed;
now, give me a handle to it".

If the contract is not deployed, this will throw an error.

```typescript
const foo2 = deployment.foo.expect()
const bar2 = deployment.bar.expect()

assert(foo2 instanceof Client)
assert(bar2 instanceof Client)
```

The default `Deployment#deploy` method simply instantiates all
contracts defined using the `Deployment#contract` method. To
implement a custom deploy order, you can override `deploy`.

Let's build on top of the first example and implement
a custom `deploy` method:

```typescript
const deployment2 = await getDeployment(class MyDeployment2 extends MyDeployment {
  async deploy () {
    await this.foo.deployed
    await this.bar.deployed
    return this
  }
}).deploy()

assert(deployment2.foo.expect() instanceof Contract)
assert(deployment2.bar.expect() instanceof Contract)
```

### Deploying multiple instances of a contract

The `Deployment#template` method allows you to add a `Template`
in the `Deployment`. A `Template` can be built and uploaded,
and then create multiple `Contract` instances that use to the same code,
via the `Template#instance` method.

```typescript
const deployment3 = await getDeployment(class MyDeployment3 extends MyDeployment {

  baz = this.template({ crate: 'foo' })

  baz1 = this.baz.instance({ name: 'baz1' })

  bazN = this.baz.instances([
    { name: 'baz2' },
    { name: 'baz3' },
    { name: 'baz4' }
  ])

}).deploy()

assert(deployment3.baz              instanceof Template)

assert(deployment3.baz1             instanceof Contract)
assert(deployment3.baz1.expect()    instanceof Client)

assert(deployment3.bazN             instanceof Array)
assert(deployment3.bazN[0]          instanceof Contract)
assert(deployment3.bazN[0].expect() instanceof Client)
```

## Implementing custom operations commands
