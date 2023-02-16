# Fadroma: Secret Network support

```typescript
import * as Scrt from '@fadroma/scrt'

const config = new Scrt.ScrtConfig()

const chain = new Scrt.Scrt({
  chainId: Symbol()
})

await chain.getAgent()

const agent = new Scrt.ScrtAgent({
  api: Symbol(),
  wallet: Symbol()
})

const bundle = new Scrt.ScrtBundle({
  agent: Symbol()
})

const client = new Scrt.ViewingKeyClient()
```
