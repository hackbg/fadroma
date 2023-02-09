use std::str::FromStr;

use criterion::Criterion;
use secret_cosmwasm_std::{Addr, Binary, Uint128, Decimal256, to_vec};
use serde::{Serialize, Deserialize};
use fadroma::{
    tokens::one_token,
    bin_serde::{
        FadromaSerialize, FadromaDeserialize,
        FadromaSerializeExt, Serializer, Deserializer,
        Result
    }
};

criterion::criterion_group!(serialize, fadroma, bincode2, cosmwasm);

#[derive(Serialize, Deserialize)]
pub struct Account {
    address: Addr,
    balances: Vec<Balance>,
    rate: Decimal256,
    hash: Binary
}

#[derive(Serialize, Deserialize)]
pub struct Balance {
    denom: String,
    amount: Uint128
}

fn fadroma(c: &mut Criterion) {
    let acc = Account::new();

    c.bench_function("fadroma", |b| {
        b.iter(|| FadromaSerializeExt::serialize(&acc).unwrap())
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

impl FadromaSerialize for Account {
    #[inline]
    fn size_hint(&self) -> usize {
        self.address.size_hint() + self.balances.size_hint() +
        self.rate.size_hint() + self.hash.size_hint()
    }

    #[inline]
    fn to_bytes(&self, ser: &mut Serializer) -> Result<()> {
        self.address.to_bytes(ser)?;
        self.balances.to_bytes(ser)?;
        self.rate.to_bytes(ser)?;

        self.hash.to_bytes(ser)
    }
}

impl FadromaSerialize for Balance {
    #[inline]
    fn size_hint(&self) -> usize {
        self.denom.size_hint() + self.amount.size_hint()
    }

    #[inline]
    fn to_bytes(&self, ser: &mut Serializer) -> Result<()> {
        self.denom.to_bytes(ser)?;

        self.amount.to_bytes(ser)
    }
}

impl FadromaDeserialize for Account {
    #[inline]
    fn from_bytes(de: &mut Deserializer) -> Result<Self> {
        Ok(Self {
            address: de.deserialize()?,
            balances: de.deserialize()?,
            rate: de.deserialize()?,
            hash: de.deserialize()?
        })
    }
}

impl FadromaDeserialize for Balance {
    #[inline]
    fn from_bytes(de: &mut Deserializer) -> Result<Self> {
        Ok(Self {
            denom: de.deserialize()?,
            amount: de.deserialize()?
        })
    }
}
