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

</div>

## Installation

Fadroma v3 is not yet available in package repositories.

You can, nonetheless, easily add it to your project -
putting you in a better position to explore and
contribute to the Fadroma codebase:

### Install as Git submodule

```sh
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

```sh
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

## `platform/`: Integration Modules

### Bitcoin, Liquid, Elements

```ts
import { Bitcoin } from 'fadroma';
const localnet = await Bitcoin.ElementsRegtest();
const testnet  = await Bitcoin.LiquidTestnet(); // TODO
// TODO others
```

#### SimplicityHL

```ts
import { SimplicityHL } from 'fadroma';
const program  = await SimplicityHL("fn main () { assert!(true) }");
const commitTx = await program.commit({ ... });
const redeem   = await program.redeem({ ... });
```

### Solana

```ts
import { Solana } from 'fadroma';
```

### Cosmos, Tendermint, CometBFT

```ts
import { Tendermint } from 'fadroma';
```

#### Namada

```ts
import { Namada } from 'fadroma';
```

#### CosmWasm

```ts
import { CosmWasm } from 'fadroma';
```

#### Secret Network

```ts
import { SecretNetwork } from 'fadroma';
```

## `library/`: Core Capabilities

### Control flow

#### Fn, Pipe, Async

```ts
import { Fn } from 'fadroma';
```

#### Error

### Test DSL

```ts
import { Test } from 'fadroma';
```

### Data types

#### Number, Bit, Byte, Hash

#### Time

#### String

#### Object

#### Stream

### Network

#### Port, Tcp

#### Http

```ts
import { Http } from 'fadroma';
```

### Fs

### Run, Spawn

### Oci

### Log

### Ansi

### Tui

### Dom, Html, Svg

### Watcher

#### Typechecker

#### Test runner
