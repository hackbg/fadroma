# Fadroma Build Spec

```typescript
import * as Testing from '../../TESTING.ts.md'
import * as Fadroma from '@fadroma/client'
import $ from '@hackbg/kabinet'
import assert, { ok, equal, deepEqual, throws } from 'assert'

const contract = new Fadroma.Contract({
  repo:      '/tmp/fadroma-test',
  workspace: '/tmp/fadroma-test'
})
```

## Build function

```typescript
import { build } from '.'
await build(['crate'], undefined, undefined, { buildMany: x => x })
```

## Build tasks

These are similar to the deploy tasks but don't need access to any chain
(because they don't upload or instantiate).

```typescript
import { BuildContext } from '.'
const buildTask: BuildContext = new BuildContext()
ok(buildTask.builder instanceof Fadroma.Builder)

// mock out:
buildTask.builder = { async build () { return {} } }
buildTask.exit    = () => {}
buildTask.project = '.'

ok(buildTask.contract() instanceof Fadroma.Contract,
  'define a contract to build')
ok(buildTask.contract({ crate: 'kv', builderId: 'local' }).build() instanceof Promise,
  'build is asynchronous')
ok(await buildTask.buildFromPath($('examples/kv'), []) ?? true,
   'build from directory')
ok(await buildTask.buildFromPath($('examples/kv/Cargo.toml'), []) ?? true,
   'build from file: Cargo.toml')
ok(await buildTask.buildFromPath($('packages/build/build.example.ts'), ['kv']) ?? true,
   'build from file: build script')
```

### Build messages

WIP: Convert all status outputs from build module to semantic logs.

```typescript
import { Contract } from '@fadroma/client'
import { BuildConsole } from '.'
const log = new BuildConsole({ info: () => {} })
log.buildingFromCargoToml('foo')
log.buildingFromBuildScript('foo')
log.buildingFromWorkspace('foo')
log.buildingOne(contract.define({ crate: 'bar' }))
log.buildingOne(contract.define({ crate: 'bar', revision: 'commit' }))
log.buildingOne(contract.define({ crate: 'bar', revision: 'commit' }), contract)
log.buildingMany([
  contract.define({ crate: 'bar' }),
  contract.define({ crate: 'bar', revision: 'commit' })
])
```

## Specifying projects and sources

The `Contract` class has the following properties for specifying the source.
Use `contract.define({ key: value })` to define their values.
This returns a new copy of `contract` without modifying the original one.

* `contract.repository: Path|URL` points to the Git repository containing the contract sources.
  * This is all you need if your smart contract is a single crate.
* `contract.revision: string` can points to a Git reference (branch or tag).
  * This defaults to `HEAD`, i.e. the currently checked out working tree
  * If set to something else, the builder will check out and build a past commit.
* `contract.workspace: Path|URL` points to the Cargo workspace containing the contract sources.
  * This may or may not be equal to `contract.repo`,
  * This may be empty if the contract is a single crate.
* `contract.crate: string` points to the Cargo crate containing the individual contract source.
  * If `contract.workspace` is set, this is required.

```typescript
import { HEAD } from '.'
const contractWithSource = contract.define({
  repository: 'REPO',
  revision:   'REF',
  workspace:  'WORKSPACE'
  crate:      'CRATE'
})
equal(contractWithSource.repository, 'REPO')
equal(contractWithSource.revision,   'REF')
equal(contractWithSource.workspace,  'WORKSPACE')
equal(contractWithSource.crate,      'CRATE')
equal(contract.revision, 'HEAD')
```

### The `.git` directory

If `.git` directory is present, builders can check out and build a past commits of the repo,
as specifier by `contract.revision`.

```typescript
import { getGitDir, DotGit } from '.'
throws(()=>getGitDir(contract))
ok(getGitDir(contractWithSource) instanceof DotGit)
```

# Getting and configuring builders

The subclasses of **Builder** perform the builds of the specified **Source**s.
You can obtain a **Builder** instance using **getBuilder(config: BuilderConfig)**.

```typescript
let builder: Fadroma.Builder
```

The outputs of builds are called **artifact**s, and are represented by two properties
of **Template**:
  * **template.artifact** points to the canonical location of the artifact.
  * **template.codeHash** is a SHA256 checksum of the artifact, which should correspond
    to the **template.codeHash** and **instance.codeHash** properties of uploaded and
    instantiated contracts.

* **DockerBuilder** (the default) launches the [**build script**](./build.impl.mjs)
  in Docker container provided by [`@hackbg/dokeres`](https://www.npmjs.com/package/@hackbg/dokeres).
  * DockerBuilder comes with default **build image** and **Dockerfile**,
    which can be overridden:
    * **builder.image** is the build image to use (`hackbg/fadroma`)
    * **builder.dockerfile** is a path to a Dockerfile to build **builder.image** if it can't be pulled.

```typescript
import { getBuilder } from '.'
builder = getBuilder()

import { DockerBuilder } from '.'
ok(builder instanceof DockerBuilder)
equal(builder.image.name, DockerBuilder.image)
equal(builder.dockerfile, DockerBuilder.dockerfile)

import * as Dokeres from '@hackbg/dokeres'
ok(builder.docker instanceof Dokeres.Engine)
```

* **RawBuilder** (enabled by `FADROMA_BUILD_RAW=1`) runs builds in host environment.
  * RawBuilder launches the [**build script**](./build.impl.mjs) in a subprocess.
  * By default, the interpreter is the same version of Node that is running Fadroma.

```typescript
import { RawBuilder } from '.'
ok(getBuilder({ buildRaw: true }) instanceof RawBuilder)
```

* Let's create a DockerBuilder and a RawBuilder with mocked values and try them out:

```typescript
const artifact: URL = new URL('file:///path/to/project/artifacts/crate-1@HEAD.wasm')

const builders = [
  getBuilder({
    docker:     Dokeres.Engine.mock(),
    dockerfile: '/path/to/a/Dockerfile',
    image:      'my-custom/build-image:version'
  }),
  getBuilder({
    buildRaw: true
  }),
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
equal(typeof getBuilder().caching, 'boolean')
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
