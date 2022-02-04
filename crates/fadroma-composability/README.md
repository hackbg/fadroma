# Fadroma Composability

## Level 0: Builder pattern for response messages

`TODO`

## Level 1: Making a struct or enum API-aware

The `Composable` trait in [`composable`](./composable.rs)
wraps the CosmWasm API's `Extern` object. Implementing it
on your structs lets you substitute `MockExtern` in testing.

Let's try with a query response.

### Step 1. Define your struct as normal.

```rust
#[derive(Clone,Debug,PartialEq,Serialize,Deserialize,JsonSchema)]
#[serde(rename_all="snake_case")]
#[serde(deny_unknown_fields)]
pub enum Response {
    Foo((String, String)),
    Bar(Uint128)
}
```

### Step 2. Define an interface trait for your methods.

This intermediate step trait is necessary to define the `S, A, Q`
generics, necessary to be able to write the type of `Composable<S, A, Q>`.

This is a place where Rust's type system falls slightly short.
If not for an interface trait, you'd need 3 PhantomData fields
on every API-aware struct, making it unwieldy to write that
struct as a literal. As it is, the interface struct can serve
as a neat little table of contents.

```rust
pub trait IResponse<S, A, Q, C>: Sized where
    S: Storage, A: Api, Q: Querier,
    C: Composable<S, A, Q>
{
    fn foo (core: &C) -> StdResult<Self>;
    fn bar (core: &C, address: HumanAddr, key: String) -> StdResult<Self>;
}
```

### Step 3. Implement your methods.

Implement the methods defined in the intermediate trait like this.
Congratulations, they can now use the Fadroma Composable `core`,
and the struct can be used as a building block for a reusable
contract layer. Let's see how to do that next.

```rust
impl<S, A, Q, C> IResponse<S, A, Q, C> for Response where
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

## Level 2: Dispatch traits

The `QueryDispatch<S, A, Q, C, R>`
and `HandleDispatch<S, A, Q, C>` traits
are the two **dispatch traits**.

The traits of the API-aware structs from Level 1 implement
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
impl<S, A, Q, C> QueryDispatch<S, A, Q, C, Response> for Query where
    S: Storage, A: Api, Q: Querier,
    C: Contract<S, A, Q>
{
    fn dispatch_query (self, core: &C) -> StdResult<Response> {
        Ok(match self {
            Query::GetFoo          => Response::foo(core)?,
            Query::GetBar { x, y } => Response::bar(core, x, y)?
        })
    }
}
```

## Level 3: Inherit from `Composable` to define reusable contract traits

Implement those traits for `Extern` to define a contract.
Implement them for `MockExtern` from [`composable_test`](./composable_test.rs)
and you can clone partial test contents so that you can write
branching tests.

Trim down traits that implement generic features into a reusable form
and add them to Fadroma to collect a library of smart contract primitives.

## Level 4: Going from composable traits to composed contract.

## Appendix A: Proposed syntax for the integration of composable traits in `fadroma-derive-contract`

`TODO:` Integrate with `fadroma-derive-contract`.

<table>

<tr><td valign="top">

### Level 0

Builder pattern for response messages

</td><td>

No changes needed other than reexporting `ResponseBuilder`
from `mod response` by default. CosmWasm's `InitResponse`
and `HandleResponse` will automatically gain the extra methods.

</td></tr>

<tr><td valign="top">

### Level 1

Extension to `#[message]` macro to allow in-place definition of API-aware variant constructors

The following syntax contains all the information needed to define the above
struct + 2 traits.

* [ ] Its implementation is tracked by [#48](https://github.com/hackbg/fadroma/issues/48)

</td><td>

```rust
/// before:
#[derive(Clone,Debug,PartialEq,Serialize,Deserialize,JsonSchema)]
#[serde(rename_all="snake_case")]
#[serde(deny_unknown_fields)]
pub enum Response {
    Foo((String, String)),
    Bar(Uint128)
}

/// after:
#[message] Response {
    Foo((String, String)),
    Bar(Uint128)
}

/// with variant constructors (optional):
#[message] Response {
    Foo((String, String)): fn foo (core) {
        Ok(Self::Foo(("Hello".into(), Self::helper())))
    }
    Bar(Uint128): fn bar (core, x: HumanAddr, y: String) {
        Ok(Self::Bar(Uint128::MAX))
    }
    /// a variant is also optional in this position:
    fn helper () -> String { "World".into() }
}

// Usage:
let (hello, world) = Response::Foo(core)
```

</td></tr>

<tr><td valign="top">

### Level 2

Extension to `#[query]` and `#[dispatch]` macros to implement
dispatch traits on the enums that they generate.

</td><td>

```rust
#[query] Query<Response> {
    GetFoo: fn get_foo (core) {
        Ok(Response::foo(core))
    }
    GetBar { x: HumanAddr, y: String }: fn get_bar (core, x, y) {
        Ok(Response::bar(core, x, y))
    }
}
```

<td></tr>

</table>
