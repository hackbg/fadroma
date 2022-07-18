# Fadroma Devnet Spec

```typescript
import { Devnet } from '.'
let devnet: Devnet
```

* The devnet is a temporary self-hosted instance of the selected blockchain network.
* Constructing a devnet:

```typescript
// constructing a devnet
chainId = 'test-devnet'
devnet  = new Devnet({ chainId })
equal(devnet.chainId, chainId)
ok(devnet.protocol)
ok(devnet.host)
equal(devnet.port, 9091)

// requires chain id:
try { new Devnet() } catch (e) {}
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


