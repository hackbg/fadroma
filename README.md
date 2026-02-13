<div align="center">

🌹 🇧🇬 🚜 🇪🇺 <br />
<strong>https://hack.bg presents:</strong>

</div>

<!--<img src="./www/logo_color.svg" alt="Fadroma" width="360">-->
<div align="center">

<img src="https://raw.githubusercontent.com/hackbg/fadroma/refs/heads/v3-alpha/www/logo_color.svg" alt="Fadroma" width="360">

# Fadroma

<strong>Cross-chain application framework with a vengeance.</strong>

</div>

<hr />

Hello and welcome to the next level of the Fadroma journey!

Documentation for Fadroma 3 is a little sparse right now.
This will be remedied extensively. Meanwhile, the recommended
way to get started with Fadroma is the project configurator at
[https://fadroma.tech](https://fadroma.tech).

</div>

## Installation

Fadroma v3 is not yet available in package repositories.

You can, nonetheless, easily add it to your project -
putting you in a better position explore Fadroma an
easily contribute back on the features you most need:

### Install as Git submodule

```
mkdir project # Create project 
cd project    # Enter project
git init      # Make it a repo

# Add Fadroma submodule:
git submodule add https://github.com/hackbg/fadroma

# Fetch the rest:
cd fadroma
git submodule update --init --recursive
```

### Install as Git subtree

```
mkdir project                # Create project 
cd project                   # Enter project
git init                     # Make it a repo
touch README.md              # Make it non-empty
git commit -m "tabula rasa"  # Initial commit

# Add Fadroma subtree:
git subtree add --prefix=fadroma https://github.com/hackbg/fadroma v3-alpha

# Fetch the rest:
cd fadroma
git submodule update --init --recursive
```

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
