# Fadroma Connect Events

```typescript
import assert from 'node:assert'
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

## Connect errors

```typescript
import { ConnectError } from './connect-events'
for (const subtype of ConnectError.subtypes) {
  //console.log(subtype, ConnectError[subtype])
  assert(new ConnectError[subtype]() instanceof ConnectError)
}
```
