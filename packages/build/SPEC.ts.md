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

```typescript
import { Builder, getBuilder } from '@fadroma/build'
let builder: Builder
```

* DockerBuilder (the default) runs builds in Docker container:

```typescript
import { DockerBuilder } from '@fadroma/build'
ok(getBuilder() instanceof DockerBuilder)
```

* RawBuilder (enabled by `FADROMA_BUILD_RAW=1`) runs builds in host environment.

```typescript
import { RawBuilder } from '@fadroma/build'
ok(getBuilder({ buildRaw: true }) instanceof RawBuilder)
```

```typescript
import { Artifact } from '@fadroma/build'
let artifact: Artifact
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
