# Fadroma Composability ![](https://img.shields.io/badge/version-0.1.0-blueviolet)

**How to compose reusable bits of smart contract functionality
using Rust's native trait composition facilities.**

## Introduction

The classic way to write CosmWasm smart contracts
is by defining message structs/enums and free-standing
functions that operate on them, initiated from the
`init`/`handle`/`query` entry points.

I seek a more modular approach: one that is rooted in the
language's native features, and allows contract features
to be reused with a minimum of boilerplate (as was the
original objective of this framework.)

Composability requires messages and handlers to be coupled
more tightly; furthermore, the current implementation of
composability also requires them to be coupled to the
platform core via the `core: Composable<S, A, Q>` wrapper.

Though this is not complex to achieve, it is verbose.
For that purpose, a v2 of `fadroma-derive-contract`'s
macro syntax is proposed at the end of this document.

### Guiding principles

The following macro syntax is not final. However, something of the sort
will need to be introduced for composability support in derive macros.

So far, two guiding principles have been identified for this API design:

* Avoid implicit identifiers. All names mentioned are defined by the caller.
* Provide escape hatches. Especially in the case of composing feature traits
  into the root contract, the user should have the freedom to override the
  dispatch. In practice this is achieved quite easily by implementing the
  dispatch on the messages.

## Composability Levels

Migrating from classical to composable contracts
is a multi-step process, which is why below we define
6 levels of composability (CL0-CL5) which correspond
to the features of this library and denote their integration
in a smart contract's architecture.

## Composability Level 0 (CL0): Builder traits

> See [`mod builder`](./builder.rs)

`TODO`

## Composability Level 1 (CL1): `core` and Message traits

> See [`mod composable`](./composable.rs)

The `core: Composable<S, A, Q>` object is a thin wrapper aroun
the platform API handle (`env: Extern<S, A, Q>` on CW0.10, 
`deps: Deps` on (CW0.16)). It exposes methods with shorter names,
as well as helper methods.

To interact with the CosmWasm platform from functions that are
implemented on a `struct` or `enum`, you need to make it aware
of the core via an intermediate trait.

> This sorely needs to be hidden behind a macro.

### CL1 Step 1. Define your struct as normal.

```rust
#[derive(Clone,Debug,PartialEq,Serialize,Deserialize,JsonSchema)]
#[serde(rename_all="snake_case")]
#[serde(deny_unknown_fields)]
pub enum LimitOrder {
    Ask(Uint128),
    Bid(Uint128)
}
```

### CL1 Step 2. Define an interface trait for your methods.

```rust
pub trait ILimitOrder<S, A, Q, C>: Sized where
    S: Storage, A: Api, Q: Querier,
    C: Composable<S, A, Q>
{
    fn ask (core: &C, price: Option<Uint128>) -> StdResult<Self>;
    fn bid (core: &C, price: Option<Uint128>) -> StdResult<Self>;
}
```

This intermediate step trait is necessary to define the `S, A, Q`
generics, necessary to be able to write the type of `Composable<S, A, Q>`.

This is a place where Rust's type system falls slightly short.
The alternative to the extra trait would be 3 `PhantomData` fields.

On an enum they could be hidden away on a never-instantiated variant.
On a struct, you'd have to init them every time you write the struct.

As it is, the interface struct can make a useful "table of contents"
for the functionality implemented on each message.

### CL1 Step 3. Implement variant constructor methods.

> See: [example from `cosmwasm_std`: `StdError` variants](https://docs.rs/cosmwasm-std/0.10.1/cosmwasm_std/enum.StdError.html#implementations)

```rust
impl<S, A, Q, C> ILimitOrder<S, A, Q, C> for LimitOrder where
    S: Storage, A: Api, Q: Querier,
    C: Composable<S, A, Q>
{
    fn ask (core: &C, price: Option<Uint128>) -> StdResult<Self> {
        Ok(Self::Ask(price.ok_or(core.get("ask")?))
    }
    fn bid (core: &C, price: Option<Uint128>) -> StdResult<Self> {
        Ok(Self::Bid(price.ok_or(core.get("bid")?))
    }
}
```

Congratulations, this enum is now **API-aware**.

This means that its variant constructors can now use the Fadroma Composable `core`.

The enum itself can be used as the most basic building block of
a reusable contract layer: a representation of a single API message.

### CL1 Step 4. Usage

```rust
let order = LimitOrder::ask(core, None)?;
```

The **message trait** defines and implements 1 associated function
per variant, in order to construct the different variants from the
parameters + data from `core`.

## Composability Level 2 (CL2): Dispatch traits

> See [`mod dispatch`](./dispatch.rs)

In contrast with the **message trait** from CL1,
whose functions return different variants of the enum
for which it is implemented,
a **dispatch trait** starts with an instance of a
specific variant of the enum for which it is implemented,
and runs a different branch of code depending on which
variant it is.

```rust
let response = SomeQuery::GetAsk.dispatch(core)?;
let response = SomeHandle::SetAsk("Something".into()).dispatch(core)?;
```

`QueryDispatch<S, A, Q, C, R>` and `HandleDispatch<S, A, Q, C>`
are the two **dispatch traits**.

### Step 1. Implementing `QueryDispatch<S, A, Q, C, R>`

For:

```rust
#[derive(...)]
#[serde(rename_all="snake_case")]
pub enum LimitOrderQuery {
    GetAsk,
    GetBid { HumanAddr, String },
}
```

```rust
impl<S, A, Q, C> QueryDispatch<S, A, Q, C, LimitOrder>
for LimitOrderQuery where
    S: Storage, A: Api, Q: Querier,
    C: Composable<S, A, Q>
{
    fn dispatch_query (self, core: &C) -> StdResult<LimitOrder> {
        Ok(match self {
            LimitOrderQuery::GetAsk =>
              LimitOrder::ask(core)?,
            LimitOrderQuery::GetBid { x, y } =>
              LimitOrder::bid(core, x, y)?
        })
    }
}
```

### Step 2. Implementing `HandleDispatch<S, A, Q, C>`:

For:

```rust
#[derive(...)]
#[serde(rename_all="snake_case")]
pub enum LimitOrderHandle {
    SetAsk(Uint128),
    SetBid(Uint128),
}
```

```rust
impl<S, A, Q, C> HandleDispatch<S, A, Q, C>
for LimitOrderHandle where
    S: Storage, A: Api, Q: Querier,
    C: Composable<S, A, Q>
{
    fn dispatch_handle (self, core: &C, env: Env) -> StdResult<HandleResponse> {
        Ok(match self {
            LimitOrderHandle::SetAsk(x) =>
              HandleResponse::default(),
            LimitOrderHandle::SetBid(x) =>
              HandleResponse::default(),
        })
    }
}
```

## Composability Level 3 (CL3): Feature traits

Anatomy of a feature trait:

### CL3 Step 1. Trait header

* `TODO`: Check if associated types can put an end to the propagation of generics.

```rust
pub trait MyFeature<S: Storage, A: Api, Q: Querier>:
```

### CL3 Step 2: Minimum requirements

* Here you can add other dependencies if you want
  to call into those traits.

```rust
    Composable<S, A, Q>
    + Sized
```

```rust
{
```

### CL3 Step 3: Optional init fn

* `HOWTO` cleanly compose multiple `init`s?

```rust
    fn init (&mut self, env: &Env, msg: InitMsg)
        -> StdResult<InitResponse>
    {
        Ok(InitResponse::default())
    }
```

### CL3 Step 4: Let the messages dispatch themselves

```rust
    fn handle (&mut self, env: &Env, msg: LimitOrderHandle)
        -> StdResult<HandleResponse>
    {
        msg.dispatch(self, env)
    }

    fn query (&self, msg: LimitOrderQuery)
        -> StdResult<Binary>
    {
        msg.dispatch(self)
    }
}
```

## Composability Level 4: Composing feature traits into a contract

Implement those traits for `Extern` to define a contract.
Implement them for `MockExtern` from [`composable_test`](./composable_test.rs)
and you can clone partial test contents so that you can write
branching tests.

## Composability Level 5: Reusable feature traits

Trim down traits that implement generic features into a reusable form
and add them to Fadroma to collect a library of smart contract primitives.

## Appendix A: Proposed macro syntax

### Proposed macro syntax for `CL1:S1-3`

(not too sure about this one,
need to cross-check against
rewards domain objects)

```rust
#[message] enum LimitOrder {
    Ask(Uint128) <= fn ask (core: &C, price: Option<Uint128>) {
        Ok(Self::Ask(price.ok_or(core.get("ask")?))
    }
    Bid(Uint128) <= fn bid (core: &C, price: Option<Uint128>) {
        Ok(Self::Bid(price.ok_or(core.get("bid")?))
    }
}
```

Equivalent to:

```rust
#[derive(Clone,Debug,PartialEq,Serialize,Deserialize,JsonSchema)]
#[serde(rename_all="snake_case")]
#[serde(deny_unknown_fields)]
pub enum LimitOrder {
    Ask(Uint128),
    Bid(Uint128)
}
pub trait ILimitOrder<S, A, Q, C>: Sized where
    S: Storage, A: Api, Q: Querier,
    C: Composable<S, A, Q>
{
    fn ask (core: &C, price: Option<Uint128>) -> StdResult<Self>;
    fn bid (core: &C, price: Option<Uint128>) -> StdResult<Self>;
}
impl<S, A, Q, C> ILimitOrder<S, A, Q, C> for LimitOrder where
    S: Storage, A: Api, Q: Querier,
    C: Composable<S, A, Q>
{
    fn ask (core: &C, price: Option<Uint128>) -> StdResult<Self> {
        Ok(Self::Ask(price.ok_or(core.get("ask")?))
    }
    fn bid (core: &C, price: Option<Uint128>) -> StdResult<Self> {
        Ok(Self::Bid(price.ok_or(core.get("bid")?))
    }
}
```

#### Proposed macro syntax for `CL2 Step 1`

```rust
#[query] enum LimitOrderQuery<LimitOrder> {
    #[variant]
    fn get_ask (self) {
        const x = self.get("ask")?;
        Ok(LimitOrder::ask(self, x))
    }
    #[variant]
    fn get_bid (self, x: HumanAddr, y: String) {
        Ok(LimitOrder::bid(self, x, y))
    }
}
```

Equivalent to:

```rust
#[derive(Clone,Debug,PartialEq,Serialize,Deserialize,JsonSchema)]
#[serde(rename_all="snake_case")]
#[serde(deny_unknown_fields)]
pub enum LimitOrderQuery {
    GetAsk,
    GetBid { HumanAddr, String },
}
impl<S, A, Q, C> QueryDispatch<S, A, Q, C, LimitOrder>
for LimitOrderQuery where
    S: Storage, A: Api, Q: Querier,
    C: Composable<S, A, Q>
{
    fn dispatch_query (self, core: &C) -> StdResult<LimitOrder> {
        Ok(match self {
            LimitOrderQuery::GetAsk =>
              LimitOrder::ask(core)?,
            LimitOrderQuery::GetBid { x, y } =>
              LimitOrder::bid(core, x, y)?
        })
    }
}
```

#### Proposed macro syntax for `CL2 Step 2`

```rust
#[handle] enum LimitOrderHandle<LimitOrder> {
    #[variant]
    fn set_ask (self, x: Uint128) {
        self.set("ask", x)?;
        Ok(HandleResponse::default())
    }
}
```

Equivalent to:

```rust
#[derive(Clone,Debug,PartialEq,Serialize,Deserialize,JsonSchema)]
#[serde(rename_all="snake_case")]
#[serde(deny_unknown_fields)]
pub enum LimitOrderHandle {
    SetAsk(Uint128),
    SetBid(Uint128),
}
impl<S, A, Q, C> HandleDispatch<S, A, Q, C>
for LimitOrderHandle where
    S: Storage, A: Api, Q: Querier,
    C: Composable<S, A, Q>
{
    fn dispatch_handle (self, core: &C) -> StdResult<HandleResponse> {
        Ok(match self {
            LimitOrderHandle::SetAsk(x) =>
              HandleResponse::default(),
            LimitOrderHandle::SetBid(x) =>
              HandleResponse::default(),
        })
    }
}
```

#### Proposed macro syntax for `CL3`

```rust
#[feature] trait MyFeature {
    #[handle] type Handle = LimitOrderHandle;
    #[query]  type Query  = LimitOrderQuery;
}
```

or full form, which allows for pre/post processing
of dispatch results:

```rust
#[feature] trait MyFeature {
    #[handle] fn handle (self, env: &Env, msg: LimitOrderHandle) {
        msg.dispatch(self, env)
    }
    #[query] fn query (self, msg: LimitOrderQuery) {
        msg.dispatch(self)
    }
}
```

Equivalent to:

```rust
pub trait MyFeature<S: Storage, A: Api, Q: Querier>:
   Composable<S, A, Q>
   + Sized
{
    fn init (&mut self, env: &Env, msg: InitMsg) -> StdResult<InitResponse> {
        Ok(InitResponse::default())
    }
    fn handle (&mut self, env: &Env, msg: LimitOrderHandle) -> StdResult<HandleResponse> {
        msg.dispatch(self, env)
    }
    fn query (&self, msg: LimitOrderQuery) -> StdResult<Binary> {
        msg.dispatch(self)
    }
}
```

#### Proposed macro syntax for `CL4`

```rust
#[contract] trait MyContract {
    #[init] fn init (self, env: Env, msg: InitMsg) {
        Ok(InitResponse::default())
    }
    #[feature] MyFeature
    #[feature] MyOtherFeature
    // ...
}
```

Equivalent to:

`TODO`

---

Made with [💚](mailto:hello@hack.bg) at [Hack.bg](https://hack.bg).
