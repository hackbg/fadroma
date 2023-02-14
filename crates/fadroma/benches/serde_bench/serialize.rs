use std::str::FromStr;

use criterion::Criterion;
use secret_cosmwasm_std::{Addr, Binary, Uint128, Decimal256, to_vec};
use serde::{Serialize, Deserialize};
use fadroma::{
    tokens::one_token,
    bin_serde::{FadromaSerialize, FadromaDeserialize, Serializer}
};

criterion::criterion_group!(serialize, fadroma, bincode2, cosmwasm);

#[derive(FadromaSerialize, FadromaDeserialize, Serialize, Deserialize)]
pub struct Account {
    address: Addr,
    balances: Vec<Balance>,
    rate: Decimal256,
    hash: Binary
}

#[derive(FadromaSerialize, FadromaDeserialize, Serialize, Deserialize)]
pub struct Balance {
    denom: String,
    amount: Uint128
}

fn fadroma(c: &mut Criterion) {
    let acc = Account::new();
    
    c.bench_function("fadroma", |b| {
        b.iter(|| {
            let mut ser = Serializer::with_capacity(acc.size_hint());
            acc.to_bytes(&mut ser).unwrap()
        })
    });
}

fn bincode2(c: &mut Criterion) {
    let acc = Account::new();

    c.bench_function("bincode2", |b| {
        b.iter(|| bincode2::serialize(&acc).unwrap())
    });
}

fn cosmwasm(c: &mut Criterion) {
    let acc = Account::new();

    c.bench_function("cosmwasm", |b| {
        b.iter(|| to_vec(&acc).unwrap())
    });
}

impl Account {
    fn new() -> Self {
        let balances = vec![
            Balance::new("SSCRT", 10 * one_token(6)),
            Balance::new("SIENNA", 100 * one_token(18)),
            Balance::new("BTC", 1000 * one_token(3)),
            Balance::new("ETH", 10000 * one_token(18)),
        ];

        Self {
            address: Addr::unchecked("secret1k0jntykt7e4g3y88ltc60czgjuqdy4c9e8fzek"),
            balances,
            rate: Decimal256::from_str("123456789.987654321").unwrap(),
            hash: Binary(vec![33u8; 32])
        }
    }
}

impl Balance {
    fn new(denom: impl Into<String>, amount: u128) -> Self {
        Self {
            denom: denom.into(),
            amount: Uint128::new(amount)
        }
    }
}
