# Fadroma Compile API

---

**Status:** Covers the basics.
**To do:**
  * Using `sourceOrigin` and `sourceRef` for transparent builds of remote git checkouts.
    (this feature worked in previous versions but is currently disabled).
  * Verifying code hashes more strictly: add `codeHashPath` and separate
    `fetch` path for comparing `toCodeHash(codeData)` vs value of `codeHashPath`

---

Fadroma can deploy smart contracts from source.
Therefore, it must be able to compile them.
Various compilation options are implemented
in the form of the Compiler classes, which
set up the appropriate build environments.

## Get a compiler

```typescript
import { getCompiler } from '@hackbg/fadroma'
const compiler = getCompiler()
```

* `FADROMA_BUILD_RAW` environment variable lets you select
  between `RawLocalRustCompiler` and `ContainerizedLocalRustCompiler`.

#### RawLocalRustCompiler

Runs the build procedure in the current shell environment
(using Rust from your `rustup` setup, etc.)

```typescript
const compiler = getCompiler({ container: false })
```

* Set `FADROMA_BUILD_SCRIPT` to customize build behavior. This defaults to
  the [`build.impl.mjs`](./build.impl.mjs) script included in the Fadroma package.

#### ContainerizedLocalRustCompiler

Runs the build procedure in a Docker container, [`https://ghcr.io/hackbg/fadroma`](https://github.com/hackbg/fadroma/pkgs/container/fadroma),
using [`@fadroma/oci`](https://www.npmjs.com/package/@fadroma/oci).

```typescript
const compiler = getCompiler({ container: true })
// specify custom docker connection:
const compiler = getCompiler({ container: true, dockerSocket: 'localhost:5000' })
```

* Use `FADROMA_DOCKER` or the `dockerSocket` option to specify a non-default Docker socket path.
* Use `FADROMA_BUILD_IMAGE`, `FADROMA_BUILD_SCRIPT` to provide alternate build behavior.

## Compile a crate

```typescript
const compiled = await compiler.build({
  cargoToml: "./path/to/crate/Cargo.toml"
})
```

## Compile a crate from a workspace

```typescript
const compiled = await compiler.build({
  cargoWorkspace: "./path/to/workspace/Cargo.toml",
  cargoCrate: "my-contract-1"
})
```

This returns an instance of `CompiledCode` with the following properties:

|name|description|
|-|-|
|codePath|path to compiled code|
|codeHash|sha256 of compiled code|
|codeData|(empty before fetch) Uint8Array with the compiled code|

* At `${codePath}.sha256`, there'll be a checksum file.
  You can keep that checksum in Git to know when the binary has changed.

You can then upload and instantiate the compiled code with:

```typescript
const uploaded = await agent.upload(compiled)
const instance = await agent.instantiate(uploaded, { label, initMsg })
```

To prevent reuploads of the same code, upload with:

```typescript
const uploadStore = getUploadStore('/path/to/uploads/dir') 
const uploaded = await agent.upload(compiled, { uploadStore })
```

To get the actual code as a `Uint8Array`, use:

```typescript
const binary = await compiled.fetch()
```

