# Fadroma Test Commands

```typescript
import Fadroma from '@hackbg/fadroma'

import { Scrt_1_2, dirname, fileURLToPath, resolve } from '@hackbg/fadroma'
const __dirname = dirname(fileURLToPath(import.meta.url))
Fadroma.command("bundle", async () => {
  const agent = new Scrt_1_2.Agent()
  console.log(agent)
  await agent.upload(resolve(__dirname, 'hello.wasm'))
  await agent.instantiate()
  await agent.query()
  await agent.execute()
})
```

## Entry point

```typescript
export default Fadroma.module(import.meta.url)
```
