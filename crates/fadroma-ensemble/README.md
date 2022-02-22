<div align="center">
<table><tr><td valign="middle" style="vertical-align:bottom">

[<img src="https://github.com/hackbg/fadroma/raw/22.01/doc/logo.svg" width="300">](https://fadroma.tech)

</td><td valign="center">

# Fadroma Ensemble ![](https://img.shields.io/badge/version-0.1.0-blueviolet)

**This document describes how to write tests for CosmWasm smart contracts with multi-contract interactions using `fadroma-ensemble`**

Made with [💚](mailto:hello@hack.bg) at [Hack.bg](https://hack.bg).

</td></tr></table>

</div>

## Introduction
Fadroma Ensemble provides a way to test multi-contract interactions without having to deploy contracts on-chain.

## Getting started
To start testing with ensemble `ContractHarness` has to be implemented for each contract and registered by the `ContractEnsemble`. This approach allows a lot of flexibility for testing contracts. Mock implementations can be created, contract methods can be overridden, `Bank` interactions are also possible.

### ContractHarness

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
    fn query(&self, _deps: &MockDeps, msg: Binary) -> StdResult<Binary> {
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