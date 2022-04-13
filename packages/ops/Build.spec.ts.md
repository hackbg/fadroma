# Fadroma Build Tests

```typescript
import assert from 'assert'
const BuildSpec = {}
const test = tests => Object.assign(BuildSpec, tests)
export default BuildSpec
```

## The base `Builder` class

```typescript
import { Builder } from './Core'
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

## Build caching

The `CachingBuilder` abstract class makes sure that,
if a compiled artifact for the requested build
already exists in the project's `artifacts` directory,
the build is skipped.

Set the `FADROMA_REBUILD` environment variable to bypass this behavior.

```typescript
import { CachingBuilder } from './Build'
test({
  'CachingBuilder#prebuild' () {
    class TestCachingBuilder extends CachingBuilder {
      async build (source) { return {} }
    }
    const workspace = 'foo'
    const source = {workspace}
    new TestCachingBuilder().prebuild(source)
  }
})
```

## Raw builder

```typescript
import { RawBuilder } from './Build'
import { resolve, dirname, fileURLToPath } from '@hackbg/toolbox'
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
    const workspace = resolve(here, '../../fixtures')
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

## Dockerized builder

```typescript
import { DockerodeBuilder } from './Build'
import { DockerImage } from '@hackbg/toolbox'
import { mockDockerode } from './Docker.spec'
import { mkdirp } from '@hackbg/toolbox'
import { Transform } from 'stream'
test({
  async 'DockerodeBuilder' ({ ok, equal, deepEqual }) {
    class TestDockerodeBuilder extends DockerodeBuilder {
      prebuild (source) { return false }
    }
    class TestDockerImage extends DockerImage {
      async ensure () { return theImage }
    }

    const here      = dirname(fileURLToPath(import.meta.url))
    const workspace = resolve(here, '../../fixtures')
    const crate     = 'empty'
    const source    = { workspace, crate }
    const ran       = []
    const docker    = mockDockerode(runCalled)
    const theImage  = Symbol()
    const image     = new TestDockerImage(docker)
    const script    = "build.sh"
    const options   = { docker, image, script }
    const builder   = new TestDockerodeBuilder(options)
    const template  = await builder.build({ workspace, crate })
    equal(template.location, resolve(workspace, 'artifacts/empty@HEAD.wasm'))
    equal(template.codeHash, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')

    function runCalled (image, cmd, buildLogs, args) {
      equal(image, theImage)
      equal(cmd, `bash /build.sh empty HEAD`)
      ok(buildLogs instanceof Transform)
      equal(args.Tty, true)
      equal(args.AttachStdin: true)
      deepEqual(args.Entrypoint, [ '/bin/sh', '-c' ])
      ok(args.HostConfig.Binds instanceof Array)
      equal(args.HostConfig.AutoRemove, true)
    }
  }
})
```
