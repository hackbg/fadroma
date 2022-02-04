# Fadroma Composability

## Composability Level 0: Builder pattern for response messages

`TODO`

## Composability Level 1: Making a struct or enum API-aware

The `Composable` trait in [`composable`](./composable.rs)
wraps the CosmWasm API's `Extern` object. Implementing it
on your structs lets you substitute `MockExtern` in testing.

Let's try with a query's `Response`.

<table> <tr><td valign="top" colspan="2">

### Step 1. Define your struct as normal.

</td>

<tr><td colspan="2">

```rust
#[derive(Clone,Debug,PartialEq,Serialize,Deserialize,JsonSchema)]
#[serde(rename_all="snake_case")]
#[serde(deny_unknown_fields)]
pub enum SomeResponse {
    Foo((String, String)),
    Bar(Uint128)
}
```

</td></tr>

<tr><td valign="top" colspan="2">

### Step 2. Define an interface trait for your methods.

</td></tr>
<tr><td>

```rust
pub trait ISomeResponse<S, A, Q, C>: Sized where
    S: Storage, A: Api, Q: Querier,
    C: Composable<S, A, Q>
{
    fn foo (core: &C) -> StdResult<Self>;
    fn bar (core: &C, address: HumanAddr, key: String) -> StdResult<Self>;
}
```

</td><td>

This intermediate step trait is necessary to define the `S, A, Q`
generics, necessary to be able to write the type of `Composable<S, A, Q>`.

This is a place where Rust's type system falls slightly short.
If not for an interface trait, you'd need 3 PhantomData fields
on every API-aware struct, making it unwieldy to write that
struct as a literal. As it is, the interface struct can serve
as a neat little table of contents.

</td></tr>

<tr><td valign="top" colspan="2">

### Step 3. Implement your methods.

</td></tr><tr><td>

```rust
impl<S, A, Q, C> ISomeResponse<S, A, Q, C> for SomeResponse where
    S: Storage, A: Api, Q: Querier,
    C: Composable<S, A, Q>
{
    fn foo (core: &C) -> StdResult<Self> {
        Ok(Self::Foo(("Hello".into(), "World".into())))
    }
    fn bar (core: &C, address: HumanAddr, key: String) -> StdResult<Self> {
        Ok(Self::Bar(Uint128::MAX))
    }
}
```

</td><td>

Implement the methods defined in the intermediate trait.
Congratulations, now this enum is **API-aware**. This means that
its variant constructors can now use the Fadroma Composable `core`,
and the enum itself can be used as the most basic building block of
a reusable contract layer - the representation of a single API message.

</td></tr>

</table>

## Composability Level 2: Dispatch traits

The `QueryDispatch<S, A, Q, C, R>`
and `HandleDispatch<S, A, Q, C>` traits
are the two **dispatch traits**.

The traits of the API-aware structs from Composability Level 1 implement
1 associated function per variant, in order to construct
the different variants with proper parameters and preparation.

In contrast, a dispatch trait starts with an instantiated
variant of the dispatch enum, and calls external functions
corresponding to the enum variants.

In continuation of the `Response` example,
here's the `Query` that returns the different responses:

```rust
#[derive(Clone,Debug,PartialEq,serde::Serialize,Deserialize,schemars::JsonSchema)]
#[serde(rename_all="snake_case")]
pub enum Query {                                                                   
    GetFoo,                                                          
    GetBar { HumanAddr, String },
}
impl<S, A, Q, C> QueryDispatch<S, A, Q, C, SomeResponse> for Query where
    S: Storage, A: Api, Q: Querier,
    C: Contract<S, A, Q>
{
    fn dispatch_query (self, core: &C) -> StdResult<SomeResponse> {
        Ok(match self {
            Query::GetFoo          => SomeResponse::foo(core)?,
            Query::GetBar { x, y } => SomeResponse::bar(core, x, y)?
        })
    }
}
```

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
struct + 2 traits.

* [ ] Its implementation is tracked by [#48](https://github.com/hackbg/fadroma/issues/48)

</td><td>

Before:
```rust
#[derive(Clone,Debug,PartialEq,Serialize,Deserialize,JsonSchema)]
#[serde(rename_all="snake_case")]
#[serde(deny_unknown_fields)]
pub enum SomeResponse {
    Foo((String, String)),
    Bar(Uint128)
}
```

After:
```rust
#[message] SomeResponse {
    Foo((String, String)),
    Bar(Uint128)
}
```

With optional variant constructors:
```rust
#[message] SomeResponse {
    Foo((String, String)) <= fn foo (core, x: Option<String>) {
        Ok(Self::Foo(("Hello".into(), x.ok_or(Self::helper()))))
    }
    Bar(Uint128) <= fn bar (core, x: HumanAddr, y: String) {
        Ok(Self::Bar(Uint128::MAX))
    }
    /// a variant is also optional in this position:
    fn helper () -> String { "World".into() }
}
```

Usage:
```rust
let (hello, world) = SomeResponse::foo(core)
```

</td></tr>

<tr><td valign="top">

**Composability Level 2:** Extension to `#[query]` and `#[handle]` macros
to implement dispatch traits on the enums that they generate.

</td><td>

```rust
#[query] QuerySomething<SomeResponse> {
    GetFoo => fn get_foo (core) {
        const x = core.get("foo")?;
        Ok(SomeResponse::foo(core, x))
    }
    GetBar { x: HumanAddr, y: String } => fn get_bar (core, x, y) {
        Ok(SomeResponse::bar(core, x, y))
    }
}
#[handle] HandleSomething<SomeResponse> {
    SetFoo(x: String) => fn set_foo (core, x) {
        core.set("foo", x)?;
        Ok(HandleResponse::default())
    }
}
```

<td></tr>

</table>
