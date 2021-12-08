# Fadroma Support for Secret Network

This crate reexports all the other crates
via Cargo feature flags.

This way you can import 1 Fadroma crate
and not have to maintain the version
of each component manually.

## Base platform primitives

## Contract scaffold

### Overview

This library consists of 3 layers, 1 test helper and 1 deprecated feature.

#### Contract helper: `contract.rs`

Through
The one which defines your API.
* `contract_impl.rs` - The one which defines your API implementation.
* `contract_binding.rs` - The one which automatically implements environment bindings
  (i.e. defines entry points for the external environment to call into your contract.

#### Test helper: `contract_harness.rs`

#### State

### Example usage

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

## Storage

## Migrations

## Addressing

### Overview

Contracts accept API calls in `HumanAddr`
yet they need to store addresses as `CanonicalAddr`
to be resilient against address format changes.

This library handles conversion between the two address types
by implementing the `Humanize` and `Canonize` traits, each of
which has a single corresponding method `humanize`/`canonize`
which takes `&deps.api` and returns a StdResult containing the
converted struct.

### TODO

The `humanize` and `canonize` methods need to be implemented manually,
except for the minimal case (`HumanAddr.canonize`/`CanonicalAddr.humanize`).

* [ ] An attribute macro to mark address fields in structs
      and automatically derive the corresponding
      `humanize`/`canonize` implementations.

## Admin authentication

Composable and configurable admin functionality
that can be added to an existing Secret Network smart contract.

### Setup

1. Choose one of the two implementations
   and add its handle and query messages
   to yours as an enum variant with a payload.
2. Call the handle and query functions
   of the selected implementation
   inside your match statements
   in the respective functions.
   Pass `DefaultHandleImpl`/`DefaultQueryImpl` as a parameter
   if you want the default method implementations.
3. (Optional) The `#[require_admin]` attribute
   (found in the root of the crate) is provided
   which can be used to annotate functions
   that require an admin sender.
   The "derive" feature (which is enabled by default) is required for this.

### Customization

If you want to change the implementation of any of the methods,
simply create a zero-sized struct and implement the trait(s)
in your chosen implementation.

Since all the methods are implemented as trait defaults,
it is possible to override only the desired methods in your `impl`.

Then in step 2 above, pass your struct instead of `DefaultHandleImpl`/`DefaultQueryImpl`.

## User authentication

## Inter-contract communication

### SNIP20 token support

## Utilities
Helpful functions and types for CosmWasm based smart contract development.
