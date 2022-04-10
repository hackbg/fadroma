# `@fadroma/ops/Deploy` test suite

```typescript
const DeploySpec = {}
const test = tests => Object.assign(DeploySpec, tests)
export default DeploySpec
```

## Deployment

```typescript
import { Deployment } from './Deploy'
import { tmp, rimraf } from '@hackbg/tools'
test({
  'Deployment chainable methods' ({ equal }) {
    withTmpFile(f=>{
      const d = new Deployment(f)
      d.load()
      equal(d, d.save('test', 'test'))
      equal(d, d.set('foo'))
      equal(d, d.setMany({bar:{},baz:{}}))
    })
  }
  async 'Deployment init' () {
    await withTmpFile(async f=>{
      const d = new Deployment(f)
      const a = { async instantiate () { return { foo: 'bar' } } }
      await d.init(a)
      await d.initMany(a)
      await d.initVarious(a)
    })
  }
})

const withTmpFile = fn => {
  const {name} = tmp.fileSync()
  try {
    return fn(name)
  } finally {
    rimraf(name)
  }
}
```

## Deployments directory

```typescript
import { Deployments } from './Deploy'
test({
  async 'Deployments' () {
    await withTmpDir(async dir=>{
      const d = new Deployments(dir)
      await d.create()
      await d.select()
      d.active
      d.get()
      d.list()
      d.save('test', 'test')
    })
  },
  async 'Deployments integrations' ({ equal }) {
    const context = {
      chain: {
        deployments: {
          active: { prefix: Symbol(), receipts: [] },
          printActive () {},
          list () { return [] },
          async create () {},
          async select () {}
        }
      }
    }
    await Deployments.new(context)
    const { deployment, prefix } = await Deployments.activate(context)
    equal(deployment, context.chain.deployments.active)
    equal(prefix,     context.chain.deployments.active.prefix)
    await Deployments.status(context)
    await Deployments.select(context)
  }
})

const withTmpDir = fn => {
  const {name} = tmp.dirSync()
  try {
    return fn(name)
  } finally {
    rimraf(name)
  }
}
```
