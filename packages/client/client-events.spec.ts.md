```typescript
import assert from 'node:assert'
```

# Client errors

The `ClientError` class defines custom error subclasses for various error conditions.

```typescript
// Make sure each error subclass can be created with no arguments:
import { ClientError } from './client-events'
for (const subtype of ClientError.subtypes) {
  //console.log(subtype, ClientError[subtype])
  assert(new ClientError[subtype]() instanceof ClientError)
}
```

# Client console

The `ClientConsole` class collects all logging output in one place.
In the future, this will enable semantic logging and/or GUI notifications.

```typescript
// Make sure each log message can be created with no arguments:
import { ClientConsole } from './client-events'
new ClientConsole().object()
new ClientConsole().deployment()
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
