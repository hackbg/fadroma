# Changelog (TypeScript)

## 2023-05-12

### `@hackbg/fadroma 1.0.0-beta.94`

#### Breaking changes

* The project manifest is now `fadroma.yml` instead of `fadroma.json`.
  If you created your project with an earlier version, just rename that file -
  as YAML is a superset of JSON, things should just work.
* Devnet API and implementation overhaul:
  * Removed crufty `devnet.spawn`, `devnet.respawn` and `devnet.kill` methods.
  * Replaced them with clear `create`/`delete`, `start`/`stop`, `load`/`save`.
  * Renamed devnet's `persistent` and `ephemeral` flags to `keepRuning` and `deleteOnExit`.
  * Replaced `devnet.container` and `devnet.image` with getters
    based on `devnet.containerId` and `devnet.imageTag`
  * The above should prevent orphaned devnet containers.
* Removed `deployment.config`
* `Chain.variants.ScrtDevnet(options)` now takes `Devnet` options and not `Scrt.Chain` options
* `ProjectWizard` is not exported anymore.

#### New features

* Enabled `fadroma rebuild` command.
* Enabled `fadroma reupload` command.
* Contracts created by project wizard now depend on fadroma `^0.8` instead of Git dependency.

#### Fixed

* Devnet support for Secret Network 1.9
* Don't reupload if code ID is present.
* Don't always reupload if running on mocknet.

## 2023-05-10

### `@hackbg/fadroma 1.0.0-beta.93`

#### Breaking changes

* Removed `DevnetConfig` as its purpose is fulfilled by `Partial<Devnet>`.
* Removed `Devnet.getOrCreate`, moved that logic into `Devnet` constructor.
* `devnet.stateDir` is now `string`, no more separate `devnet.identities` dir reference.
* `config.workspace` is now `config.build.workspace`.
* Removed `BuildConfig`, `UploadConfig`, `DeployConfig` in favor of
  anonymous objects defined in-place during `Config` construction.
* `project.resetDevnet` -> `project.resetDevnets` now kills `state/*/devnet.json`.
* `config.getDevnet(platform)` -> `config.getDevnet({ platform, ... })`.
* `fadroma-state.ts` -> `fadroma-deploy.ts`.

#### New features

* Support for temporary devnets with random names.
* Project generates `test` commands and `tes.ts` test index.
* `config.license`, `config.root` as separate from `config.project`.
* Example `FactoryDeployment`.
* Document `Snip20`, `Snip721`, `ViewingKeyClient`, clients.
* Update documentation for how deployments work.

#### Fixed

* Names of build and devnet containers were not assigned.
* Overhaul of how devnets are stored and cleaned up.
* Don't fail container builds in CI on tagged releases.
* Test suites now run in sequence, not in parallel.
* Getting started link in readme.
* Keep receipts by default - don't gitignore known chain ids in `state`.

### `@fadroma/agent 1.0.0-rc.21`

#### Breaking changes

* Removed `AgentOpts` as its purpose is served by `Partial<Agent>`.
* `FadromaError` -> `AgentError`, removed `CantInit` errors.
* `FadromaConsole` -> `AgentConsole`.
* Mocknet: `Ptr` -> `Pointer`, `Memory` -> `Allocator`, `pass` -> `passJson`.

#### New features

* Added `chain.stopped` flag.
* Added `randomChainId` helper with default `fadroma-devnet-` prefix.
* Added `fee.add` for building multi-token fees.
* Added `deployment.snapshot`.
* Added `Instantiated["initGas"]` and `Uploaded["uploadGas"]`.
* Implemented `ed25519_sign/verify`, `secp256k1_sign/verify` in mocknet.
* Added base `Token`, `TokenFungible` and `TokenNonFungible` classes.
* Added `NativeToken`, `CustomToken`, `Pair`, `Amount`, `Swap` classes.

#### Fixed

* Fixed ICC message passing in mocknet.
* Waiting for next block doesn't crash after closing devnet.
* `Deployments` now correctly hydrates contracts passed to its constructor.
* Name of `Contract` instance is now displayed in string tag.

### `@fadroma/connect 1.0.0-rc.21`

### `@fadroma/scrt 9.0.0-rc.21`

#### Breaking changes

* Removed `ScrtAgentOpts` as its purpose is served by `Partial<ScrtAgent>`.
* `scrtAgent.simulate` -> `scrtAgent.simulateForGas` to clarify purpose.
* Moved `Token`, etc. types listed above into `@fadroma/agent`.

#### New features

* Gas consumed by uploads and inits is now reported to the console.
