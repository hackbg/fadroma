# Fadroma Bind JS

Just the JS binding from the declarative contract macros.

Used in tandem with wasm-bindgen to build smart contracts
in a form which is callable from a JS-based environment,
such as the Sienna Rewards in-browser dashboard.

## Usage

The default entry point declaration for a smart contract
(usually in `lib.rs`) looks like this:

```rust
#[cfg(target_arch = "wasm32")]
mod wasm {
  // ...
```

To enable building a contract for the browser, replace that with:

```rust
#[cfg(browser)] #[macro_use] extern crate wasm_bindgen;
#[cfg(all(feature="browser",target_arch="wasm32"))]
mod wasm_js { fadroma_bind_js::bind_js!(cosmwasm_std, crate::contract); }
#[cfg(all(not(feature="browser"),target_arch="wasm32"))]
mod wasm {
  // ...
```

* Replace `cosmwasm_std` with the path to `cosmwasm_std` if reexporting.
* Replace `crate::contract` with the path to the module containing the
  `init`, `query` and `handle` functions - e.g. if they are at
  the top level of your crate, use just `crate`.

Add the `browser` feature to your contract's Cargo.toml:

```toml
[dependencies]
# ...
fadroma-bind-js = { optional = true, path = "fadroma/bind-js" }
wasm-bindgen = { optional = true, version = "0.2" }

[features]
# ...
browser = [ "fadroma-bind-js", "wasm-bindgen" ]
```

Then, compile your contract with the `browser` feature flag enabled.

## Rationale

This is a separate crate in order to avoid Fadroma version conflict
when adding this into old contracts that are pinned to an older
Fadroma version.

This is not simpler to integrate due to differences in module structure
across Fadroma versions. The ideal format would be:

```
entrypoint!(
  crate::contract::init,
  crate::contract::handle,
  crate::contract::query,
);
```
