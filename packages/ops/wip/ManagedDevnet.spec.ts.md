## Managed devnet

```typescript
import { ManagedDevnet } from './Devnet'
test({
  async 'ManagedDevnet.getOrCreate' () {
    const devnet = ManagedDevnet.getOrCreate()
  },
})
```

### Mock managed devnet API

```typescript
export async function mockDevnetEndpoint () {
  throw 'TODO'
}
```
