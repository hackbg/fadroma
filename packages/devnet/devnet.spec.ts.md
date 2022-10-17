# Fadroma Devnet Spec

```typescript
import * as Testing from '../../TESTING.ts.md'
import assert, { ok, equal, deepEqual } from 'assert'
```

The devnet is a temporary self-hosted instance of the selected blockchain network,
with a user-specified chain id.

```typescript
import { Devnet } from '.'
let devnet:  Devnet
let chainId: string
```

* Devnet config

```typescript
import { DevnetConfig } from '.'
let config: DevnetConfig = new DevnetConfig({}, '')
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
import * as Dokeres from '@hackbg/dokeres'
import { DockerDevnet } from '.'
// save/load Devnet state
withTmpDir(async stateRoot=>{
  const chainId = 'fadroma-devnet'
  const devnet = DockerDevnet.getOrCreate('scrt_1.3', Dokeres.Engine.mock())
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

* Dockerized devnet

```typescript
import { DockerDevnet } from '@hackbg/fadroma'
import { withTmpFile } from '@hackbg/kabinet'
import { Dokeres, mockDockerode } from '@hackbg/dokeres'
import { resolve, basename } from 'path'
const readyPhrase = "I'm Freddy"

// construct dockerode devnet
await withTmpDir(stateRoot=>{
  const docker      = mockDockerode()
  const imageName   = Symbol()
  const image       = new Dokeres(docker).image(imageName)
  const initScript  = Symbol()
  const devnet = new DockerDevnet({ stateRoot, docker, image, initScript, readyPhrase })
  equal(devnet.identities.path, resolve(stateRoot, 'identities'))
  equal(devnet.image,           image)
  equal(devnet.image.dockerode, docker)
  equal(devnet.image.name,      imageName)
  equal(devnet.initScript,      initScript)
  equal(devnet.readyPhrase,     readyPhrase)
})

// spawn dockerode devnet
await withTmpDir(async stateRoot => {
  await withTmpFile(async initScript => {
    const docker = mockDockerode(({ createContainer }) => {
      if (createContainer) {
        const stream = {
          on (arg, cb) {
            if (arg === 'data') {
              cb(readyPhrase)
            }
          },
          off (arg, cb) {},
          destroy () {},
        }
        return [ null, stream ]
      }
    })
    class TestDockerDevnet extends DockerDevnet {
      waitSeconds = 0.5
      waitPort = () => Promise.resolve()
    }
    const devnet = new TestDockerDevnet({
      stateRoot,
      docker,
      image: new Dokeres(docker).image(basename(stateRoot)),
      initScript,
      readyPhrase,
      portMode: 'lcp' // or 'grpcWeb'
    })
    equal(await devnet.spawn(), devnet)
  })
})

// pass names of accounts to prefund on genesis
const identities  = [ 'FOO', 'BAR' ]
devnet = new Devnet({ identities })
equal(devnet.genesisAccounts, identities)
image = {
  name: Symbol(),
  run (name, options, command, entrypoint) {
    equal(name, image.name)
    equal(options.env.GenesisAccounts, 'FOO BAR')
  }
}
const dockerDevnet = new DockerDevnet({ identities, initScript: '', image })
equal(dockerDevnet.genesisAccounts, identities)
```
