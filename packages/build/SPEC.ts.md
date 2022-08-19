# Fadroma Build Spec

```typescript
import * as Testing from '../../TESTING.ts.md'
import assert, { ok, equal, deepEqual } from 'assert'
```

# Specifying projects and sources

A **Workspace** object points to the root of a project's [Cargo workspace](https://doc.rust-lang.org/book/ch14-03-cargo-workspaces.html)
  * [ ] TODO: Test with non-workspace project.

```typescript
import { Workspace, DotGit } from '@fadroma/build'
let workspace: Workspace
const project = '/path/to/project'
```

* A Workspace object can also point to a specific Git reference
  (**workspace.ref**, defaults to `HEAD`, i.e. the working tree).
* **workspace.at('ref')**. returns a *new* Workspace with the same path and new ref.

```typescript
workspace = new Workspace(project)
deepEqual(workspace.at('my-branch'), new Workspace(project, 'my-branch'))
```

* If the `.git` directory (represented as **workspace.gitDir**) exists, this allows
  the builder to check out and build a past commit of the repo (the one specified by
  **workspace.ref**), instead of building from the working tree.

```typescript
import { DotGit } from '@fadroma/build'
assert(workspace.gitDir instanceof DotGit)
```

A **Source** object points to a crate in a **Workspace**.

```typescript
let source: Source
```

* Given a **Workspace**, call **workspace.crate('my-crate')** to get a **Source** object
  representing a crate in that workspace.
* Use **workspace.crates(['crate-1', 'crate-2'])** to get multiple crates.

```typescript
source = workspace.crate('crate-1')
deepEqual(workspace.crates(['crate-1', 'crate-2'])[0], source)
```

# Getting and configuring builders

The subclasses of **Builder** perform the builds of the specified **Source**s.
You can obtain a **Builder** instance using **getBuilder(config: BuilderConfig)**.

```typescript
import { Builder, getBuilder } from '@fadroma/build'
let builder: Builder
```

The outputs of builds are called **Artifact**s. They have the following properties:
  * **artifact.url** points to the canonical location of the artifact.
  * **artifact.source** points to the **Source** from which this was built.
  * **artifact.codeHash** is a SHA256 checksum of the artifact, which should correspond
    to the **template.codeHash** and **instance.codeHash** properties of uploaded and
    instantiated contracts.

```typescript
import { Artifact } from '@fadroma/build'
let artifact: Artifact
```

* **DockerBuilder** (the default) runs builds in Docker container
  using [`@hackbg/dokeres`](https://www.npmjs.com/package/@hackbg/dokeres).

```typescript
import { DockerBuilder } from '@fadroma/build'
import { Dokeres } from '@hackbg/dokeres'
builder = getBuilder()
ok(builder instanceof DockerBuilder)
ok(builder.docker instanceof Dokeres)
```

* The Docker builder comes with default **build image** and **Dockerfile**,
  which can be overridden:
  * **builder.image** is the build image to use (`hackbg/fadroma`)
  * **builder.dockerfile** is a path to a Dockerfile to build **builder.image** if it can't be pulled.

```typescript
equal(builder.image.name, DockerBuilder.image)
equal(builder.dockerfile, DockerBuilder.dockerfile)
const docker     = Dokeres.mock(x=>console.log({x}))
const dockerfile = '/path/to/a/Dockerfile'
const image      = 'my-custom/build-image:version'
builder = getBuilder({ docker, dockerfile, image })
builder.codeHashForPath = () => 'sha256' // mock out code hash function (touch fs directly - yuck)
artifact = await builder.build(source)
deepEqual(artifact.url,  new URL('file:///path/to/project/artifacts/crate-1@HEAD.wasm'))
equal(artifact.source,   undefined)
equal(artifact.codeHash, 'sha256')
```

* **RawBuilder** (enabled by `FADROMA_BUILD_RAW=1`) runs builds in host environment.

```typescript
import { RawBuilder } from '@fadroma/build'
builder = getBuilder({ buildRaw: true })
ok(builder instanceof RawBuilder)
```

* When **builder.caching == true**, each build call first checks in `./artifacts`
  for a corresponding pre-existing build and reuses it if present.

```typescript
equal(typeof getBuilder().caching, 'boolean')
```

## Some mock builders

```typescript
console.info('builder')
builder = new class TestBuilder1 extends Builder {
  async build (source: Source): Promise<Artifact> {
    return { location: '', codeHash: '', source }
  }
}

console.info('build one')
source   = {}
artifact = await builder.build(source)
assert(artifact.source === source, source)

console.info('build many')
let sources = [{}, {}, {}]
let artifacts = await builder.buildMany(sources)
assert(artifacts[0].source === sources[0])
assert(artifacts[1].source === sources[1])
assert(artifacts[2].source === sources[2])

builder = new class TestBuilder2 extends Builder {
  async build (source, args) { return { built: true, source, args } }
}
const source1 = Symbol()
const source2 = Symbol()
const args    = [Symbol(), Symbol()]
deepEqual(await builder.buildMany([source1, source2], args), [
  { built: true, source: source1, args },
  { built: true, source: source2, args }
])
```

## Build caching

The `CachingBuilder` abstract class makes sure that,
if a compiled artifact for the requested build
already exists in the project's `artifacts` directory,
the build is skipped.

Set the `FADROMA_REBUILD` environment variable to bypass this behavior.

```typescript
import { CachingBuilder } from '.'
builder = new class TestCachingBuilder extends CachingBuilder {
  async build (source) { return {} }
}
workspace = { path: Testing.here, ref: 'HEAD' }
await assert.throws(()=>builder.prebuild({}))
equal(builder.prebuild('', 'empty'), null)
```

## Builders for Secret Network
