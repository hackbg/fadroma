<div align="center">
🌹 🇧🇬 🚜 🇪🇺 <br />
<strong>https://hack.bg presents:</strong>

# Fadroma

<strong>Cross-chain application framework with a vengeance.</strong>

<hr />

Hello and welcome to the next level of the Fadroma journey!

Documentation for Fadroma 3 is a little sparse right now.
This will be remedied extensively. Meanwhile, the recommended
way to get started with Fadroma is the project configurator at
[https://fadroma.tech](https://fadroma.tech).

</div>

## Repo overview

### `library/`: Core Data Types and Composable Operations DSL

* Bit, Byte, Number
* String, Ansi
* Object, Stream, Time, Hash
* Function, Error
* UI: Log, DOM, HTML, SVG, TUI
* OS: FS, OCI, Run
* Network: Port, TCP, HTTP

### `platform/`: Platform Support Modules

* Bitcoin: Elements, SimplicityHL
* Tendermint: CosmWasm, Secret Network, Namada

### About WASM blobs

* Build in container:

```sh
just wasm-img
just wasm-sh
cd lib/platform/simf
just wasm # or just wasm-release
```

* May need stub env to run, see `../stub/wasm_*` and import map.

## `watcher/`: Live Reloading Services

* Check types
* Run tests
