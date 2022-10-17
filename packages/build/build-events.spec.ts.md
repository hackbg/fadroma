# Fadroma Build Events

```typescript
import { BuildConsole } from '@fadroma/build'
import { Contract } from '@fadroma/client'
const log = new BuildConsole({ info: () => {} })
log.buildingFromCargoToml('foo')
log.buildingFromBuildScript('foo')
log.buildingFromWorkspace('foo')
log.buildingOne(new Contract({ crate: 'bar' }))
log.buildingOne(new Contract({ crate: 'bar', revision: 'commit' }))
log.buildingOne(
  new Contract({ crate: 'bar', revision: 'commit' }),
  new Contract({ crate: 'bar', revision: 'commit' })
)
log.buildingMany([
  new Contract({ crate: 'bar' }),
  new Contract({ crate: 'bar', revision: 'commit' })
])
```
