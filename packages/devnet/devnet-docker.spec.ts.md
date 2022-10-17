# Fadroma Devnet Spec: Docker implementation

```typescript
import * as Testing from '../../TESTING.ts.md'
import assert, { ok, equal, deepEqual } from 'assert'
```

```typescript
import { Devnet, DockerDevnet } from '@fadroma/devnet'
import { withTmpFile } from '@hackbg/kabinet'
import * as Dokeres from '@hackbg/dokeres'
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
import { JSONFile, BaseDirectory, withTmpDir } from '@hackbg/kabinet'
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
