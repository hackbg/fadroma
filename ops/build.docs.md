# Fadroma Compile API

Fadroma can deploy smart contracts from source.
Therefore, it must know how they are compiled.

## Get a compiler

The Compiler class sets up the build environment.

```typescript
import { getCompiler } from '@hackbg/fadroma'
const compiler = getCompiler()
```

* `FADROMA_BUILD_RAW` environment variable lets you switch
  between the two default compile implementations.

#### RawLocalRustCompiler

```typescript
const compiler = getCompiler({ container: false })
```

Runs the build procedure in the current shell environment
(using Rust from your `rustup` setup, etc.)

* Set `FADROMA_BUILD_SCRIPT` to customize build behavior. This defaults to
  the [`build.impl.mjs`](./build.impl.mjs) script included in the Fadroma package.

#### ContainerizedLocalRustCompiler

```typescript
const compiler = getCompiler({ container: true })
// specify custom docker connection:
const compiler = getCompiler({ container: true, dockerSocket: 'localhost:5000' })
```

Runs the build procedure in a Docker container, [`https://ghcr.io/hackbg/fadroma`](https://github.com/hackbg/fadroma/pkgs/container/fadroma),
using [`@hackbg/dock`](https://www.npmjs.com/package/@hackbg/dock).

* Use `FADROMA_DOCKER` or the `dockerSocket` option to specify a non-default Docker socket path.
* Set `FADROMA_BUILD_IMAGE`, `FADROMA_BUILD_SCRIPT` to customize build container behavior.

## Compile a contract

```typescript
import { getCompiler } from '@hackbg/fadroma'
const compiler = getCompiler()

const compiled = await compiler.build({
  cargoToml: "./path/to/crate/Cargo.toml"
})

const compiled = await compiler.build({
  cargoWorkspace: "./path/to/workspace/Cargo.toml",
  cargoCrate: "my-contract-1"
})
```

The output consists of an optimized `.wasm` binary and a `.wasm.sha256` checksum.
Keep the checksum in Git to know when the binary has changed.

* TODO: Use `sourceOrigin` and `sourceRef` for transparent builds of remote git checkouts.
* TODO: Verify source checksums.
