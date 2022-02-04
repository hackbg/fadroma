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
    Ask(Uint128),
    Bid(Uint128)
}
```

</td><td>

#### Proposed macro syntax for `CL1:S1-3`

```rust
#[message] LimitOrder {
    Ask(Uint128) <= fn ask (core: &C, price: Option<Uint128>) -> StdResult<Self> {
        Ok(Self::Ask(price.ok_or(core.get("ask")?))
    }
    Bid(Uint128) <= fn bid (core: &C, price: Option<Uint128>) -> StdResult<Self> {
        Ok(Self::Bid(price.ok_or(core.get("bid")?))
    }
}
```

</td></tr>

<tr></tr>

<tr><td>

### Step 2. Define an interface trait for your methods.

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
    fn ask (core: &C, price: Option<Uint128>) -> StdResult<Self> {
        Ok(Self::Ask(price.ok_or(core.get("ask")?))
    }
    fn bid (core: &C, price: Option<Uint128>) -> StdResult<Self> {
        Ok(Self::Bid(price.ok_or(core.get("bid")?))
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
let order = LimitOrder::ask(core, None)?;
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

<tr><td colspan="2">

In contrast with the message trait from CL1,
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
```

```rust
impl<S, A, Q, C> QueryDispatch<S, A, Q, C, LimitOrder>
for QuerySomething where
    S: Storage, A: Api, Q: Querier,
    C: Composable<S, A, Q>
{
    fn dispatch_query (self, core: &C) -> StdResult<LimitOrder> {
        Ok(match self {
            QuerySomething::GetAsk =>
              LimitOrder::ask(core)?,
            QuerySomething::GetBid { x, y } =>
              LimitOrder::bid(core, x, y)?
        })
    }
}
```

</td><td>

#### Proposed macro syntax for `CL2.S1`

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
```

</td>

</tr><tr></tr><tr><td>

### Step 2. Implementing `HandleDispatch<S, A, Q, C>`:

```rust
#[derive(...)]
#[serde(rename_all="snake_case")]
pub enum HandleSomething {
    SetAsk(String),
}
```

```rust
impl<S, A, Q, C> HandleDispatch<S, A, Q, C>
for Handle where
    S: Storage, A: Api, Q: Querier,
    C: Composable<S, A, Q>
{
    fn dispatch_handle (self, core: &C) -> StdResult<LimitOrder> {
        Ok(match self {
            HandleSomething::SetAsk(x) =>
              HandleResponse::default()
        })
    }
}
```

</td><td>

#### Proposed macro syntax for `CL2.S2`

```rust
#[handle] HandleSomething<LimitOrder> {
    SetAsk(x: String) => fn set_ask (core, x) {
        core.set("ask", x)?;
        Ok(HandleResponse::default())
    }
}
```

</td></tr>

<table>


## Composability Level 3: Feature traits

## Composability Level 4: Composed contract

Implement those traits for `Extern` to define a contract.
Implement them for `MockExtern` from [`composable_test`](./composable_test.rs)
and you can clone partial test contents so that you can write
branching tests.

## Composability Level 5: Reusable feature traits

Trim down traits that implement generic features into a reusable form
and add them to Fadroma to collect a library of smart contract primitives.
