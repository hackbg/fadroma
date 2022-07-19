# Fadroma Devnet Spec

```typescript
import * as Testing from '../../TESTING.ts.md'
import assert, { ok, equal, deepEqual } from 'assert'
```

* The devnet is a temporary self-hosted instance of the selected blockchain network,
  with a user-specified chain id.

```typescript
import { Devnet } from '.'
let devnet:  Devnet
let chainId: string
```

* Constructing a devnet:

```typescript
// requires chain id:
try { new Devnet() } catch (e) {}

// constructing a devnet
chainId = 'test-devnet'
devnet  = new Devnet({ chainId })

equal(devnet.chainId, chainId)
ok(devnet.protocol)
ok(devnet.host)
equal(devnet.port, 9091)
```

* Devnets are persistent:

```typescript
import { JSONFile, BaseDirectory, withTmpDir } from '@hackbg/kabinet'
// save/load Devnet state
withTmpDir(async stateRoot=>{
  const chainId = 'test-devnet'
  const devnet = new Devnet({ chainId, stateRoot })
  ok(devnet.nodeState instanceof JSONFile)
  ok(devnet.stateRoot instanceof BaseDirectory)
  equal(devnet.stateRoot.path, stateRoot)
  //ok(await devnet.load())
  equal(devnet.save(), devnet)
  deepEqual(await devnet.load(), { chainId, port: devnet.port })
})
```


