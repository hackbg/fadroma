# Fadroma Builder Implementations

```typescript
import { ok, equal } from 'node:assert'
```

When implementing your deployer by inheriting from the `Fadroma` class,
a `Builder` should be automatically provided in accordance with the
automatically populated `BuildConfig`.

```typescript
import { BuilderConfig, Builder } from '@fadroma/build'
let config:  BuilderConfig
let builder: Builder
```

Internally, this happens by calling the `getBuilder` method of `BuilderConfig`.

The actual builder is a subclass of the `Builder` abstract base class
defined in Fadroma Core. It may be one of the following:

## Docker Builder

`DockerBuilder` is the default builder.

```typescript
import { DockerBuilder } from '@fadroma/build'
ok(new BuilderConfig().getBuilder() instanceof DockerBuilder)
```

It provides a basic degree of reproducibility by using a pre-defined build container.

  * DockerBuilder launches the [**build script**](./build.impl.mjs)
    in a Docker container using [`@hackbg/dokeres`](https://www.npmjs.com/package/@hackbg/dokeres).
    You can set the following properties:
      * **builder.dockerSocket** (at construction only) allows you to select
        the Docker server to connect to.
      * **builder.docker** lets you configure the entire instance of `Dokeres.Engine`.

```typescript
import * as Dokeres from '@hackbg/dokeres'
ok(new DockerBuilder().docker instanceof Dokeres.Engine)
ok(typeof new DockerBuilder({ docker: Symbol() }).docker === 'symbol')
ok(new DockerBuilder({ dockerSocket: "test" }).docker instanceof Dokeres.Engine)
```

  * DockerBuilder comes with default **build image** and **Dockerfile**,
    which can be overridden by setting the following properties:
    * **builder.image** is the build image to use (`hackbg/fadroma` by default)
    * **builder.dockerfile** is a path to a Dockerfile to build **builder.image** if it can't be pulled.

```typescript
config  = new BuilderConfig()
builder = config.getBuilder()
equal(builder.image.name, config.dockerImage)
equal(builder.dockerfile, config.dockerfile)
```

Let's mock out the build image and the stateful methods to simplify the test:

```typescript
builder.image        = new Dokeres.Engine().image('test/build:image')
builder.image.ensure = async () => true
builder.image.run    = async () => ({ wait: () => Promise.resolve({StatusCode: 0}) })
builder.hashPath     = () => 'code hash ok'
builder.prebuilt     = () => false
builder.fetch        = () => Promise.resolve()
```

Now, let's build a contract:

```typescript
import { resolve } from 'path'
import { fileURLToPath } from 'url'
const workspace = '/tmp/fadroma-test'
const crate     = 'crate'
let { artifact, codeHash } = await builder.build({ workspace, crate })
console.log({builder})
equal(fileURLToPath(artifact), builder.outputDir.at(`${crate}@HEAD.wasm`).path)
equal(codeHash, 'code hash ok')
```

Building multiple contracts:

```typescript
ok(await builder.buildMany([
  { workspace, crate: 'crate1' }
  { workspace, ref: 'HEAD', crate: 'crate2' }
  { workspace, ref: 'asdf', crate: 'crate3' }
]))
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
artifact = new URL('file:///path/to/project/artifacts/crate-1@HEAD.wasm')

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
