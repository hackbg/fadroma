## Managed builder

```typescript
import { ManagedBuilder } from './Build'
test({
  async 'ManagedBuilder' () {
    const managerURL = 'http://localhost'
    const builder = new ManagedBuilder({ managerURL })
    const source  = { workspace: '/tmp' }
    await builder.build(source)
  }
})
```

### Mock managed builder API

```typescript
export async function mockBuildEndpoint () {
  throw 'TODO'
}
```
