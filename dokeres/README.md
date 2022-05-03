# `@hackbg/dokeres`

Wanna run something from Node in a reproducible environment? Docker's your friend,
but `dockerode`'s API is a little rough around the edges.

This package defines the `Dokeres`, `DokeresImage` and `DockeresContainer` classes.
Use `DockerImage` to make sure a specified Docker Image exists on your system,
pulling or building it if it's missing.

Request the same image to be built multiple times and
it's smart enough to build it only once. This lets you e.g.
launch a zillion dockerized tasks in parallel, while being
sure that the same Docker image won't be pulled/built a zillion times.

Reexports `Docker` from `dockerode` for finer control.

## Example

```typescript
await new Dokeres().image(
  'my-org/my-build-image:v1',
  '/path/to/my/Dockerfile',
).run(
  'build-my-thing', {
     readonly: { '/my/project/sources':   '/sources'   }
     writable: { '/my/project/artifacts': '/artifacts' }
  }
)
```
