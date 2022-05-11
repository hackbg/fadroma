# Fadroma Devnet

The devnet is a temporary local server which simulates
the behavior of a single-node blockchain network.

```typescript
import assert from 'assert'
const DevnetSpec = {}
const test = tests => Object.assign(DevnetSpec, tests)
export default DevnetSpec
```

## Constructing a devnet

```typescript
import { Devnet } from '../index'

test({
  async 'construct devnet' ({ ok, equal }) {
    const chainId = 'test-devnet'
    const devnet = new Devnet({ chainId })
    equal(devnet.chainId, chainId)
    ok(devnet.protocol)
    ok(devnet.host)
    ok(devnet.port)
  }
})
```

## Devnets are persistent

```typescript
import { JSONFile, Directory, withTmpDir } from '@hackbg/toolbox'
test({
  async 'save/load Devnet state' ({ ok, equal, deepEqual }) {
    withTmpDir(stateRoot=>{
      const chainId = 'test-devnet'
      const devnet = new Devnet({ chainId, stateRoot })
      ok(devnet.nodeState instanceof JSONFile)
      ok(devnet.stateRoot instanceof Directory)
      equal(devnet.stateRoot.path, stateRoot)
      ok(!devnet.load())
      equal(devnet.save(), devnet)
      deepEqual(devnet.load(), { chainId, port: devnet.port })
    })
  }
})
```

## Dockerode devnet

```typescript
import { DockerodeDevnet } from '../index'
import { mockDockerode } from './_Harness'
import { resolve, basename, DockerImage, withTmpFile } from '@hackbg/toolbox'
test({
  'construct dockerode devnet' ({ ok, equal }) {
    withTmpDir(stateRoot=>{
      const docker      = mockDockerode()
      const imageName   = Symbol()
      const image       = new DockerImage(docker, imageName)
      const initScript  = Symbol()
      const readyPhrase = "I'm Freddy"
      const devnet = new DockerodeDevnet({ stateRoot, docker, image, initScript, readyPhrase })
      equal(devnet.identities.path, resolve(stateRoot, 'identities'))
      equal(devnet.image,           image)
      equal(devnet.image.docker,    docker)
      equal(devnet.image.name,      imageName)
      equal(devnet.initScript,      initScript)
      equal(devnet.readyPhrase,     readyPhrase)
    })
  },
  async 'spawn dockerode devnet' ({ equal }) {
    await withTmpDir(async stateRoot => {
      await withTmpFile(async initScript => {
        const docker = mockDockerode(({ createContainer }) => {
          if (createContainer) {
            return [ null, { on (arg, cb) {
              if (arg === 'data') {
                cb(readyPhrase)
              }
            }, destroy () {} } ]
          }
        })
        const imageName   = basename(stateRoot)
        const image       = new DockerImage(docker, imageName)
        const readyPhrase = "I'm Freddy"
        class TestDockerodeDevnet extends DockerodeDevnet {
          waitSeconds = 0.5
          waitPort = () => Promise.resolve()
        }
        const devnet = new TestDockerodeDevnet({ stateRoot, docker, image, initScript, readyPhrase })
        equal(await devnet.spawn(), devnet)
      })
    })
  },
  'pass names of accounts to prefund on genesis' ({ equal, ok }) {
    const names  = [ 'FOO', 'BAR' ]
    const devnet = new Devnet({ identities: names })
    equal(devnet.genesisAccounts, names)
    const dockerDevnet = new DockerodeDevnet({
      identities: names,
      initScript: '',
      image: { name: Symbol() }
    })
    equal(dockerDevnet.genesisAccounts, names)
    const envVars = dockerDevnet.getContainerOptions().Env.filter(
      x => x.startsWith('GenesisAccounts')
    )
    equal(envVars.length, 1)
    equal(envVars[0].split('=')[1], 'FOO BAR')
  }
})
```

## Chain-specific devnets

```typescript
import { getScrtDevnet_1_2, getScrtDevnet_1_3 } from '../index'
for (const getDevnet of [getScrtDevnet_1_2, getScrtDevnet_1_3]) test({
  [`${getDevnet.name}: get scrt devnet`] ({ ok }) {
    ok(getDevnet())
  },
})
```
