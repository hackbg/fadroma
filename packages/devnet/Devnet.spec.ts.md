# Fadroma Devnet Spec

The **devnet** (a.k.a. localnet) is a local instance of the selected chain.

* Devnets are persistent, and can be started and stopped,
  thanks to the file **devnet.nodeState** which contains
  info about the devnet container:

```typescript
import { defineDevnet, getDevnet } from '@fadroma/devnet'
defineDevnet()
for (const kind of ['scrt_1.2', 'scrt_1.3', 'scrt_1.4']) {
  getDevnet(kind)
}
```

## Base definitions

```typescript
import './devnet-base.spec.ts.md'
```

## Docker-based implementation

```typescript
import './devnet-docker.spec.ts.md'
```
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
# Fadroma Devnet Spec: Docker implementation

```typescript
import * as Testing from '../../TESTING.ts.md'
import assert, { ok, equal, deepEqual } from 'assert'
```

```typescript
import { Devnet, DockerDevnet } from '@fadroma/devnet'
import { withTmpFile } from '@hackbg/file'
import * as Dokeres from '@hackbg/dock'
import { resolve, basename } from 'path'
const readyPhrase = "I'm Freddy"

// construct dockerode devnet
await withTmpDir(stateRoot=>{
  const docker      = {}
  const imageName   = Symbol()
  const image       = new Dokeres.Engine(docker).image(imageName)
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

    const docker = {}
    docker.pull = async () => {}
    docker.getImage = () => ({
      inspect: async () => {},
    })
    docker.createContainer = async () => ({
      id: 'testing',
      start: async () => {},
      inspect: async () => ({ State: {} }),
      logs: (opts, cb) => cb(null, {
        on (arg, cb) { if (arg === 'data') { cb(readyPhrase) } },
        off (arg, cb) {},
        destroy () {},
      })
    })

    const devnet = new DockerDevnet({
      stateRoot,
      docker,
      image: new Dokeres.Engine(docker).image(basename(stateRoot)),
      initScript,
      readyPhrase,
      portMode: 'lcp' // or 'grpcWeb'
    })
    devnet.waitSeconds = 0.1
    devnet.waitPort = async () => {}

    equal(await devnet.spawn(), devnet)
    await devnet.terminate()
  })
})

// pass names of accounts to prefund on genesis
const identities  = [ 'FOO', 'BAR' ]
let devnet = new Devnet({ identities })
devnet.port = 1234
equal(devnet.genesisAccounts, identities)
let image = {
  name: Symbol(),
  run (name, options, command, entrypoint) {
    equal(name, image.name)
    equal(options.env.GenesisAccounts, 'FOO BAR')
  }
}
const dockerDevnet = new DockerDevnet({ identities, initScript: '', image })
dockerDevnet.port = 1234
equal(dockerDevnet.genesisAccounts, identities)
```

```typescript
import { JSONFile, BaseDirectory, withTmpDir } from '@hackbg/file'
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

