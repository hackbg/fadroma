# Fadroma Build Specification

This package implements **reproducible compilation** of
the contracts specified using the primitives
defined in [Fadroma Core](../client/README.md)

> Run tests with `pnpm test`.
> Measure coverage with `pnpm cov`.[^1]
> Publish with `pnpm ubik`.
> [^1]: Note that stack traces output by `pnpm cov` coverage mode point to line numbers in
>       the compiled code. This is to get correct line numbers in the coverage report.
>       To get the same stack trace with correct line numbers, run `pnpm test`.

It defines the following entities:

## [Base build logic](./build-base.spec.ts.md)

* `BuilderConfig`: configure build environment
  from environment variables. Uses `@hackbg/konfizi`.
* `LocalBuilder`: base class for compiling contracts
  on the developer's workstation.
* **WIP:** `RemoteBuilder`: base class for compiling
  contracts using remote resources.

```typescript
import './build-base.spec.ts.md'
```

## Builder variants: [Raw](./build-raw.spec.ts.md), [Dockerized](./build-docker.spec.ts.md)

* `build.impl.js`, the build script
  * `RawBuilder`, which runs it using the local Rust toolchain.
  * `DockerBuilder`, which runs it in a Docker container

```typescript
import './build-raw.spec.ts.md'
import './build-docker.spec.ts.md'
```

## [Build from Git history](./build-history.spec.ts.md)

* `DotGit`, a helper for finding the contents of Git history
  where Git submodules are involved. This works in tandem with
  `build.impl.mjs` to enable:
  * **building any commit** from a project's history, and therefore
  * **pinning versions** for predictability during automated one-step deployments.

```typescript
import './build-history.spec.ts.md'
```
