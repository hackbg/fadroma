```typescript
import assert from 'node:assert'
```

The `ClientConsole` class collects all logging output in one place.
In the future, this will enable semantic logging and/or GUI notifications.

```typescript
// Make sure each log message can be created with no arguments:
import { ClientConsole } from './core-events'
new ClientConsole().object()
new ClientConsole().object({foo:'bar',baz(){},quux:[],xyzzy:undefined,fubar:{}})
new ClientConsole().deployment()
new ClientConsole().deployment({ state: { foo: {}, bar: {} } })
new ClientConsole().receipt()
new ClientConsole().foundDeployedContract()
new ClientConsole().beforeDeploy()
new ClientConsole().afterDeploy()
new ClientConsole().deployFailed()
new ClientConsole().deployManyFailed()
new ClientConsole().deployFailedContract()
new ClientConsole().chainStatus()
new ClientConsole().warnUrlOverride()
new ClientConsole().warnIdOverride()
new ClientConsole().warnNodeNonDevnet()
new ClientConsole().warnNoAgent()
new ClientConsole().warnNoAddress()
new ClientConsole().warnNoCodeHash()
new ClientConsole().warnNoCodeHashProvided()
new ClientConsole().warnCodeHashMismatch()
new ClientConsole().confirmCodeHash()
new ClientConsole().waitingForNextBlock()
new ClientConsole().warnEmptyBundle()
new ClientConsole().chainStatus({})
new ClientConsole().chainStatus({
  chain: { constructor: { name: 1 }, mode: 2, id: 3, url: new URL('http://example.com') }
})
new ClientConsole().chainStatus({
  chain: { constructor: { name: 1 }, mode: 2, id: 3, url: new URL('http://example.com') }
  deployments: { list () { return [] } }
})
new ClientConsole().chainStatus({
  chain: { constructor: { name: 1 }, mode: 2, id: 3, url: new URL('http://example.com') }
  deployments: { list () { return [] }, active: { name: 4 } }
})
```

## Connect logs

```typescript
import { ConnectConsole } from '.'
const log = new ConnectConsole('(Test) Fadroma.Connect', {
  log: () => {}, info: () => {}, warn: () => {}, error: () => {}
})
log.noName({})
log.supportedChains()
log.selectedChain()
log.selectedChain({})
log.selectedChain({ chain: 'x' })
```

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

