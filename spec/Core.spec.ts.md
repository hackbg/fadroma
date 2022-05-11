# `@fadroma/ops/Core` test suite

```typescript
import assert from 'assert'
const CoreSpec = {}
const test = tests => Object.assign(CoreSpec, tests)
export default CoreSpec
```

## Source

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

## Builder

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
