# Fadroma Build Events

```typescript
import { BuildConsole } from '@fadroma/build'
const log = new BuildConsole({ info: () => {} })
log.buildingFromCargoToml('foo')
log.buildingFromBuildScript('foo')
log.buildingFromWorkspace('foo')
log.buildingOne(contract.define({ crate: 'bar' }))
log.buildingOne(contract.define({ crate: 'bar', revision: 'commit' }))
log.buildingOne(contract.define({ crate: 'bar', revision: 'commit' }), contract)
log.buildingMany([
  contract.define({ crate: 'bar' }),
  contract.define({ crate: 'bar', revision: 'commit' })
])
```
