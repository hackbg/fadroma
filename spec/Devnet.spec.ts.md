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
  'construct devnet' ({ ok, equal }) {
    const chainId = 'test-devnet'
    const devnet = new Devnet({ chainId })
    equal(devnet.chainId, chainId)
    ok(devnet.protocol)
    ok(devnet.host)
    equal(devnet.port, '')
  },
  'construct devnet requires chain id' ({ throws }) {
    try { // FIXME: for some reason assert.throws doesn't work
      new Devnet()
    } catch (e) {
      return // ok
    }
    ok(false, 'threw')
  }
})
```

## Devnets are persistent

```typescript
import { JSONFile, BaseDirectory, withTmpDir } from '@hackbg/kabinet'
test({
  async 'save/load Devnet state' ({ ok, equal, deepEqual }) {
    withTmpDir(stateRoot=>{
      const chainId = 'test-devnet'
      const devnet = new Devnet({ chainId, stateRoot })
      ok(devnet.nodeState instanceof JSONFile)
      ok(devnet.stateRoot instanceof BaseDirectory)
      equal(devnet.stateRoot.path, stateRoot)
      ok(!devnet.load())
      equal(devnet.save(), devnet)
      deepEqual(devnet.load(), { chainId, port: devnet.port })
    })
  }
})
```

## Dockerized devnet

```typescript
import { DockerDevnet } from '../index'
import { mockDockerode } from './_Harness'
import { resolve, basename } from 'path'
import { withTmpFile } from '@hackbg/kabinet'
import { Dokeres } from '@hackbg/dokeres'
const readyPhrase = "I'm Freddy"
test({

  'construct dockerode devnet' ({ ok, equal }) {
    withTmpDir(stateRoot=>{
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
  },

  async 'spawn dockerode devnet' ({ equal }) {
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
  },

  'pass names of accounts to prefund on genesis' ({ equal, ok }) {
    const identities  = [ 'FOO', 'BAR' ]
    const devnet = new Devnet({ identities })
    equal(devnet.genesisAccounts, identities)
    const image = {
      name: Symbol(),
      run (name, options, command, entrypoint) {
        equal(name, image.name)
        equal(options.env.GenesisAccounts, 'FOO BAR')
      }
    }
    const dockerDevnet = new DockerDevnet({ identities, initScript: '', image })
    equal(dockerDevnet.genesisAccounts, identities)
  }

})
```

### Chain-specific Dockerode devnets

```typescript
import { getScrtDevnet } from '../index'
for (const version of ['1.2', '1.3']) test({
  async [`${version}: get scrt devnet`] ({ ok }) {
    const dokeres = new Dokeres(mockDockerode(({ createContainer })=>{
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
    }))
    const devnet = getScrtDevnet(version, undefined, undefined, dokeres)
    ok(devnet instanceof DockerDevnet)
    await devnet.respawn()
    await devnet.kill()
    await devnet.erase()
  },
})
```

## Managed devnet

### Chain-specific managed devnets

```typescript
import { ManagedDevnet } from '../index'
import { mockDevnetManager } from './_Harness'
for (const version of ['1.2', '1.3']) test({
  async [`${version}: get managed scrt devnet`] ({ ok }) {
    const manager = await mockDevnetManager()
    try {
      const devnet = getScrtDevnet(version, manager.url)
      ok(devnet instanceof ManagedDevnet)
      await devnet.respawn()
      console.info('Respawned')
      await devnet.save()
    } catch (e) {
      console.warn(e) // TODO use whole devnet manager with mocked devnet init
    } finally {
      manager.close()
    }
  },
})
```
