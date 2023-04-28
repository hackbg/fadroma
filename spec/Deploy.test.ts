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
