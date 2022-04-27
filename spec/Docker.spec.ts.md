# Fadroma Docker Integrations

```typescript
import assert from 'assert'
const DockerSpec = {}
const test = tests => Object.assign(DockerSpec, tests)
export default DockerSpec
```

## Mock of Dockerode

## Docker image helper

This makes sure the devnet and build images are present
in the local Docker image cache. If not, it tries to fetch
them from Docker Hub, and if they're not there, it tries to
build them from a local Dockerfile. If there's no Dockerfile,
it bails.

```typescript
import { DockerImage } from '@hackbg/toolbox'
test({
  async 'construct DockerImage' () {
    const image = new DockerImage('a', 'b', 'c', 'd')
    assert(image.docker     === 'a')
    assert(image.name       === 'b')
    assert(image.dockerfile === 'c')
    assert(image.extraFiles === 'd')
  },
  async 'DockerImage#available' () {
    const image = new DockerImage(mockDockerode())
    await image.ensure()
  }
})
```

## Build via Dockerode

```typescript
test({
  async 'run build in docker' () {
    throw 'TODO'
  },
})
```

## Run devnet via Dockerode

```typescript
test({
  async 'run devnet in docker' () {
    throw 'TODO'
  },
})
```
