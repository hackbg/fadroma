# Fadroma Build Events

```typescript
import { BuildConsole } from '@fadroma/build'
import { ContractSource } from '@fadroma/core'
const log = new BuildConsole({ info: () => {} })
log.buildingFromCargoToml('foo')
log.buildingFromBuildScript('foo')
log.buildingFromWorkspace('foo')
log.buildingOne(new ContractSource({ crate: 'bar' }))
log.buildingOne(new ContractSource({ crate: 'bar', revision: 'commit' }))
log.buildingOne(
  new ContractSource({ crate: 'bar', revision: 'commit' }),
  new ContractSource({ crate: 'bar', revision: 'commit' })
)
log.buildingMany([
  new ContractSource({ crate: 'bar' }),
  new ContractSource({ crate: 'bar', revision: 'commit' })
])
```
