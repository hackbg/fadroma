```typescript
import { ok, throws, equal, deepEqual } from 'node:assert'
```

```typescript
import { DevnetConfig } from '@fadroma/devnet'

ok(new DevnetConfig())
```

```typescript
import { devnetPortModes } from '@fadroma/devnet'

ok(devnetPortModes)
```

```typescript
import { Devnet } from '@fadroma/devnet'
ok(new Devnet())
throws(()=>new Devnet({ chainId: '' }))
throws(()=>new Devnet().url)
equal(new Devnet({ port: '1234' }).url.toString(), 'http://localhost:1234/')
ok(new Devnet().save())
ok(await new Devnet().load())
deepEqual(new Devnet({ identities: [ 'ALICE', 'BOB' ] }).genesisAccounts, [ 'ALICE', 'BOB' ])

const devnet = new Devnet()
devnet.kill  = async () => {}
devnet.erase = async () => {}
ok(await devnet.terminate())
```

```typescript
import { DevnetCommands } from '@fadroma/devnet'
const commands = new DevnetCommands()
commands.status()
commands.reset()
```

```typescript
import { resetDevnet } from '@fadroma/devnet'
await resetDevnet({ chain: { isDevnet: false } })
await resetDevnet({ chain: { isDevnet: true, node: false } })
await resetDevnet({ chain: null })
await resetDevnet()
```
