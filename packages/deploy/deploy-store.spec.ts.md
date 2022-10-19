## Deploy store

```typescript
import assert, { ok, equal, deepEqual, throws } from 'node:assert'
```

```typescript
import { Deployment } from '@fadroma/client'
import { DeployStore, YAML1, YAML2, JSON1 } from '@fadroma/deploy'
import { withTmpDir } from '@hackbg/kabinet'

// deployments
for (const $DeployStore of [
  YAML1.YAMLDeployments_v1,
  //YAML2.YAMLDeployments_v2, // TODO
  //JSON1.JSONDeployments_v1, // TODO
]) {
  await withTmpDir(async dir=>{

    const deployments = new $DeployStore(dir)
    ok(deployments instanceof DeployStore)
    ok(deployments.root.path === dir)

    assert.rejects(deployments.select('missing'))

    assert(!deployments.active)
    await deployments.create()

    await deployments.create('test-deployment-1')
    await deployments.create('test-deployment-2')
    await deployments.select('test-deployment-1')
    assert(deployments.active instanceof Deployment)
    await deployments.select('test-deployment-2')
    assert(deployments.active instanceof Deployment)

    deployments.get()
    deployments.list()
    deployments.set('test', { key: 'value' })

  })
}
```
