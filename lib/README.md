## `deps.ts`: Platform Dependencies

Collect all external imports here

## `format/`: Core Data Types

* Bit, Byte, Number
* String, Ansi
* Object, Stream, Time, Hash
* Function, Error

## `context/`: Composable Operations

* UI
  * Log
  * DOM, HTML, SVG
  * TUI
* OS
  * FS
  * OCI
  * Service
* Network
  * Port
  * TCP
  * HTTP

## `platform/`: Platform Support Modules

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
