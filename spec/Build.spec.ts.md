# Building contracts from source

When deploying, Fadroma automatically builds the `Contract`s specified in the deployment,
using a procedure based on [secret-contract-optimizer](https://hub.docker.com/r/enigmampc/secret-contract-optimizer).

This either with your local Rust/WASM toolchain,
or in a pre-defined [build container](https://github.com/hackbg/fadroma/pkgs/container/fadroma).
The latter option requires Docker (which you also need for the devnet).

By default, optimized builds are output to the `wasm` subdirectory of your project.
Checksums of build artifacts are emitted as `wasm/*.wasm.sha256`: these checksums
should be equal to the code hashes returned by the chain.

We advise you to keep these
**build receipts** in version control. This gives you a quick way to keep track of the
correspondence between changes to source and resulting changes to code hashes.

Furthermore, when creating a `Project`, you'll be asked to define one or more `Template`s
corresponding to the contract crates of your project. You can

Fadroma implements **reproducible compilation** of contracts.
What to compile is specified using the primitives defined in [Fadroma Core](../client/README.md).

## Build CLI

```shell
$ fadroma build CONTRACT    # nop if already built
$ fadroma rebuild CONTRACT  # always rebuilds
```

  * **`CONTRACT`**: one of the contracts defined in the [project](../project/Project.spec.ts),
    *or* a path to a crate assumed to contain a single contract.

### Builder configuration

|env var|type|description|
|-|-|-|
|**`FADROMA_BUILD_VERBOSE`**|flag|more log output
|**`FADROMA_BUILD_QUIET`**|flag|less log output
|**`FADROMA_BUILD_SCRIPT`**|path to script|build implementation
|**`FADROMA_BUILD_RAW`**|flag|run the build script in the current environment instead of container
|**`FADROMA_DOCKER`**|host:port or socket|non-default docker socket address
|**`FADROMA_BUILD_IMAGE`**|docker image tag|image to run
|**`FADROMA_BUILD_DOCKERFILE`**|path to dockerfile|dockerfile to build image if missing
|**`FADROMA_BUILD_PODMAN`**|flag|whether to use podman instead of docker
|**`FADROMA_PROJECT`**|path|root of project
|**`FADROMA_ARTIFACTS`**|path|project artifact cache
|**`FADROMA_REBUILD`**|flag|builds always run, artifact cache is ignored

## Build API

* **BuildRaw**: runs the build in the current environment
* **BuildContainer**: runs the build in a container for enhanced reproducibility

### Getting a builder

```typescript
import { getBuilder } from '@hackbg/fadroma'
const builder = getBuilder(/* { ...options... } */)

import { Builder } from '@hackbg/fadroma'
assert(builder instanceof Builder)
```

#### BuildContainer

By default, you get a `BuildContainer`,
which runs the build procedure in a container
provided by either Docker or Podman (as selected
by the `FADROMA_BUILD_PODMAN` environment variable).

```typescript
import { BuildContainer } from '@hackbg/fadroma'
assert.ok(getBuilder({ raw: false }) instanceof BuildContainer)
```

`BuildContainer` uses [`@hackbg/dock`](https://www.npmjs.com/package/@hackbg/dock) to
operate the container engine.

```typescript
import * as Dokeres from '@hackbg/dock'
assert.ok(getBuilder({ raw: false }).docker instanceof Dokeres.Engine)
```

Use `FADROMA_DOCKER` or the `dockerSocket` option to specify a non-default Docker socket path.

```typescript
getBuilder({ raw: false, dockerSocket: 'test' })
```

The `BuildContainer` runs the build procedure defined by the `FADROMA_BUILD_SCRIPT`
in a container based on the `FADROMA_BUILD_IMAGE`, resulting in optimized WASM build artifacts
being output to the `FADROMA_ARTIFACTS` directory.

#### BuildRaw

If you want to execute the build procedure in your
current environment, you can switch to `BuildRaw`
by passing `raw: true` or setting `FADROMA_BUILD_RAW`.

```typescript
const rawBuilder = getBuilder({ raw: true })

import { BuildRaw } from '@hackbg/fadroma'
assert.ok(rawBuilder instanceof BuildRaw)
```

### Building a contract

Now that we've obtained a `Builder`, let's compile a contract from source into a WASM binary.

#### Building a named contract from the project

Building asynchronously returns `Template` instances.
A `Template` is an undeployed contract. You can upload
it once, and instantiate any number of `Contract`s from it.

```typescript
// Build a single contract

const contract_0 = await builder.build('fadroma-example-kv')
```

```typescript
// Build multiple contracts

const [contract_1, contract_2] = await builder.buildMany([
  'fadroma-example-admin',
  'fadroma-example-killswitch'
])
```

```typescript
// For built contracts, the following holds true:

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

#### Specifying a contract to build

The `Template` and `Contract` classes have the following properties for specifying the source:

|field|type|description|
|-|-|-|
|**`repository`**|Path or URL|Points to the Git repository containing the contract sources. This is all you need if your smart contract is a single crate.|
|**`workspace`**|Path or URL|Cargo workspace containing the contract sources. May or may not be equal to `contract.repo`. May be empty if the contract is a single crate.|
|**`crate`**|string|Name of the Cargo crate containing the individual contract source. Required if `contract.workspace` is set.|
|**`revision`**|string|Git reference (branch or tag). Defaults to `HEAD`, otherwise builds a commit from history.|

The outputs of builds are called **artifact**s, and are represented by two properties:

|field|type|description|
|-|-|-|
|**`artifact`**|URL|Canonical location of the compiled binary.|
|**`codeHash`**|string|SHA256 checksum of artifact. should correspond to **template.codeHash** and **instance.codeHash** properties of uploaded and instantiated contracts|

```typescript
import { Contract } from '@fadroma/agent'
const contract: Contract = new Contract({ builder, crate: 'fadroma-example-kv' })
await contract.compiled
```

```typescript
import { Template } from '@fadroma/agent'
const template = new Template({ builder, crate: 'fadroma-example-kv' })
await template.compiled
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
import { getGitDir, DotGit } from '@hackbg/fadroma'

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

## Implementation details

### The build procedure

The ultimate build procedure, i.e. actual calls to `cargo` and such,
is implemented in the standalone script `FADROMA_BUILD_SCRIPT` (default: `build.impl.mjs`),
which is launched by the builders.

### Builders

The subclasses of the abstract base class `Builder` in Fadroma Core
implement the compilation procedure for contracts.

### Build events

```typescript
import { Console } from '@hackbg/fadroma'
import { Contract } from '@fadroma/agent'
const log = new Console({ info: () => {} })
log.build.workspace('foo')
log.build.one(new Contract({ crate: 'bar' }))
log.build.one(new Contract({ crate: 'bar', revision: 'commit' }))
log.build.many([new Contract({ crate: 'bar' }), new Contract({ crate: 'bar', revision: 'commit' })])
```

---

```typescript
import assert from 'node:assert'
import { fileURLToPath } from 'url'
```
