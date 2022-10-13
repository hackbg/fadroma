# Fadroma Builder Implementations

```typescript
import { ok, equal } from 'node:assert'
```

## Docker Builder

**DockerBuilder** (the default) launches the [**build script**](./build.impl.mjs)
in Docker container provided by [`@hackbg/dokeres`](https://www.npmjs.com/package/@hackbg/dokeres).

* DockerBuilder comes with default **build image** and **Dockerfile**,
  which can be overridden:
  * **builder.image** is the build image to use (`hackbg/fadroma`)
  * **builder.dockerfile** is a path to a Dockerfile to build **builder.image** if it can't be pulled.

```typescript
import { BuilderConfig, Builder } from '@fadroma/build'
let config: BuilderConfig = new BuilderConfig()
let builder: Builder = config.getBuilder()

import { DockerBuilder } from '@fadroma/build'
ok(builder instanceof DockerBuilder)
equal(builder.image.name, config.dockerImage)
equal(builder.dockerfile, config.dockerfile)

import * as Dokeres from '@hackbg/dokeres'
ok(builder.docker instanceof Dokeres.Engine)

import { Dokeres, mockDockerode } from '@hackbg/dokeres'
import { Transform } from 'stream'
class TestDockerBuilder extends DockerBuilder {
  prebuild (source) { return false }
}
class TestDokeresImage extends Dokeres.Image {
  async ensure () { return theImage }
}
const theImage  = Symbol('the build image')
const workspace = Symbol('the source workspace')
const crate = Symbol('the crate to build')
const source = { workspace, crate }
let ran = []
const docker = mockDockerode(({ run: [theImage, cmd, buildLogs, args] }) {
  equal(image, theImage)
  equal(cmd, `bash /build.sh HEAD empty`)
  ok(buildLogs instanceof Transform)
  equal(args.Tty, true)
  equal(args.AttachStdin: true)
  deepEqual(args.Entrypoint, [ '/bin/sh', '-c' ])
  ok(args.HostConfig.Binds instanceof Array)
  equal(args.HostConfig.AutoRemove, true)
})
image = new Dokeres.Engine(docker).image(' ')
const script = "build.sh"
const options = { docker, image: theImage, script }
builder = new TestDockerBuilder(options)

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

## Raw Builder

**RawBuilder** (enabled by `FADROMA_BUILD_RAW=1`) runs builds in host environment.

* RawBuilder launches the [**build script**](./build.impl.mjs) in a subprocess.
  By default, the interpreter is the same version of Node that is running Fadroma.

```typescript
import { RawBuilder } from '@fadroma/build'
ok(new BuilderConfig({ buildRaw: true }).getBuilder() instanceof RawBuilder)
class TestRawBuilder Fadroma.RawBuilder { run = (...args) => ran.push(args) }
const buildScript    = Symbol()
const checkoutScript = Symbol()
builder = new TestRawBuilder(buildScript, checkoutScript)
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

# Getting and configuring builders

The subclasses of **Builder** perform the builds of the specified **Source**s.
You can obtain a **Builder** instance using **getBuilder(config: BuilderConfig)**.

```typescript
```

The outputs of builds are called **artifact**s, and are represented by two properties
of **Template**:
  * **template.artifact** points to the canonical location of the artifact.
  * **template.codeHash** is a SHA256 checksum of the artifact, which should correspond
    to the **template.codeHash** and **instance.codeHash** properties of uploaded and
    instantiated contracts.

```typescript
builder = new BuildConfig().getBuilder()

import { DockerBuilder } from '.'
ok(builder instanceof DockerBuilder)
equal(builder.image.name, DockerBuilder.image)
equal(builder.dockerfile, DockerBuilder.dockerfile)

import * as Dokeres from '@hackbg/dokeres'
ok(builder.docker instanceof Dokeres.Engine)
```

* Let's create a DockerBuilder and a RawBuilder with mocked values and try them out:

```typescript
const artifact: URL = new URL('file:///path/to/project/artifacts/crate-1@HEAD.wasm')

const builders = [
  new BuildConfig({
    docker:     Dokeres.Engine.mock(),
    dockerfile: '/path/to/a/Dockerfile',
    image:      'my-custom/build-image:version'
  }).getBuilder(),
  new BuildConfig({
    buildRaw: true
  }).getBuilder(),
  new class TestBuilder1 extends Fadroma.Builder {
    async build (source: Source): Promise<Template> {
      return { location: '', codeHash: '', source }
    }
  }
]

// mock out code hash function
builders[0].hashPath = () => 'sha256'
builders[1].hashPath = () => 'sha256'

// mock out runtime in raw builder
import { execSync } from 'child_process'
builders[1].runtime = String(execSync('which true')).trim()

const contractFromHead = contractWithSource.define({ revision: 'HEAD' })

for (const builder of builders) {
  const source   = contractFromHead.define({ crate: 'foo' })
  const template = await builder.build(source)
  //equal(template.crate,    source.crate)
  //equal(template.codeHash, 'sha256')
}

for (const builder of builders) {
  const sources = [
    contractFromHead.define({ crate: 'crate-1' }),
    contractFromHead.define({ crate: 'crate-2' })
  ]
  const compiled = await builder.buildMany(sources)
  ok(compiled, 'buildMany')
}
```

## Build caching

* When **builder.caching == true**, each build call first checks in `./artifacts`
  for a corresponding pre-existing build and reuses it if present.

```typescript
equal(typeof new BuildConfig().getBuilder().caching, 'boolean')
```

## Build caching

The `LocalBuilder` abstract class makes sure that,
if a compiled artifact for the requested build
already exists in the project's `artifacts` directory,
the build is skipped.

Set the `FADROMA_REBUILD` environment variable to bypass this behavior.

```typescript
import { LocalBuilder } from '.'
builder = new class TestLocalBuilder extends LocalBuilder {
  async build (source) { return {} }
}
//await assert.throws(()=>builder.prebuild({}))
equal(builder.prebuild('', 'empty'), null)
```
