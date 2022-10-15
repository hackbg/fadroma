## Deploy events

Like the other packages of the Fadroma suite, Fadroma Deploy exposes
a custom console logger based on `@hackbg/konzola`.

```typescript
import { DeployConsole } from '.'
const log = new DeployConsole()
log.console = { log: () => {}, info: () => {}, warn: () => {}, error: () => {} }
log.deployment({})
log.deployment({ deployment: { name: '', state: {} } })
log.deployment({ deployment: { name: '', state: { x: { address: 'x' } } } })
log.receipt('', '')
log.deployFailed(new Error(), {}, '', '')
log.deployManyFailed({}, [], new Error())
log.deployManyFailed({}, [['name', 'init']], new Error())
log.deployFailedContract()
log.warnNoDeployment()
log.warnNoAgent()
log.warnNoDeployAgent()
log.deployStoreDoesNotExist()
```

