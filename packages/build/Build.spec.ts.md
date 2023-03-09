# Building contracts from source

This package implements **reproducible compilation** of contracts.
What to compile is specified using the primitives defined in [Fadroma Core](../client/README.md).

> Run tests with `pnpm test`.
> Measure coverage with `pnpm cov`.[^1]
> Publish with `pnpm ubik`.
> [^1]: Note that stack traces output by `pnpm cov` coverage mode point to line numbers in
>       the compiled code. This is to get correct line numbers in the coverage report.
>       To get the same stack trace with correct line numbers, run `pnpm test`.

It defines the following entities:

## [Base build logic](./build-base.spec.ts.md)

* `BuilderConfig`: configure build environment
  from environment variables. Uses `@hackbg/conf`.
* `LocalBuilder`: base class for compiling contracts
  on the developer's workstation.
  * Implements basic **build caching**: existing build artifacts are reused.
    Invalidation is manual (delete artifact to rebuild).

* **WIP:** `RemoteBuilder`: base class for compiling
  contracts using remote resources.

```typescript
import './build-base.spec.ts.md'
```

## [Builder variants](./build-variants.spec.ts.md)

* `build.impl.js`, the build script
  * `RawBuilder`, which runs it using the local Rust toolchain.
  * `DockerBuilder`, which runs it in a Docker container

```typescript
import './build-variants.spec.ts.md'
```

## [Build from Git history](./build-history.spec.ts.md)

* `DotGit`, a helper for finding the contents of Git history
  where Git submodules are involved. This works in tandem with
  `build.impl.mjs` to enable:
  * **building any commit** from a project's history, and therefore
  * **pinning versions** for predictability during automated one-step deployments.

```typescript
import './build-history.spec.ts.md'
```

## [Build errors and event logging](./build-events.spec.ts.md)

```typescript
import './build-events.spec.ts.md'
```

## WIP: Build CLI

The `buildCrates` entrypoint and `fadroma-build` command
are to be considered **unstable**.

```typescript
// import './build.cli.spec.ts.md'
```
```typescript
import * as Testing from '../../TESTING.ts.md'
import * as Fadroma from '@fadroma/core'
import $ from '@hackbg/file'
import assert, { ok, equal, deepEqual, throws } from 'assert'
```

## Specifying projects and sources

The `ContractSource` class has the following properties for specifying the source.
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
import { ContractSource } from '@fadroma/core'

const contract = new ContractSource({
  repository: 'REPO',
  revision:   'REF',
  workspace:  'WORKSPACE'
  crate:      'CRATE'
})

equal(contract.repository, 'REPO')
equal(contract.revision,   'REF')
equal(contract.workspace,  'WORKSPACE')
equal(contract.crate,      'CRATE')
```

## Build caching

When **builder.caching == true**, each build call first checks in `./artifacts`
for a corresponding pre-existing build and reuses it if present.

* Set the `FADROMA_REBUILD` environment variable to bypass this behavior.

```typescript
// TODO example
```
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
    in a Docker container using [`@hackbg/dock`](https://www.npmjs.com/package/@hackbg/dock).
    You can set the following properties:
      * **builder.dockerSocket** (at construction only) allows you to select
        the Docker server to connect to.
      * **builder.docker** lets you configure the entire instance of `Dokeres.Engine`.

```typescript
import * as Dokeres from '@hackbg/dock'
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
# How contracts are built

```typescript
import assert from 'node:assert'
```

## The `ContractSource` class

Represents the source code of a contract.
  * Compiling a source populates the `artifact` property.
  * Uploading a source creates a `ContractTemplate`.

```typescript
import { ContractSource } from '@fadroma/core'
let source: ContractSource = new ContractSource()
let builder = { build: async x => x }
assert.ok(await source.define({ builder }).compiled)
```

## Building from history

```typescript
import { ok, throws } from 'node:assert'
```

If `.git` directory is present, builders can check out and build a past commits of the repo,
as specifier by `contract.revision`.

```typescript
import { ContractSource } from '@fadroma/core'
import { getGitDir, DotGit } from '@fadroma/build'

throws(()=>getGitDir(new ContractSource()))

const contractWithSource = new ContractSource({
  repository: 'REPO',
  revision:   'REF',
  workspace:  'WORKSPACE'
  crate:      'CRATE'
})

ok(getGitDir(contractWithSource) instanceof DotGit)
```
# Fadroma Core Spec: Contract code handling

```typescript
import assert from 'node:assert'
const contract = { address: 'addr' }
const agent = { getHash: async x => 'hash', getCodeId: async x => 'id' }
```

## Code ids

The code ID is a unique identifier for compiled code uploaded to a chain.

```typescript
import { fetchCodeId } from '@fadroma/core'

assert.ok(await fetchCodeId(contract, agent))
assert.ok(await fetchCodeId(contract, agent, 'id'))
assert.rejects(fetchCodeId(contract, agent, 'unexpected'))
```

## Code hashes

The code hash also uniquely identifies for the code that underpins a contract.
However, unlike the code ID, which is opaque, the code hash corresponds to the
actual content of the code. Uploading the same code multiple times will give
you different code IDs, but the same code hash.

```typescript
import { fetchCodeHash, assertCodeHash, codeHashOf } from '@fadroma/core'

assert.ok(assertCodeHash({ codeHash: 'hash' }))
assert.throws(()=>assertCodeHash({}))

assert.ok(await fetchCodeHash(contract, agent))
assert.ok(await fetchCodeHash(contract, agent, 'hash'))
assert.rejects(fetchCodeHash(contract, agent, 'unexpected'))

assert.equal(codeHashOf({ codeHash: 'hash' }), 'hash')
assert.equal(codeHashOf({ code_hash: 'hash' }), 'hash')
assert.throws(()=>codeHashOf({ code_hash: 'hash1', codeHash: 'hash2' }))
```

### ICC structs

```typescript
import { templateStruct, linkStruct } from '@fadroma/core'
assert.deepEqual(
  templateStruct({ codeId: '123', codeHash: 'hash'}),
  { id: 123, code_hash: 'hash' }
)
assert.deepEqual(
  linkStruct({ address: 'addr', codeHash: 'hash'}),
  { address: 'addr', code_hash: 'hash' }
)
```

