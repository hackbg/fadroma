# Fadroma Build Spec

```typescript
import * as Testing from '../../TESTING.ts.md'
import * as Fadroma from '@fadroma/build'
import assert, { ok, equal, deepEqual } from 'assert'
```

# Specifying projects and sources

A **Workspace** object points to the root of a project's [Cargo workspace](https://doc.rust-lang.org/book/ch14-03-cargo-workspaces.html)
  * [ ] TODO: Test with non-workspace project.

```typescript
let workspace: Fadroma.LocalWorkspace
const project = '/tmp/fadroma-test'
```

* A Workspace object can also point to a specific Git reference
  (**workspace.ref**, defaults to `HEAD`, i.e. the working tree).
* **workspace.at('ref')**. returns a *new* Workspace with the same path and new ref.

```typescript
workspace = new Fadroma.LocalWorkspace(project)
deepEqual(workspace.at('my-branch'), new Fadroma.LocalWorkspace(project, 'my-branch'))
```

* If the `.git` directory (represented as **workspace.gitDir**) exists, this allows
  the builder to check out and build a past commit of the repo (the one specified by
  **workspace.ref**), instead of building from the working tree.

```typescript
assert(workspace.gitDir instanceof Fadroma.DotGit)
```

A **Source** object points to a crate in a **Workspace**.

```typescript
let source: Fadroma.Source
```

* Given a **Workspace**, call **workspace.crate('my-crate')** to get a **Source** object
  representing a crate in that workspace.
* Use **workspace.crates(['crate-1', 'crate-2'])** to get multiple crates.

```typescript
source = workspace.crate('crate-1')
ok(source instanceof Fadroma.LocalSource)
deepEqual(workspace.crates(['crate-1', 'crate-2'])[0], source)
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
import * as Dokeres from '@hackbg/dokeres'
builder = Fadroma.getBuilder()
ok(builder instanceof Fadroma.DockerBuilder)
ok(builder.docker instanceof Dokeres.Engine)
equal(builder.image.name, Fadroma.DockerBuilder.image)
equal(builder.dockerfile, Fadroma.DockerBuilder.dockerfile)
```

* **RawBuilder** (enabled by `FADROMA_BUILD_RAW=1`) runs builds in host environment.
  * RawBuilder launches the [**build script**](./build.impl.mjs) in a subprocess.
  * By default, the interpreter is the same version of Node that is running Fadroma.

```typescript
builder = Fadroma.getBuilder({ buildRaw: true })
ok(builder instanceof Fadroma.RawBuilder)
```

* Let's create a DockerBuilder and a RawBuilder with mocked values and try them out:

```typescript
const builders = [
  Fadroma.getBuilder({
    docker:     Dokeres.Engine.mock(),
    dockerfile: '/path/to/a/Dockerfile',
    image:      'my-custom/build-image:version'
  }),
  Fadroma.getBuilder({
    buildRaw: true
  })
]
// mock out code hash function
builders[0].codeHashForPath = () => 'sha256'
builders[1].codeHashForPath = () => 'sha256'

// mock out runtime in raw builder
import { execSync } from 'child_process'
builders[1].runtime = String(execSync('which true')).trim()
```

* Building the same contract with each builder:

```typescript
for (const builder of builders) {
  artifact = await builder.build(source)
  deepEqual(artifact.url,  new URL('file:///path/to/project/artifacts/crate-1@HEAD.wasm'))
  equal(artifact.source,   source)
  equal(artifact.codeHash, 'sha256')
}
```

* Building multiple contracts in parallel:

```typescript
for (const builder of builders) {
  const sources = [source, workspace.crate('crate-2')]
  deepEqual(await builder.buildMany(sources), [
    new Template(sources[0], {
      artifact: new URL('file:///path/to/project/artifacts/crate-1@HEAD.wasm'),
      codeHash: 'sha256'
    }),
    new Template(sources[1], {
      artifact: new URL('file:///path/to/project/artifacts/crate-2@HEAD.wasm'),
      codeHash: 'sha256'
    })
  ])
}
```

## Build caching

* When **builder.caching == true**, each build call first checks in `./artifacts`
  for a corresponding pre-existing build and reuses it if present.

```typescript
equal(typeof Fadroma.getBuilder().caching, 'boolean')
```

## Some mock builders

```typescript
console.info('builder')
builder = new class TestBuilder1 extends Fadroma.Builder {
  async build (source: Source): Promise<Template> {
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

builder = new class TestBuilder2 extends Fadroma.Builder {
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
builder = new class TestCachingBuilder extends Fadroma.CachingBuilder {
  async build (source) { return {} }
}
workspace = { path: Testing.here, ref: 'HEAD' }
await assert.throws(()=>builder.prebuild({}))
equal(builder.prebuild('', 'empty'), null)
```

## Defining build tasks

These are similar to the deploy tasks but are only concerned with building contracts,
not uploading or instantiating them - i.e. they don't need access to any chain (though
builds may pull compile-time dependencies from the network).

Build tasks run in the following context:

```typescript
const buildContext: Fadroma.BuildContext = Fadroma.getBuildContext({})
ok(buildContext.builder   instanceof Fadroma.Builder)
ok(buildContext.workspace instanceof Fadroma.Workspace)
ok(buildContext.getSource instanceof Function)
ok(buildContext.build     instanceof Function)
ok(buildContext.buildMany instanceof Function)
```

And can be defined and invoked like this:

```typescript
const buildTask: Fadroma.BuildTask = await new Fadroma.BuildTask(buildContext, () => {
  // ...
})
```

Or like this:

```typescript
class MyBuildTask extends Fadroma.BuildTask {
  constructor (context) {
    super(context, () => {
      // ...
    })
  }
}
await new MyBuildTask(buildContext)
```

## Build messages

WIP: Convert all status outputs from build module to semantic logs.

```typescript
for (const event of Object.values(Fadroma.BuildLogger({ info: () => {} })) event([],[])
```
