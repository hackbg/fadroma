# Fadroma Composability

## Composability Level 0: Builder traits

> See [`mod builder`](./builder.rs)

`TODO`

## Composability Level 1: Message traits

> See [`mod composable`](./composable.rs)

<table>

<tr><td valign="top">

### Step 1. Define your struct as normal.

```rust
#[derive(Clone,Debug,PartialEq,Serialize,Deserialize,JsonSchema)]
#[serde(rename_all="snake_case")]
#[serde(deny_unknown_fields)]
pub enum LimitOrder {
    Ask((String, String)),
    Bid(Uint128)
}
```

</td><td>

</td></tr>

<tr></tr>

<tr><td>

### Step 2. Define an interface trait for your methods.

```rust
pub trait ILimitOrder<S, A, Q, C>: Sized where
    S: Storage, A: Api, Q: Querier,
    C: Composable<S, A, Q>
{
    fn ask (core: &C) -> StdResult<Self>;
    fn bid (core: &C) -> StdResult<Self>;
}
```

This intermediate step trait is necessary to define the `S, A, Q`
generics, necessary to be able to write the type of `Composable<S, A, Q>`.

</td><td>

This is a place where Rust's type system falls slightly short.
The alternative to the extra trait would be 3 `PhantomData` fields.

On an enum they could be hidden away on a never-instantiated variant.
On a struct, you'd have to init them every time you write the struct.

As it is, the interface struct can make a useful "table of contents"
for the functionality implemented on each message.

</td></tr>

<tr></tr>

<tr><td>

### Step 3. Implement your methods.

```rust
impl<S, A, Q, C> ILimitOrder<S, A, Q, C> for LimitOrder where
    S: Storage, A: Api, Q: Querier,
    C: Composable<S, A, Q>
{
    fn ask (core: &C, ask: Option<Uint128>) -> StdResult<Self> {
        Ok(Self::Ask(ask.ok_or(core.get("ask")?))
    }
    fn bid (core: &C) -> StdResult<Self> {
        Ok(Self::Bid(ask.ok_or(core.get("bid")?))
    }
}
```

Congratulations, this enum is now **API-aware**.

</td><td>

This means that its variant constructors can now use the Fadroma Composable `core`.

The enum itself can be used as the most basic building block of
a reusable contract layer: a representation of a single API message.

</td></tr>

<tr></tr>

<tr><td>

### Step 4. Usage

```rust
let order = LimitOrder::ask(core)?;
```

</td><td>

The **message trait** defines and implements 1 associated function
per variant, in order to construct the different variants from the
parameters + data from `core`.

</td></tr>

</table>

## Composability Level 2: Dispatch traits

> See [`mod dispatch`](./dispatch.rs)

<table>

<tr><td>

In contrast with the message trait from Level 1,
a **dispatch trait** starts with an instantiated
variant of the dispatch enum (`self`), and calls
functions corresponding to the enum variants.

```rust
let response = SomeQuery::GetAsk.dispatch(core)?;
let response = SomeHandle::SetAsk("Something".into()).dispatch(core)?;
```

`QueryDispatch<S, A, Q, C, R>` and `HandleDispatch<S, A, Q, C>`
are the two **dispatch traits**.

</td></tr><tr></tr><tr><td>

### Step 1. Implementing `QueryDispatch<S, A, Q, C, R>`:

```rust
#[derive(...)]
#[serde(rename_all="snake_case")]
pub enum QuerySomething {                                                                   
    GetAsk,                                                          
    GetBid { HumanAddr, String },
}
impl<S, A, Q, C> QueryDispatch<S, A, Q, C, LimitOrder>
for QuerySomething where
    S: Storage, A: Api, Q: Querier,
    C: Contract<S, A, Q>
{
    fn dispatch (self, core: &C) -> StdResult<LimitOrder> {
        Ok(match self {
            QuerySomething::GetAsk =>
              LimitOrder::ask(core)?,
            QuerySomething::GetBid { x, y } =>
              LimitOrder::bid(core, x, y)?
        })
    }
}
```

</td></tr><tr><td>

### Step 2. Implementing `HandleDispatch<S, A, Q, C>`:

```rust
#[derive(...)]
#[serde(rename_all="snake_case")]
pub enum HandleSomething {
    SetAsk(String),
}

impl<S, A, Q, C> HandleDispatch<S, A, Q, C>
for Handle where
    S: Storage, A: Api, Q: Querier,
    C: Contract<S, A, Q>
{
    fn dispatch (self, core: &C) -> StdResult<LimitOrder> {
        Ok(match self {
            HandleSomething::SetAsk(x) =>
              HandleResponse::default()
        })
    }
}
```

</td></tr>

<table>


## Composability Level 3: Inherit from `Composable` to define reusable contract traits

Implement those traits for `Extern` to define a contract.
Implement them for `MockExtern` from [`composable_test`](./composable_test.rs)
and you can clone partial test contents so that you can write
branching tests.

Trim down traits that implement generic features into a reusable form
and add them to Fadroma to collect a library of smart contract primitives.

## Composability Level 4: Going from composable traits to composed contract.

## Appendix A: Proposed syntax for the integration of composable traits in `fadroma-derive-contract`

`TODO:` Integrate with `fadroma-derive-contract`.

<table>

<tr><td valign="top">

**Composability Level 0:** Builder pattern for response messages

</td><td>

No changes needed other than reexporting `ResponseBuilder`
from `mod response` by default.

CosmWasm's `InitResponse` and `HandleResponse`
will automatically gain the extra methods.

</td></tr>

<tr><td valign="top">

**Composability Level 1:** Extension to `#[message]` macro to allow
in-place definition of API-aware variant constructors.

The following syntax contains all the information needed to define the above
enum + trait + impl.

* [ ] Its implementation is tracked by [#48](https://github.com/hackbg/fadroma/issues/48)

</td><td>

Before:
```rust
#[derive(Clone,Debug,PartialEq,Serialize,Deserialize,JsonSchema)]
#[serde(rename_all="snake_case")]
#[serde(deny_unknown_fields)]
pub enum LimitOrder {
    Ask((String, String)),
    Bid(Uint128)
}
```

After:
```rust
#[message] LimitOrder {
    Ask((String, String)),
    Bid(Uint128)
}
```

With optional variant constructors:
```rust
#[message] LimitOrder {
    Ask((String, String)) <= fn ask (core, x: Option<String>) {
        Ok(Self::Ask(("Hello".into(), x.ok_or(Self::helper()))))
    }
    Bid(Uint128) <= fn bid (core, x: HumanAddr, y: String) {
        Ok(Self::Bid(Uint128::MAX))
    }
    /// a variant is also optional in this position:
    fn helper () -> String { "World".into() }
}
```

Usage:
```rust
let (hello, world) = LimitOrder::ask(core)
```

</td></tr>

<tr><td valign="top">

**Composability Level 2:** Extension to `#[query]` and `#[handle]` macros
to implement dispatch traits on the enums that they generate.

</td><td>

```rust
#[query] QuerySomething<LimitOrder> {
    GetAsk => fn get_ask (core) {
        const x = core.get("ask")?;
        Ok(LimitOrder::ask(core, x))
    }
    GetBid { x: HumanAddr, y: String } => fn get_bid (core, x, y) {
        Ok(LimitOrder::bid(core, x, y))
    }
}
#[handle] HandleSomething<LimitOrder> {
    SetAsk(x: String) => fn set_ask (core, x) {
        core.set("ask", x)?;
        Ok(HandleResponse::default())
    }
}
```

<td></tr>

</table>
