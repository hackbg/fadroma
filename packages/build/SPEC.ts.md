# Fadroma Build Spec

```typescript
import * as Testing from '../../TESTING.ts.md'
import assert, { ok, equal, deepEqual } from 'assert'
```

# Builders compile artifacts from crates in the workspace

```typescript
import { Workspace, Source, Builder, Artifact } from '@fadroma/build'
let workspace: Workspace
let source:    Source
let builder:   Builder
let artifact:  Artifact
```

## Getting builders

```typescript
import { getBuilder, DockerBuilder, RawBuilder } from '@fadroma/build'
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
