# Fadroma Devnet Tests

```typescript
import assert from 'assert'
const DevnetSpec = {}
const test = tests => Object.assign(DevnetSpec, tests)
export default DevnetSpec
```

## Constructing a devnet

```typescript
import { Devnet } from './Devnet'

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
import { tmp, rimraf, JSONFile, Directory } from '@hackbg/toolbox'
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

const withTmpDir = fn => {
  const {name} = tmp.dirSync()
  try {
    return fn(name)
  } finally {
    rimraf(name)
  }
}
```

## Dockerode devnet

```typescript
import { DockerodeDevnet } from './Devnet'
import { mockDockerode } from './Docker.spec'
import { resolve, basename, DockerImage } from '@hackbg/toolbox'
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
      equal(devnet.daemonDir.path,  resolve(stateRoot, 'secretd'))
      equal(devnet.clientDir.path,  resolve(stateRoot, 'secretcli'))
      equal(devnet.sgxDir.path,     resolve(stateRoot, 'sgx-secrets'))
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
        const docker      = mockDockerode()
        const imageName   = basename(stateRoot)
        const image       = new DockerImage(docker, imageName)
        const readyPhrase = "I'm Freddy"
        const devnet = new DockerodeDevnet({ stateRoot, docker, image, initScript, readyPhrase })
        throw 'TODO'
        equal(await devnet.spawn(), devnet)
      })
    })
  },
  'pass names of prefunded accounts on genesis' () { throw 'TODO' }
})

const withTmpFile = fn => {
  const {name} = tmp.fileSync()
  try {
    return fn(name)
  } finally {
    rimraf(name)
  }
}
```
