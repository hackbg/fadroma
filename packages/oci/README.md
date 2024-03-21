# @fadroma/oci

Want to run some operation from Node in a reproducible environment?
Here's a really simple way to achieve that with containers.

## Overview

This library builds upon [Dockerode](https://www.npmjs.com/package/dockerode),
and provides the `OCIConnection`, `OCIImage` and `OCIContainer` abstractions, which
make it easy and performant to package and run reproducible operations
(such as containerized builds or ETL pipelines).

* The **`OCIConnection`** class connects to the Docker runtime at `/var/run/docker.sock`
  or the path specified by the `DOCKER_HOST` environment variable.
* The **`OCIImage`** class supports specifying both an upstream tag to pull from Docker Hub,
  and/or a local fallback Dockerfile. This allows for fast iteration when constructing
  the Dockerized runtime environment.
* From an `OCIImage` instance, you can launch one or more **`OCIContainer`**s.
  If you like, you can run multiple parallel operations in identical contexts
  (as specified by a single local `Dockerfile`), and the `Image` will
  build itself locally, only once and without touching Docker Hub.

## Example

```typescript
import { OCIConnection } from '@fadroma/oci'

const docker = new OCIConnection()

const image = docker.image(
  'my-org/my-build-image:v1', // This image will be pulled
  '/path/to/my/Dockerfile',   // If the pull fails, build from this Dockerfile
  [] // Any local paths referenced from the Dockerfile should be added here
)

const container = await image.run(`build_${+new Date()}`, {
  readonly: { '/my/project/sources':   '/src'  }, // -v ro
  writable: { '/my/project/artifacts': '/dist' }, // -v rw
  mapped: { 80: 8080 } // container:host
})
```

---

<div align="center">

Made with **#%&!** @ [**Hack.bg**](https://foss.hack.bg)

</div>
