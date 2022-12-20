# Advanced project setup

This is mostly useful for hacking on Fadroma itself.

## Prerequisites

You'll need:

* **Your preferred code editor.** We use NeoVim and VSCode.
* **Linux or macOS.** WSL might also work but we haven't really tested that much.
  (Whoever runs Fadroma on Plan 9 ascends.)
* **Git**, for keeping track of your changes.
* **Node.js, versions >= 16.12, and the [PNPM](https://pnpm.io) package manager**,
* At least one of the following:
  * **A Rust toolchain**, stable or nightly.
  * **Docker, configured to run without `sudo`.** Fadroma uses Docker to encapsulate builds
    (providing Rust 1.59 in the default build container) and to launch devnets (providing a
    local development environment).

## Git submodule setup

Fadroma uses Git submodules in its development workflow,
and can itself be included as a submodule in your project:

* To create an empty project:

```sh
mkdir project
cd project
git init
```

* To add Fadroma as Git submodule:

```sh
git submodule add -b refactor/x git@github.com:hackbg/fadroma.git
git submodule update --init --recursive
git commit -m "tabula rasa"
```

> Read more about [Git submodules](https://git-scm.com/book/en/v2/Git-Tools-Submodules)

## Cargo workspace setup

* Fadroma contains several Rust crates, and therefore projects that embed it as a Git submodule
  need to use Cargo workspaces.

* For a project containing two contracts, `Allocator` and `Generator`, and two non-contract
  crates, `api` and `shared`, the root `Cargo.toml` could look like this:

* Add `~/project/Cargo.toml`:

```toml
# Crates in workspace
[workspace]
members = [
  # Crates from Fadroma
  "fadroma/crates/*",
  # Your crates
  "contracts/allocator",
  "contracts/generator",
  # Non-contract crates still work:
  "libraries/api",
  "libraries/shared", # etc...
]

# Release profile
[profile.release]
codegen-units    = 1
debug            = false
debug-assertions = false
incremental      = false
lto              = true
opt-level        = 3
overflow-checks  = true
panic            = 'abort'
rpath            = false
```

## PNPM workspace setup

* To install [PNPM](https://pnpm.io):

```sh
npm i -g pnpm
```

* Add `~/project/.npmrc`:

```toml
prefer-workspace-packages=true
ignore-workspace-root-check=true
strict-peer-dependencies=false
```

* Add `~/project/pnpm-workspace.yaml`:

```yaml
# this file intentionally left blank
```

* Add `~/project/package.json`:

```json
{
  "name":      "@your/project",
  "version":   "0.0.0",
  "type":      "module",
  "main":      "index.ts",
  "workspace": true,
  "devDependencies": {
    "typescript":      "^4.7",
    "@hackbg/fadroma": "workspace:*",
    "@your/api":       "workspace:*"
  },
  "scripts": {
    "fadroma": "fadroma index.ts"
  }
}
```

* Make sure submodule is present:

```shell
git submodule update --init --recursive
```

* Install dependencies:

```shell
pnpm i
```

* To run your `index.ts` with Fadroma:

```shell
pnpm exec fadroma index.ts command arg1 arg2
# with package.json script, becomes:
pnpm fadroma command arg1 arg2
```

## Contract setup

* Add `~/project/contracts/allocator/Cargo.toml`:

```toml
[package]
name    = "your-allocator"
version = "0.1.0"
[lib]
crate-type = ["cdylib", "rlib"]
path       = "allocator.rs"
[dependencies]
fadroma = { path = "../../fadroma/crates/fadroma", features = [
  # add fadroma features flags here
] }
```

* Add `~/project/contracts/allocator/allocator.rs`:

```rust
use fadroma::prelude::*;
#[message] pub struct InitMsg { /**/ }
#[message] pub enum HandleMsg { /**/ }
#[message] pub enum QueryMsg  { /**/ }
pub fn init   /*...*/
pub fn handle /*...*/
pub fn query  /*...*/
fadroma::entrypoint!(fadroma, init, handle, query);
```

## API client setup

* Add `~/project/api/package.json`:

```json
{
  "name":         "@your/api",
  "version":      "1.0.0",
  "type":         "module",
  "main":         "api.ts",
  "dependencies": {
    "@fadroma/core":   "workspace:^6.1",
    "@fadroma/tokens": "workspace:^5.1"
  }
}
```

* Add `api/api.ts`:

```typescript
import * as Fadroma from '@hackbg/fadroma'
import { Snip20 } from '@fadroma/tokens'

/** API client for "contracts/allocator" */
export class Allocator extends Fadroma.Client {
  // Generate init message for deployment
  static init (min: number, max: number) {
    if (max >= min) throw new Error('invalid range')
    return { allocation_range: [ min, max ] }
  })
  // Call query method of deployed contract
  getAllocation (): number {
    return this.query({get:{}})
  }
  // Call transaction method of deployed contract
  setAllocation (allocation: number) {
    return this.execute({set: number})
  }
}

/** API client for "contracts/generator" */
export class Generator extends Snip20 {
  // extend the Snip20 client if your contract
  // is a customized SNIP-20 token
}
```

## Deploy procedure

* Add `~/project/index.ts`:

```typescript
import * as Fadroma from '@hackbg/fadroma'
import * as API     from '@your/api'

const contracts = [
  'allocator',
  'generator'
]

const plugins = [
  Fadroma.enableScrtBuilder,
  Fadroma.getChain,
  Fadroma.getAgent,
  Fadroma.getFileUploader,
]

export default new Fadroma.Ops('name', plugins)

  .command('build',  'compile contracts',
    function build ({ buildMany }) {
      return {
        artifacts: buildMany(contracts)
      }
    })

  .command('deploy', 'build and deploy contracts',
    function deploy ({ buildAndUploadMany, deploy, getClient }) {
      const [template1, template2] = await buildAndUploadMany(contracts)
      await deploy('Allocator', template1, { init: 'message' })
      await deploy('Generator', template2, { init: 'message' })
      return {
        allocator: getClient('Allocator', API.Allocator),
        generator: getClient('Generator', API.Generator)
      }
    })

  .command('status', 'query status of contracts',
    async function printStatus ({
      getClient,
      allocator = getClient('Allocator', API.Allocator)
    }) {
      console.log(await allocator.getAllocation())
    })

  .command('configure', 'configure contracts',
    async function configure ({ getClient }) {
      // ..
    })

  // More commands

  // Keep this at the end
  .entrypoint(import.meta.url)

```

* To run commands defined in `index.ts`:

```sh
pnpm run your build
```
