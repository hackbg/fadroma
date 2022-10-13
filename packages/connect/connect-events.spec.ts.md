## Connect events

```typescript
import { ConnectConsole } from '.'
const log = new ConnectConsole('(Test) Fadroma.Connect', {
  log: () => {}, info: () => {}, warn: () => {}, error: () => {}
})
log.noName({})
log.supportedChains()
log.selectedChain({})
log.selectedChain({ chain: 'x' })
```
