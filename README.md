# fadroma

Contains the `contract!` macro.

The aim of this macro is to cut away all the repetitive boilerplate code
around writing CosmWasm contracts, leaving just the actual implementation
in view.

## Example usage

(Compare with https://github.com/enigmampc/secret-template/tree/master/src)

```rust
#[macro_use] extern crate fadroma;
contract!(
    b"config"
    InitMsg (deps, env, msg: {}) -> State {
        token_contract: None,
        admin:          None,
        launched:       None
    }
    QueryMsg (deps, msg) {
        Equals () {
            let state = config_read(&deps.storage).load()?;
            to_binary(&crate::msg::EqualsResponse { value: state.value })
        }
    }
    HandleMsg (deps, env, msg) {
        Add {augend:     i32} (&mut state) {
            state.value += augend;
            Ok(state)
        }
        Sub {subtrahend: i32} (&mut state) {
            state.value -= subtrahend;
            Ok(state)
        }
        Mul {multiplier: i32} (&mut state) {
            state.value *= multiplier;
            Ok(state)
        }
        Div {divisor:    i32} (&mut state) {
            state.value /= divisor;
            Ok(state)
        }
    }
    Response {
        EqualsResponse { value: i32 }
    }
);
```
