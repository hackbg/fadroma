## Deploy store

```typescript
import * as Testing from '../../TESTING.ts.md'
import assert, { ok, equal, deepEqual, throws } from 'assert'
```

```typescript
import { DeployStore, YAML1, YAML2, JSON1 } from '.'
import { withTmpDir } from '@hackbg/kabinet'
import { existsSync } from 'fs'

// deployments
for (const DeployStore of [
  YAML1.YAMLDeployments_v1,
  //YAML2.YAMLDeployments_v2, // TODO
  //JSON1.JSONDeployments_v1, // TODO
]) {
  await withTmpDir(async dir=>{
    const deployments = new YAML1.YAMLDeployments_v1(dir)
    ok(deployments instanceof DeployStore)
    ok(deployments.root.path === dir)
    await deployments.create('test-deployment-1')
    await deployments.create('test-deployment-2')
    await deployments.select('test-deployment-1')
    await deployments.select('test-deployment-2')
    assert(deployments.active instanceof Deployment)
    deployments.get()
    deployments.list()
    deployments.set('test', 'test')
  })
}
```

