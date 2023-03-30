# The Fadroma Agent & Ops Guide

Welcome to the Fadroma Ops Guide!

## Obtaining Fadroma

Fadroma is available as a suite of Cargo crates and NPM packages.

If you have Nix, a standard development environment (containing Rust and Node.js)
can be entered using:

```sh
$ nix-shell https://advanced.fadroma.tech
```

If you have Rust and Node.js already set up on your development machine,
you can create a new Fadroma project using:

```sh
$ npx fadroma project create
```

Alternatively, you can add Fadroma to an existing NPM project using:

```sh
$ npm i --save fadroma
```

## Using Fadroma from the command line

The core features of Fadroma are invoked using the command-line tool, `fadroma`.

### Setting up a project

```sh
$ fadroma project create
$ fadroma contract add CONTRACT
$ fadroma contract list
```

### Building and uploading code

```sh
$ fadroma build
$ fadroma build CONTRACT
$ fadroma upload URL

$ fadroma rebuild
$ fadroma rebuild CONTRACT
$ fadroma upload URL

$ fadroma upload
$ fadroma upload CONTRACT
$ fadroma upload URL

$ fadroma reupload
$ fadroma reupload CONTRACT
$ fadroma reupload URL
```

### Instantiating and operating contracts

```sh
$ fadroma init CONTRACT NAME MESSAGE
$ fadroma query NAME MESSAGE
$ fadroma tx NAME MESSAGE
```

## Scripting Fadroma

For more complex operations, you can define custom commands, which you implement in TypeScript
using the Fadroma TypeScript API. **See [@fadroma/core](packages/core/Core.spec.ts.md)** to get
started with scripting Fadroma.

To run a Fadroma script:

```sh
$ fadroma run script.ts
```

To get started with writing Fadroma scripts,
proceed to the [***Fadroma Core API Specification***](./packages/core/Core.spec.ts.md).

```typescript
import './packages/core/Core.spec.ts.md'
import './packages/build/Build.spec.ts.md'
import './packages/connect/Connect.spec.ts.md'
import './packages/deploy/Deploy.spec.ts.md'
import './packages/devnet/Devnet.spec.ts.md'
import './packages/mocknet/Mocknet.spec.ts.md'
import './platforms/scrt/Scrt.spec.ts.md'
import './platforms/cw/CW.spec.ts.md'
import './platforms/evm/EVM.spec.ts.md'
```
