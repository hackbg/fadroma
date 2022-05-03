# Hack.bg Toolbox [![NPM version](https://img.shields.io/npm/v/@hackbg/toolbox?color=9013fe&label=)](https://www.npmjs.com/package/@hackbg/toolbox)

* **`@hackbg/toolbox`** [![NPM version](https://img.shields.io/npm/v/@hackbg/toolbox?color=9013fe&label=)](https://www.npmjs.com/package/@hackbg/toolbox) -
  **Big box of everything.**

  * Import this only if you're starting a new Node.js project and
    don't yet know which tools you need. This has the (contingent) benefit of importing
    all utilities from one single module.

  * Establishes a possible baseline for a future port of dependent Node projects,
    such as [Fadroma](https://github.com/hackbg/fadroma), to [Deno](https://deno.land)

  * [**`@hackbg/runspec`**](./runspec) [![NPM version](https://img.shields.io/npm/v/@hackbg/runspec?color=9013fe&label=)](https://www.npmjs.com/package/@hackbg/runspec) -
    **Minimal test runner.**
    * Its gimmick is that there are no gimmicks. No `describe`, no `expect`, no
      `beforeEach`/`afterAll`, etc. Who told you you needed those, anyway?
    * Define your tests as plain old functions, group them into test suites via regular ES modules,
      then call `runSpec` to run them in parallel - either all of them or just the ones you select.
    * Goes well with [Ganesha](https://github.com/hackbg/ganesha).

  * [**`@hackbg/konzola`**](./konzola) [![NPM version](https://img.shields.io/npm/v/@hackbg/konzola?color=9013fe&label=)](https://www.npmjs.com/package/@hackbg/konzola)
    **Pretty console output.**
    * Makes Node's default plain console output a little easier on the eyes.
    * Best used as a placeholder before introducing proper structured logging.
    * Reexports `table`, `colors`, `propmts` and the non-broken version of `prettyjson`

  * [**`@hackbg/dokeres`**](./dokeres) [![NPM version](https://img.shields.io/npm/v/@hackbg/dokeres?color=9013fe&label=)](https://www.npmjs.com/package/@hackbg/dokeres)
    **Docker utilities.**
    * Wanna run something from Node in a reproducible environment? Docker's your friend,
      but `dockerode`'s API is a little rough around the edges.
    * Reexports `dockerode`
    * Defineds the `DockerImage` class. Use this to make sure a specified Docker Image
      exists on your system. Request the same image to be built multiple times and it's
      smart enough to build it only once.

  * [**`@hackbg/forkers`**](./forkers) [![NPM version](https://img.shields.io/npm/v/@hackbg/forkers?color=9013fe&label=)](https://www.npmjs.com/package/@hackbg/forkers)
    **Web worker wrapper.**
    * Work in progress.
    * Does what Comlink doesn't.

  * [**`@hackbg/kabinet`**](./kabinet) [![NPM version](https://img.shields.io/npm/v/@hackbg/kabinet?color=9013fe&label=)](https://www.npmjs.com/package/@hackbg/kabinet)
    **Filesystem manipulation.**
    * Your OS's filesystem isn't the most powerful database by far,
      but it's the most human-friendly one out there.
    * Exports `File` and `Directory` classes, as well as example `JSON` subclasses of the same
      that take care of extensions and the data format. `YAML` and `TOML` subclasses are planned,
      too.
    * Reexports `fs`, `fs/promises`, as well as `mkdirp` and `rimraf`.
    * Basis of the Receipts subsystem in Fadroma. A "receipt" is a good metaphor
      for the kind of data best stored with this module: a record of a meaningful
      interaction between a user and a system, which is stored *with the user*
      (as it's recorded by the system's state, anyway). Think keeping track of
      what programs (e.g. smart contracts) you uploaded to an append-only public
      compute service (e.g. a programmable blockchain).

  * [**`@hackbg/komandi`**](./komandi) [![NPM version](https://img.shields.io/npm/v/@hackbg/komandi?color=9013fe&label=)](https://www.npmjs.com/package/@hackbg/komandi)
    **Simple command runner.**
    * Only takes literal position arguments.
    * No `-flags` and `--options`, structure your commands as sentences.
    * WIP: Simplify it further.

  * [**`@hackbg/portali`**](./portali) [![NPM version](https://img.shields.io/npm/v/@hackbg/portali?color=9013fe&label=)](https://www.npmjs.com/package/@hackbg/portali)
    **Network port utilities**
    * `freePort`
    * `waitPort`

  * Miscellaneous helpers and reexports:
    * Generate random values in different formats (TODO `@hackbg/formati`)
    * ISO `timestamp` but in FS-friendly format
    * `pick` keys from object
    * Mark values of object destructuring as `required`
    * Reexports `exponential-backoff`, `open`, `bech32`, `signal-exit`
    * Reexports `stderr` and `env` from `process`
    * Reexports `execFile/execFileSync/spawn/spawnSync` - TODO unified `run()` or `shell()`
