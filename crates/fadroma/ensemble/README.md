# Fadroma Ensemble

![](https://img.shields.io/badge/version-0.1.0-blueviolet)

**How to write multi-contract CosmWasm integration tests in Rust using `fadroma-ensemble`**

## Introduction
Fadroma Ensemble provides a way to test multi-contract interactions without having to deploy contracts on-chain.

## Getting started
To start testing with ensemble `ContractHarness` has to be implemented for each contract and registered by the `ContractEnsemble`. This approach allows a lot of flexibility for testing contracts. Mock implementations can be created, contract methods can be overridden, `Bank` interactions are also possible.

### ContractHarness
`ContractHarness` defines entrypoints to any contract: `init`, `handle`, `query`. In order to implement contract we can use `DefaultImpl` from existing contract code, or override contract methods.
```rust
// Here we create a ContractHarness implementation for an Oracle contract
use path::to::contracts::oracle;

pub struct Oracle;
impl ContractHarness for Oracle {
    // Use the method from the default implementation
    fn init(&self, _deps: &mut MockDeps, _env: Env, _msg: Binary) -> StdResult<InitResponse> {
        oracle::init(
            deps,
            env,
            from_binary(&msg)?,
            oracle::DefaultImpl,
        )
    }

    fn handle(&self, _deps: &mut MockDeps, _env: Env, _msg: Binary) -> StdResult<HandleResponse> {
         oracle::handle(
            deps,
            env,
            from_binary(&msg)?,
            oracle::DefaultImpl,
        )
    }

    // Override with some hardcoded value for the ease of testing
    fn query(&self, deps: &MockDeps, msg: Binary) -> StdResult<Binary> {
        let msg = from_binary(&msg).unwrap();
        match msg {
            oracle::QueryMsg::GetPrice { base_symbol: _, .. } => to_binary(&Uint128(1_000_000_000)),
            // don't override the rest
            _ => oracle::query(deps, from_binary(&msg)?, oracle::DefaultImpl)
        }
    }
}
```
### ContractEnsemble
`ContractEnsemble` is the centerpiece that takes care of managing contract storage and bank state and executing messages between contracts. Currently, supported messages are `CosmosMsg::Wasm` and `CosmosMsg::Bank`. It exposes methods like `register` for registering contract harnesses and `instantiate`, `execute`, `query` for interacting with contracts and methods to inspect/alter the raw storage if needed. Just like on the blockchain, if any contract returns an error during exection, all state is reverted.

```rust
#[test]
fn test_query_price() {
    let mut ensemble = ContractEnsemble::new(50);

    // register contract
    let oracle = ensemble.register(Box::new(Oracle));

    // instantiate
    let oracle = ensemble.instantiate(
        oracle.id,
        &{},
        MockEnv::new(
            "Admin",
            ContractLink {
                address: "oracle".into(),
                code_hash: oracle.code_hash,
            }
        )
    ).unwrap();

    // query
    let oracle::QueryMsg::GetPrice { price } = ensemble.query(
        oracle.address,
        &oracle::QueryMsg::GetPrice { base_symbol: "SCRT".into },
    ).unwrap();

    assert_eq!(price, Uint128(1_000_000_000));
}
```

### Simulating blocks
Since the ensemble is designed to simulate a blockchain environment it maintains an idea of block height and time. Block height increases automatically with each successful call to execute and instantiate messages (**sub-messages don't trigger this behaviour**). It is possible to configure as needed: blocks can be incremented by a fixed amount or by a random value within a provided range. In addition, the current block can be frozen so subsequent calls will not modify it if desired.
  
Set the block height manually:

```rust
let mut ensemble = ContractEnsemble::new(50);

ensemble.block_mut().height = 10;
ensemble.block_mut().time = 10000;
```

Use auto-increments (after each **successful** call) for block height and time when initializing the ensemble:

```rust
// For exact increments
ensemble.block_mut().exact_increments(10, 7);

// For random increments within specified ranges
ensemble.block_mut().random_increments(1..11, 1..9);
```
