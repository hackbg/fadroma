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
    class TestBuilder extends CachingBuilder {
      async build (source) { return {} }
    }
    const workspace = 'foo'
    const source = {workspace}
    new TestBuilder().prebuild(source)
  }
})
```

## Raw builder

```typescript
import { RawBuilder } from './Build'
test({
  async 'RawBuilder' () {
    const builder = new RawBuilder()
    await builder.build()
  }
})
```

## Dockerized builder

```typescript
import { DockerodeBuilder } from './Build'
import { DockerImage } from '@hackbg/toolbox'
import { mockDockerode } from './Docker.spec'
import { mkdirp } from '@hackbg/toolbox'
test({
  async 'DockerodeBuilder' () {
    const docker = mockDockerode()
    const image  = new DockerImage(docker)
    await image.ensure()
    const options = { docker, image, script: '' }
    const source  = { workspace: '/tmp' }
    mkdirp.sync('/tmp/artifacts')
    const builder = new DockerodeBuilder(options)
    await builder.build(source)
  }
})
```

## Managed builder

```typescript
import { ManagedBuilder } from './Build'
test({
  async 'ManagedBuilder' () {
    const managerURL = 'http://localhost'
    const builder = new ManagedBuilder({ managerURL })
    const source  = { workspace: '/tmp' }
    await builder.build(source)
  }
})
```

### Mock managed builder API

```typescript
export async function mockBuildEndpoint () {
  throw 'TODO'
}
```
