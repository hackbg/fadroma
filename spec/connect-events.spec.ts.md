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
assert.ok(new ConnectError.NoChainSelected() instanceof ConnectError)
assert.ok(new ConnectError.UnknownChainSelected() instanceof ConnectError)
```
