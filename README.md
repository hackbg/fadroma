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

### `library/`: Core Capabilities

* Control: Fn, Pipe, Async, Error
* Data: Number, Bit, Byte, Hash, Time, String, Object, Stream
* UI: Log, Ansi, Tui, Dom (Html, Svg)
* OS: Fs, Run, Spawn, Oci
* Network: Port, Tcp, Http
* Watcher: Typecheck, Run tests

### `platform/`: Platform Support Modules

* Bitcoin: Elements, SimplicityHL
* Tendermint: CosmWasm, Secret Network, Namada

#### About WASM blobs

* Build in container:

```sh
just wasm-img
just wasm-sh
cd lib/platform/simf
just wasm # or just wasm-release
```

* May need stub env to run, see `../stub/wasm_*` and import map.
