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

* Devnets are persistent, and can be started and stopped,
  thanks to the file **devnet.nodeState** which contains
  info about the devnet container:

```typescript
import { JSONFile, BaseDirectory, withTmpDir } from '@hackbg/kabinet'
import { Dokeres } from '@hackbg/dokeres'
import { DockerDevnet } from '.'
// save/load Devnet state
withTmpDir(async stateRoot=>{
  const chainId = 'fadroma-devnet'
  const devnet = DockerDevnet.getOrCreate('scrt_1.3', Dokeres.mock())
  devnet.stateRoot.path = stateRoot
  ok(devnet.nodeState instanceof JSONFile)
  ok(devnet.stateRoot instanceof BaseDirectory)
  equal(devnet.stateRoot.path, stateRoot)
  devnet.container = { id: 'mocked' }
  equal(devnet.save(), devnet)
  deepEqual(await devnet.load(), { containerId: 'mocked', chainId, port: devnet.port })
  await devnet.spawn()
  await devnet.kill()
  await devnet.respawn()
  await devnet.erase()
})
```
