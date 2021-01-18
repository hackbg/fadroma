# fadroma

Contains the `contract!` macro and its modules,
`state!`, `message!`, `messages!`, `handle!` and `query!`.

The aim of these macros is to reduce the boilerplate around writing CosmWasm
contracts, leaving just the actual business logic in view.

## Example usage

(Compare with https://github.com/enigmampc/secret-template/tree/master/src)

```rust
#[macro_use] extern crate fadroma;
contract!(
    b"config"
    InitMsg (deps, env, msg: { value: i32 }) -> State {
        value: i32           = msg.value,
        owner: CanonicalAddr = deps.api.canonical_address(&env.message.sender)?
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