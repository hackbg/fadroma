# Fadroma Build Spec

```typescript
import * as Testing from '../../TESTING.ts.md'
import * as Fadroma from '@fadroma/client'
import assert, { ok, equal, deepEqual } from 'assert'
```

## Specifying projects and sources

A **Workspace** object points to the root of a project's [Cargo workspace](https://doc.rust-lang.org/book/ch14-03-cargo-workspaces.html)
  * [ ] TODO: Test with non-workspace project.

```typescript
import { LocalWorkspace } from '.'
let workspace: LocalWorkspace
const project = '/tmp/fadroma-test'
```

* A Workspace object can also point to a specific Git reference
  (**workspace.ref**, defaults to `HEAD`, i.e. the working tree).
* **workspace.at('ref')**. returns a *new* Workspace with the same path and new ref.

```typescript
import { HEAD } from '.'
workspace = new LocalWorkspace(project)
deepEqual(workspace.ref, HEAD)
deepEqual(workspace.at('my-branch').ref, 'my-branch')
```

* If the `.git` directory (represented as **workspace.gitDir**) exists, this allows
  the builder to check out and build a past commit of the repo (the one specified by
  **workspace.ref**), instead of building from the working tree.

```typescript
import { DotGit } from '.'
assert(workspace.gitDir instanceof DotGit)
```

A **Source** object points to a crate in a **Workspace**.

```typescript
let source: Fadroma.Source
```

* Given a **Workspace**, call **workspace.crate('my-crate')** to get a **Source** object
  representing a crate in that workspace.
* Use **workspace.crates(['crate-1', 'crate-2'])** to get multiple crates.

```typescript
import { LocalSource } from '.'
source = workspace.crate('crate-1')
ok(source instanceof LocalSource)
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
const builders = [
  getBuilder({
    docker:     Dokeres.Engine.mock(),
    dockerfile: '/path/to/a/Dockerfile',
    image:      'my-custom/build-image:version'
  }),
  getBuilder({
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
let template: Fadroma.Template
const artifact: URL = new URL('file:///path/to/project/artifacts/crate-1@HEAD.wasm')
for (const builder of builders) {
  template = await builder.build(source)
  deepEqual(template.artifact, artifact)
  equal(template.crate,    source.crate)
  equal(template.codeHash, 'sha256')
}
```

* Building multiple contracts in parallel:

```typescript
for (const builder of builders) {
  const sources = [source, workspace.crate('crate-2')]
  deepEqual(await builder.buildMany(sources), [
    new Fadroma.Template(sources[0], {
      artifact: new URL('file:///path/to/project/artifacts/crate-1@HEAD.wasm'),
      codeHash: 'sha256'
    }),
    new Fadroma.Template(sources[1], {
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
equal(typeof getBuilder().caching, 'boolean')
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
template = await builder.build(source)

console.info('build many')
let sources   = [{}, {}, {}]
let templates = await builder.buildMany(sources)

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

## Defining build tasks

These are similar to the deploy tasks but are only concerned with building contracts,
not uploading or instantiating them - i.e. they don't need access to any chain (though
builds may pull compile-time dependencies from the network).

Build tasks run in the following context:

```typescript
import { BuildContext } from '.'
const buildContext: BuildContext = new BuildContext()
ok(buildContext.builder   instanceof Fadroma.Builder)
ok(buildContext.workspace instanceof LocalWorkspace)
ok(buildContext.getSource instanceof Function)
ok(buildContext.build     instanceof Function)
ok(buildContext.buildMany instanceof Function)
```

And can be defined and invoked like this:

```typescript
import { BuildTask } from '.'
const buildTask: BuildTask = await new BuildTask(buildContext, () => {
  // ...
})
```

Or like this:

```typescript
class MyBuildTask extends BuildTask {
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
import { BuildConsole } from '.'
const log = new BuildConsole({ info: () => {} })
log.buildingFromCargoToml('foo')
log.buildingFromBuildScript('foo')
log.buildingFromWorkspace('foo')
log.buildingOne(workspace.crate('foo'))
log.buildingMany([workspace.crate('foo'), workspace.crate('bar')])
```
