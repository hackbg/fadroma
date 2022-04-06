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
      equal(d, d.save())
      equal(d, d.set('foo'))
      equal(d, d.setMany({bar:{},baz:{}}))
    })
  }
  async 'Deployment init' () {
    await withTmpFile(async f=>{
      const d = new Deployment(f)
      await d.init()
      await d.initMany()
      await d.initVarious()
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
      d.save()
    })
  },
  async 'Deployments integrations' () {
    await Deployments.new()
    await Deployments.activate()
    await Deployments.status()
    await Deployments.select()
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
