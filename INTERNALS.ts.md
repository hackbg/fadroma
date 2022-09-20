This is where the [testing](./TESTING.ts.md) gets heavy.

```typescript
import * as Fadroma from '@hackbg/fadroma'
import Testing from './TESTING.ts.md'
```

* Contract lifecycle on Amino

```typescript
console.info('full contract lifecycle')
await Testing.withMockAPIEndpoint(async endpoint => {
  const agent    = await new Fadroma.LegacyScrt('test', {url: endpoint.url}).getAgent({mnemonic: Testing.mnemonics[0]})
  const artifact = { url: $(Testing.fixture('empty.wasm')).url.toString(), codeHash: Testing.hashes['empty.wasm'] }
  const blob     = new Uint8Array(readFileSync(Testing.fixture('empty.wasm'), 'utf8'))
  const template = await agent.upload(blob)
  equal(artifact.codeHash, template.codeHash)
  equal(template.codeId,   1)
  const label    = `contract_deployed_by_${agent.name}`
  const instance = await agent.instantiate(template, label, {})
  const { address } = instance
  ok(address, 'init tx returns contract address')
  return
  console.debug(`test q ${address}`)
  throw new Error('TODO - how to decrypt/reencrypt query?')
  const queryResult = await agent.query({ address }, 'status')
  equal(queryResult, 'status')
  console.debug(`test tx ${address}`)
  const txResult = await agent.execute({ address }, 'tx', { option: "value" })
  deepEqual(txResult, {})
})
```

* Raw builder

```typescript
let ran
class TestRawBuilder extends Fadroma.RawBuilder { run = (...args) => ran.push(args) }
const buildScript    = Symbol()
const checkoutScript = Symbol()
builder = new TestRawBuilder(buildScript, checkoutScript)
const crate = 'empty'
const ref   = 'ref'
ran = []
const sourceFromHead   = { workspace, crate }
const templateFromHead = await builder.build(sourceFromHead)
deepEqual(ran, [[buildScript, []]])
ran = []
const sourceFromRef   = { workspace, crate, ref }
const templateFromRef = await builder.build(sourceFromRef)
deepEqual(ran, [[checkoutScript, [ref]], [buildScript, []]])
```

* Dockerized builder

```typescript
import { DockerBuilder } from '@hackbg/fadroma'
import { Dokeres, DokeresImage, mockDockerode } from '@hackbg/dokeres'
import { Transform } from 'stream'
class TestDockerBuilder extends DockerBuilder {
  prebuild (source) { return false }
}
class TestDokeresImage extends DokeresImage {
  async ensure () { return theImage }
}
const theImage  = Symbol()
source    = { workspace, crate }
ran       = []
const docker    = mockDockerode(({ run: [image, cmd, buildLogs, args] }) {
  equal(image, theImage)
  equal(cmd, `bash /build.sh HEAD empty`)
  ok(buildLogs instanceof Transform)
  equal(args.Tty, true)
  equal(args.AttachStdin: true)
  deepEqual(args.Entrypoint, [ '/bin/sh', '-c' ])
  ok(args.HostConfig.Binds instanceof Array)
  equal(args.HostConfig.AutoRemove, true)
})
image     = new Dokeres(docker).image(' ')
const script    = "build.sh"
const options   = { docker, image, script }
builder   = new TestDockerBuilder(options)

// build one
artifact  = await builder.build({ workspace, crate })
equal(artifact.location, resolve(workspace, 'artifacts/empty@HEAD.wasm'))
equal(artifact.codeHash, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')

// build many
artifacts = await builder.buildMany([
  { workspace, crate: 'crate1' }
  { workspace, ref: 'HEAD', crate: 'crate2' }
  { workspace, ref: 'asdf', crate: 'crate3' }
])
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

* Mode deployments

```typescript
// integrations
const prefixOfActiveDeployment = Symbol()
const context = {
  deployments: {
    async create () {},
    async select () {},
    get () {},
    active: { prefix: prefixOfActiveDeployment, receipts: [] },
    printActive () {},
    list () { return [
      {prefix: '.active.yml'},
      {prefix: prefixOfActiveDeployment},
      {prefix:'somethingelse'}]
    },
  }
}
console.log({Deploy})
await Deploy.getOrCreate(context)
const { deployment, prefix } = await Deploy.get(context)
equal(deployment, context.deployments.active)
equal(prefix,     context.deployments.active.prefix)
await Deploy.status(context)
await Deploy.status(context)
```

* Chain-specific devnet handles

```typescript
import { getScrtDevnet } from '@hackbg/fadroma'
for (const version of ['1.2', '1.3']) {
  continue
  throw new Error('TODO')
  const dokeres = new Dokeres(mockDockerode(({ createContainer })=>{
    if (createContainer) {
      const stream = {
        on  (arg, cb) { if (arg === 'data') { cb(readyPhrase) } },
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
}
```
