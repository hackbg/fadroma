# Fadroma Build Tests

```typescript
import assert from 'assert'
const BuildSpec = {}
const test = tests => Object.assign(BuildSpec, tests)
export default BuildSpec
```

```typescript
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
const here      = dirname(fileURLToPath(import.meta.url))
const workspace = resolve(here, '../fixtures')
```

## The `Source` class

```typescript
import { Source } from '../index'
test({
  async 'Source ctor positional args' () {
    const source = new Source('w', 'c', 'r')
    assert(source.workspace === 'w')
    assert(source.crate     === 'c')
    assert(source.ref       === 'r')
  },
  async 'Source.collectCrates' () {
    const sources = Source.collectCrates('w', ['c1', 'c2'])('test')
    assert(sources.c1.workspace === 'w')
    assert(sources.c1.crate     === 'c1')
    assert(sources.c1.ref       === 'test')
    assert(sources.c2.workspace === 'w')
    assert(sources.c2.crate     === 'c2')
    assert(sources.c2.ref       === 'test')
  }
})
```

## The base `Builder` class

```typescript
import { Builder, Artifact } from '../index'
class TestBuilder extends Builder {
  async build (source: Source): Promise<Artifact> {
    return { location: '', codeHash: '', _fromSource: source }
  }
}
test({
  async 'Builder#build' () {
    const source = {}
    const artifact = await new TestBuilder().build(source)
    assert(artifact._fromSource === source)
  },
  async 'Builder#buildMany' () {
    const sources = [{}, {}, {}]
    const artifacts = await new TestBuilder().buildMany(sources)
    assert(artifacts[0]._fromSource === sources[0])
    assert(artifacts[1]._fromSource === sources[1])
    assert(artifacts[2]._fromSource === sources[2])
  },
})
```

```typescript
import { Builder } from '../index'
test({
  async 'Builder#buildMany' ({deepEqual}) {
    class TestBuilder extends Builder {
      async build (source, args) { return { built: true, source, args } }
    }
    const source1 = Symbol()
    const source2 = Symbol()
    const args = [Symbol(), Symbol()]
    deepEqual(
      await new TestBuilder().buildMany([source1, source2], args),
      [
        { built: true, source: source1, args },
        { built: true, source: source2, args }
      ]
    )
  }
})
```

### Build caching

The `CachingBuilder` abstract class makes sure that,
if a compiled artifact for the requested build
already exists in the project's `artifacts` directory,
the build is skipped.

Set the `FADROMA_REBUILD` environment variable to bypass this behavior.

```typescript
import { CachingBuilder } from '../index'
test({
  'CachingBuilder#prebuild' ({ equal, throws }) {
    class TestCachingBuilder extends CachingBuilder {
      async build (source) { return {} }
    }
    const workspace = 'foo'
    throws(()=>new TestCachingBuilder().prebuild({}))
    equal(new TestCachingBuilder().prebuild({workspace}), null)
  }
})
```

### Raw builder

```typescript
import { RawBuilder } from '../index'
test({
  async 'RawBuilder' ({ deepEqual }) {
    let ran
    class TestRawBuilder extends RawBuilder {
      run = (...args) => ran.push(args)
    }

    const buildScript    = Symbol()
    const checkoutScript = Symbol()
    const builder = new TestRawBuilder(buildScript, checkoutScript)

    const here      = dirname(fileURLToPath(import.meta.url))
    const crate     = 'empty'
    const ref       = 'ref'

    ran = []
    const sourceFromHead   = { workspace, crate }
    const templateFromHead = await builder.build(sourceFromHead)
    deepEqual(ran, [[buildScript, []]])

    ran = []
    const sourceFromRef   = { workspace, crate, ref }
    const templateFromRef = await builder.build(sourceFromRef)
    deepEqual(ran, [[checkoutScript, [ref]], [buildScript, []]])
  }
})
```

### Dockerized builder

```typescript
import { DockerBuilder, DokeresImage, mkdirp } from '../index'
import { Dokeres, DokeresImage } from '@hackbg/dokeres'
import { mockDockerode } from './_Harness'
import { Transform } from 'stream'
test({
  async 'DockerBuilder' ({ ok, equal, deepEqual }) {
    class TestDockerBuilder extends DockerBuilder {
      prebuild (source) { return false }
    }
    class TestDokeresImage extends DokeresImage {
      async ensure () { return theImage }
    }
    const theImage  = Symbol()
    const crate     = 'empty'
    const source    = { workspace, crate }
    const ran       = []
    const docker    = mockDockerode(runCalled)
    const image     = new Dokeres(docker).image(' ')
    const script    = "build.sh"
    const options   = { docker, image, script }
    const builder   = new TestDockerBuilder(options)
    const artifact  = await builder.build({ workspace, crate })
    equal(artifact.location, resolve(workspace, 'artifacts/empty@HEAD.wasm'))
    equal(artifact.codeHash, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')

    function runCalled ({ run: [image, cmd, buildLogs, args] }) {
      equal(image, theImage)
      equal(cmd, `bash /build.sh HEAD empty`)
      ok(buildLogs instanceof Transform)
      equal(args.Tty, true)
      equal(args.AttachStdin: true)
      deepEqual(args.Entrypoint, [ '/bin/sh', '-c' ])
      ok(args.HostConfig.Binds instanceof Array)
      equal(args.HostConfig.AutoRemove, true)
    }
  }
  async 'DockerBuilder#buildMany' () {
    class TestDockerBuilder extends DockerBuilder {
      prebuild (source) { return false }
    }
    class TestDokeresImage extends DokeresImage {
      async ensure () { return theImage }
    }
    const theImage  = Symbol()
    const docker    = mockDockerode()
    const image     = new Dokeres(docker).image(' ')
    const script    = ''
    const options   = { docker, image, script }
    const builder   = new TestDockerBuilder(options)
    const artifacts = await builder.buildMany([
      { workspace, crate: 'crate1' }
      { workspace, ref: 'HEAD', crate: 'crate2' }
      { workspace, ref: 'asdf', crate: 'crate3' }
    ])
  }
})
```

## Builders for Secret Network

```typescript
import { getScrtBuilder } from '../index'
test({
  'get dockerode builder' ({ ok }) {
    ok(getScrtBuilder())
  },
  'get raw builder' ({ ok }) {
    ok(getScrtBuilder({ raw: true }))
  },
})
```
