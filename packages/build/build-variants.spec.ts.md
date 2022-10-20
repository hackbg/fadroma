# Fadroma Builder Implementations

```typescript
import { ok, equal } from 'node:assert'
```

The subclasses of the abstract base class `Builder` in Fadroma Core
implement the compilation procedure for contracts.

```typescript
import { BuilderConfig, Builder } from '@fadroma/build'
let config:  BuilderConfig
let builder: Builder
```

When inheriting from the `Fadroma` class, a `Builder` should be automatically
provided, in accordance with the automatically populated `BuildConfig`. Internally/manually, this
is done by the `getBuilder` method of a builder config.

## Docker builder

`DockerBuilder` is the default builder. It provides a basic degree of reproducibility
by using a pre-defined build container.

```typescript
import { DockerBuilder } from '@fadroma/build'
ok(new BuilderConfig().getBuilder() instanceof DockerBuilder)
```

  * DockerBuilder launches the [**build script**](./build.impl.mjs)
    in a Docker container using [`@hackbg/dokeres`](https://www.npmjs.com/package/@hackbg/dokeres).
    You can set the following properties:
      * **builder.dockerSocket** (at construction only) allows you to select
        the Docker server to connect to.
      * **builder.docker** lets you configure the entire instance of `Dokeres.Engine`.

```typescript
import * as Dokeres from '@hackbg/dokeres'
ok(new DockerBuilder().docker instanceof Dokeres.Engine)
//ok(typeof new DockerBuilder({ docker: Symbol() }).docker === 'symbol')
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
// Mocks:
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
equal(fileURLToPath(artifact), builder.outputDir.at(`${crate}@HEAD.wasm`).path)
equal(codeHash, 'code hash ok')
```

Building multiple contracts:

```typescript
ok(await builder.buildMany([
  { workspace, crate: 'crate1' }
  { workspace, crate: 'crate2', revision: 'HEAD' }
  { workspace, crate: 'crate3', revision: 'asdf' }
]))
```

## Raw builder

Where Docker is unavailable (e.g. in a CI that is already running in containers),
you can use **RawBuilder** to just run builds in the host environment.

  * It is enabled by setting `FADROMA_BUILD_RAW=1` in the environment,
    or by setting `buildRaw` to `true` in the `BuildConfig`.

```typescript
import { RawBuilder } from '@fadroma/build'
config.buildRaw = true
builder = config.getBuilder()
ok(builder instanceof RawBuilder)
```

  * It still uses the same build script as DockerBuilder, but instead of a container
    it just runs the build script as a subprocess.

```typescript
// Mocks:
builder.spawn     = () => ({ on (event, callback) { callback(0) } })
builder.hashPath  = () => 'code hash ok'
builder.prebuilt  = () => false
builder.fetch     = () => Promise.resolve()
builder.getGitDir = () => ({ present: true })
```

  * When using the RawBuilder, you're responsible for providing a working Rust toolchain
    in its runtime environment, build reproducibility is dependent on the consistency of
    that environment.

```typescript
ok(await builder.build({ workspace, crate }))
ok(await builder.buildMany([
  { workspace, crate: 'crate1' }
  { workspace, crate: 'crate2', revision: 'HEAD' }
  { workspace, crate: 'crate3', revision: 'asdf' }
]))
```
