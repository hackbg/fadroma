# Fadroma Docker Integrations

```typescript
import assert from 'assert'
const DockerSpec = {}
const test = tests => Object.assign(DockerSpec, tests)
export default DockerSpec
```

```typescript
import { DockerImage } from './Docker'
test({
  async 'construct DockerImage' () {
    const image = new DockerImage('a', 'b', 'c', 'd')
    assert(image.docker     === 'a')
    assert(image.name       === 'b')
    assert(image.dockerfile === 'c')
    assert(image.extraFiles === 'd')
  },
  async 'DockerImage#available' () {
    const image = new DockerImage()
    assert(image.available === image.available)
  }
})
```

