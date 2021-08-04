# Fadroma Contract Scaffold for Secret Network

## Overview

This library consists of 3 layers, 1 test helper and 1 deprecated feature.

### Contract helper: `contract.rs`

Through
The one which defines your API.
* `contract_impl.rs` - The one which defines your API implementation.
* `contract_binding.rs` - The one which automatically implements environment bindings
  (i.e. defines entry points for the external environment to call into your contract.

### Test helper: `contract_harness.rs`

### State

## Example usage

This contract implements a basic calculator.
Compare it with [the counter implementation in secret-template](https://github.com/enigmampc/secret-template/tree/master/src)
for perspective.

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
