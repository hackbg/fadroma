import { DeployStore, Deployment } from '@fadroma/agent'

new class MyDeployStore extends DeployStore {
  list (): string[] { throw 'stub' }
  save () { throw 'stub' }
  create (x: any): any { throw 'stub' }
  select (x: any): any { throw 'stub' }
  get active (): any { throw 'stub' }
  get activeName (): any { throw 'stub' }

  load () { return { foo: {}, bar: {} } }
}().getDeployment(class extends Deployment {
  foo = this.contract({ name: 'foo' })
  bar = this.contract({ name: 'bar' })
})

/**
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
**/
