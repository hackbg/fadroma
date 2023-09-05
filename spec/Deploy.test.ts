import { DeployStore, Deployment } from '@fadroma/agent'
import { DeployStore_v1 } from '@hackbg/fadroma'
import * as assert from 'node:assert'

import './Deploy.spec.ts.md'

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

let result = ''
const store = new DeployStore_v1('', {})
Object.defineProperty(store, 'root', { // mock
  value: {
    exists: () => false,
    make: () => ({}),
    at: () => ({
      real: { name: 'foobar' },
      exists: () => false,
      as: () => ({
        save: (output: any)=>{result=output},
        loadAll: () => [ {name: 'foo'}, {name: 'bar'} ],
      }),
      makeParent: () => ({
        exists: () => false,
        as: () => ({ save: (output: any)=>{result=output} }) 
      }),
    })
  }
})
await store.create()
store.list()
store.save('foo', { contract1: { deployment: true }, contract2: { deployment: true } } as any)
assert.equal(result, '---\n{}\n---\n{}\n')
assert.ok(store[Symbol.toStringTag])
