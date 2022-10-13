## Connect events

```typescript
import { ConnectConsole } from '.'
const log = new ConnectConsole({
  log: () => {}, info: () => {}, warn: () => {}, error: () => {}
})
log.noName({})
log.noDeploy()
log.selectedChain({})
log.selectedChain({ chain: 'x' })
log.chainStatus({})
log.chainStatus({
  chain: { constructor: { name: 1 }, mode: 2, id: 3, url: new URL('http://example.com') }
})
log.chainStatus({
  chain: { constructor: { name: 1 }, mode: 2, id: 3, url: new URL('http://example.com') }
  deployments: { list () { return [] } }
})
log.chainStatus({
  chain: { constructor: { name: 1 }, mode: 2, id: 3, url: new URL('http://example.com') }
  deployments: { list () { return [] }, active: { name: 4 } }
})
```

