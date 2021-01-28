# fadroma

Contains the `contract!` macro, which bulldozes all the repetitive
boilerplate code around writing CosmWasm contracts, and lets you
define the skeleton of your actual contract logic in a terse syntax.

## Limitations
Method bodies (`Query` and `Handle` blocks) are actually expressions, not blocks.
This means that early `return` is not supported, and will fail with:
```
# TODO add error message
```
This is because those "methods" are not actually functions - the macro inlines
them to `match` cases in a single handler function.

## Example usage

This contract implements a basic calculator. Compare it with
[the counter implementation in secret-template](https://github.com/enigmampc/secret-template/tree/master/src)
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
            ok(state)
        }
        Sub (subtrahend: i64) {
            state.value -= subtrahend;
            ok(state)
        }
        Mul (multiplier: i64) {
            state.value *= multiplier;
            ok(state)
        }
        Div (divisor: i64) {
            match divisor {
                0 => err_msg(state, "division by zero"),
                _ => {
                    state.value /= divisor;
                    ok(state)
                }
            }
        }
    }
);
```
