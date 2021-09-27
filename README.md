# [Fadroma](https://fadroma.tech)

Industrial-strength tooling and components for WASM-based smart contracts.

![](https://github.com/hackbg/fadroma/blob/21.08/doc/logo.svg)

## Writing smart contracts with Fadroma

```rust
#[macro_use] extern crate fadroma;
contract!(
    [State] {
        value: i64
    }

    [Init] (deps, env, msg: {
        initial_value: i64
    }) {
        State { value: initial_value }
    }

    [Query] (deps, state, msg) {
        Equals () {
            state.value
        }
    }

    [Response] {
        [Equals] { value: i64 }
    }

    [Handle] (deps, env, sender, state, msg) {
        Add (augend: i64) {
            state.value += augend;
            ok!(state)
        }
        Sub (subtrahend: i64) {
            state.value -= subtrahend;
            ok!(state)
        }
        Mul (multiplier: i64) {
            state.value *= multiplier;
            ok!(state)
        }
        Div (divisor: i64) {
            match divisor {
                0 => err_msg(state, "division by zero"),
                _ => {
                    state.value /= divisor;
                    ok!(state)
                }
            }
        }
    }
);
```

## Deploying smart contracts with Fadroma

## Contributing to Fadroma

Please see the [contribution guidelines](CONTRIBUTING.md).

## Contents

* `lib/` - Rust components. 
* `ops/` - Generic deployment code.
* `ops-scrt/` - SecretNetwork-specific deployment code
* `ops-scrt-1.0/`, `ops-scrt-1.2` - compatibility between holodeck-2/supernova-1
* `tools` - General JS utilities used across the library
