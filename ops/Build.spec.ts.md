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
import { getBuilder } from '@fadroma/ops'
const builder = getBuilder(/* { ...options... } */)

import { Builder } from '@fadroma/ops'
assert(builder instanceof Builder)
```

By default, you get a `ContainerBuilder`,
which runs the build procedure in a container
provided by either Docker or Podman (as selected
by the `FADROMA_BUILD_PODMAN` environment variable).

```typescript
import { ContainerBuilder } from '@fadroma/ops'
assert.ok(builder instanceof ContainerBuilder)
```

If you want to execute the build procedure in your
current environment, you can switch to `RawBuilder`
by passing `buildRaw: true` or setting `FADROMA_BUILD_RAW`.

```typescript
const rawBuilder = getBuilder({ buildRaw: true })

import { RawBuilder } from '@fadroma/ops'
assert.ok(rawBuilder instanceof RawBuilder)
```

### Building a contract from the project

Building asynchronously returns `Template` instances.
A `Template` is an undeployed contract. You can upload
it once, and instantiate any number of `Contract`s from it.

```typescript
const contract_0 = await builder.build('fadroma-example-kv')

const [contract_1, contract_2] = await builder.buildMany([
  'fadroma-example-admin',
  'fadroma-example-killswitch'
])

for (const contract of [contract_0, contract_1, contract_2]) {

  // Build result will contain code hash and path to binary
  assert(typeof contract.codeHash === 'string')
  assert(contract.artifact instanceof URL)

  // As well as info about the source used
  for (const key of [ 'workspace', 'crate', 'revision' ]) {
    assert.ok(typeof contract[key] === 'string')
  }

}
```

### Specifying sources

```typescript
import { Contract } from '@fadroma/agent'
const contract: Contract = new Contract({ builder, crate: 'fadroma-example-kv' })
await contract.compiled

import { Template } from '@fadroma/agent'
const template = new Template({ builder, crate: 'fadroma-example-kv' })
await template.compiled
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

assert.throws(()=>getGitDir(new Contract()))

const contractWithSource = new Contract({
  repository: 'REPO',
  revision:   'REF',
  workspace:  'WORKSPACE'
  crate:      'CRATE'
})

assert.ok(getGitDir(contractWithSource) instanceof DotGit)
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

const containerBuilder = getBuilder({ buildRaw: false })

```

`ContainerBuilder` uses [`@hackbg/dock`](https://www.npmjs.com/package/@hackbg/dock) to
operate the container engine. Currently, `@hackbg/dock` supports Docker; soon it will
also support Podman.

```typescript
import * as Dokeres from '@hackbg/dock'

assert.ok(containerBuilder.docker instanceof Dokeres.Engine)
```

Use `FADROMA_DOCKER` to specify a non-default Docker socker path

```typescript
import { BuilderConfig } from '@fadroma/ops'
assert.ok(new BuilderConfig({ buildRaw: false, dockerSocket: 'test' }).getBuilder().docker
  instanceof Dokeres.Engine)
```

`ContainerBuilder` runs the build procedure defined by the `FADROMA_BUILD_SCRIPT`
in a container based on the `FADROMA_BUILD_IMAGE`, resulting in optimized WASM build artifacts
being output to the `FADROMA_ARTIFACTS` directory.

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

```
```

---

```typescript
import assert from 'node:assert'
import { fileURLToPath } from 'url'
```
