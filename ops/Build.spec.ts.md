# Building contracts from source

This package implements **reproducible compilation** of contracts.
What to compile is specified using the primitives defined in [Fadroma Core](../client/README.md).

## Build CLI

```shell
$ fadroma build CONTRACT    # nop if already built
$ fadroma rebuild CONTRACT  # always rebuilds
```

  * **`CONTRACT`**: one of the contracts defined in the [project](../project/Project.spec.ts),
    *or* a path to a crate assumed to contain a single contract.

### Builder configuration

|environment variable|kind|description|
|-|-|-|
|`FADROMA_BUILD_VERBOSE`|flag|more log output
|`FADROMA_BUILD_QUIET`|flag|less log output
|`FADROMA_BUILD_SCRIPT`|path to script|build implementation
|`FADROMA_BUILD_RAW`|flag|run the build script in the current environment instead of container
|`FADROMA_DOCKER`|host:port or socket|non-default docker socket address
|`FADROMA_BUILD_IMAGE`|docker image tag|image to run
|`FADROMA_BUILD_DOCKERFILE`|path to dockerfile|dockerfile to build image if missing
|`FADROMA_BUILD_PODMAN`|flag|whether to use podman instead of docker
|`FADROMA_PROJECT`|path|root of project
|`FADROMA_ARTIFACTS`|path|project artifact cache
|`FADROMA_REBUILD`|flag|builds always run, artifact cache is ignored

## Build API

### Getting a builder

```typescript
import { getBuilder, Builder } from '@fadroma/ops'
const builder = getBuilder(/* { ...options... } */)

assert(builder instanceof Builder)
```

### Building

Building asynchronously returns `Template` instances.
A `Template` is an undeployed contract. You can upload
it once, and instantiate any number of `Contract`s from it.

```typescript
const contract_0 = await builder.build('contract_0')

const [contract_1, contract_2] = await builder.buildMany([
  'contract_1',
  'contract_2'
])

import { Template } from '@fadroma/agent'
assert(contract_0 instanceof Template)
assert(contract_1 instanceof Template)
assert(contract_2 instanceof Template)
```

### Specifying sources

Represents the source code of a contract.
  * Compiling a source populates the `artifact` property.
  * Uploading a source creates a `Template`.

```typescript
import { Contract } from '@fadroma/agent'
let source: Contract = new Contract()
assert.ok(await source.define({ builder: { build: async x => x } }).compiled)
```

The `Contract` class has the following properties for specifying the source.
Use `contract.define({ key: value })` to define their values.
This returns a new copy of `contract` without modifying the original one.

* `repository: Path|URL` points to the Git repository containing the contract sources.
  * This is all you need if your smart contract is a single crate.
* `revision: string` can points to a Git reference (branch or tag).
  * This defaults to `HEAD`, i.e. the currently checked out working tree
  * If set to something else, the builder will check out and build a past commit.
* `workspace: Path|URL` points to the Cargo workspace containing the contract sources.
  * This may or may not be equal to `contract.repo`,
  * This may be empty if the contract is a single crate.
* `crate: string` points to the Cargo crate containing the individual contract source.
  * If `contract.workspace` is set, this is required.

The outputs of builds are called **artifact**s, and are represented by two properties:
  * `artifact: URL` points to the canonical location of the artifact.
  * `codeHash: string` is a SHA256 checksum of the artifact, which should correspond
    to the **template.codeHash** and **instance.codeHash** properties of uploaded and
    instantiated contracts.

```typescript
import { Contract } from '@fadroma/agent'

const contract = new Contract({
  repository: 'REPO',
  revision: 'REF',
  workspace: 'WORKSPACE'
  crate: 'CRATE'
})

equal(contract.repository, 'REPO')
equal(contract.revision,   'REF')
equal(contract.workspace,  'WORKSPACE')
equal(contract.crate,      'CRATE')
```

```typescript
import assert from 'node:assert'
import * as Fadroma from '@fadroma/agent'
import $ from '@hackbg/file'
```

### Building past commits of contracts

* `DotGit`, a helper for finding the contents of Git history
  where Git submodules are involved. This works in tandem with
  `build.impl.mjs` to enable:
  * **building any commit** from a project's history, and therefore
  * **pinning versions** for predictability during automated one-step deployments.

If `.git` directory is present, builders can check out and build a past commits of the repo,
as specifier by `contract.revision`.

```typescript
import { Contract } from '@fadroma/agent'
import { getGitDir, DotGit } from '@fadroma/ops'

throws(()=>getGitDir(new Contract()))

const contractWithSource = new Contract({
  repository: 'REPO',
  revision:   'REF',
  workspace:  'WORKSPACE'
  crate:      'CRATE'
})

ok(getGitDir(contractWithSource) instanceof DotGit)
```

### Build caching

When build caching is enabled, each build call first checks in `FADROMA_ARTIFACTS`
for a corresponding pre-existing build and reuses it if present.

Setting `FADROMA_REBUILD` disables build caching.

### The build procedure

The ultimate build procedure, i.e. actual calls to `cargo` and such,
is implemented in the standalone script `FADROMA_BUILD_SCRIPT` (default: `build.impl.mjs`),
which is launched by the builders.

### Builders

The subclasses of the abstract base class `Builder` in Fadroma Core
implement the compilation procedure for contracts.

#### ContainerBuilder

`ContainerBuilder` is the default builder when the `FADROMA_BUILD_RAW` option is not set.

```typescript
import { ContainerBuilder } from '@fadroma/ops'

const containerBuilder = getBuilder({ buildRaw: false })

ok(containerBuilder instanceof ContainerBuilder)
```

`ContainerBuilder` uses [`@hackbg/dock`](https://www.npmjs.com/package/@hackbg/dock) to
operate the container engine. Currently, `@hackbg/dock` supports Docker; soon it will
also support Podman.

```typescript
import * as Dokeres from '@hackbg/dock'

ok(containerBuilder.docker instanceof Dokeres.Engine)
```

Use `FADROMA_DOCKER` to specify a non-default Docker socker path

```typescript
ok(new BuilderConfig({ buildRaw: false, dockerSocket: 'test' }).getBuilder().docker
  instanceof Dokeres.Engine)
```

`ContainerBuilder` runs the build procedure defined by the `FADROMA_BUILD_SCRIPT`
in a container based on the `FADROMA_BUILD_IMAGE`, resulting in optimized WASM build artifacts
being output to the `FADROMA_ARTIFACTS` directory.

```typescript
```

If it's not possible to pull the `FADROMA_BUILD_IMAGE`,
it is built from the `FADROMA_BUILD_DOCKERFILE`.

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

#### RawBuilder

Where Docker is unavailable (e.g. in a CI that is already running in containers),
you can use **RawBuilder** to just run builds in the host environment.

  * It is enabled by setting `FADROMA_BUILD_RAW=1` in the environment,
    or by setting `buildRaw` to `true` in the `BuildConfig`.

```typescript
import { RawBuilder } from '@fadroma/ops'

const rawBuilder = getBuilder({ buildRaw: true })

ok(rawBuilder instanceof RawBuilder)
```

It still uses the same build script as ContainerBuilder, but instead of a container
it just runs the build script as a subprocess.

When using the RawBuilder, you're responsible for providing a working Rust toolchain
in its runtime environment, build reproducibility is dependent on the consistency of
that environment.

```typescript
import { mockBuilder } from './mocks'
mockBuilder(rawBuilder)
ok(await rawBuilder.build({ workspace, crate }))
ok(await rawBuilder.buildMany([
  { workspace, crate: 'crate1' }
  { workspace, crate: 'crate2', revision: 'HEAD' }
  { workspace, crate: 'crate3', revision: 'asdf' }
]))
```

  * `RawBuilder`, which runs it using the local Rust toolchain.

## Build events

```typescript
import { BuildConsole } from '@fadroma/ops'
import { Contract } from '@fadroma/agent'
const log = new BuildConsole({ info: () => {} })
log.buildingFromCargoToml('foo')
log.buildingFromBuildScript('foo')
log.buildingFromWorkspace('foo')
log.buildingOne(new Contract({ crate: 'bar' }))
log.buildingOne(new Contract({ crate: 'bar', revision: 'commit' }))
log.buildingOne(
  new Contract({ crate: 'bar', revision: 'commit' }),
  new Contract({ crate: 'bar', revision: 'commit' })

log.buildingMany([
  new Contract({ crate: 'bar' }),
  new Contract({ crate: 'bar', revision: 'commit' })
])
```

## Build errors
