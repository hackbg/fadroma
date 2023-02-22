
use criterion::Criterion;
use fadroma::{
    cosmwasm_std::{to_vec, from_slice},
    bin_serde::{FadromaSerializeExt, Deserializer}
};

use super::Account;

criterion::criterion_group!(deserialize, fadroma, bincode2, cosmwasm);

fn fadroma(c: &mut Criterion) {
    let acc = Account::new();
    let bytes = FadromaSerializeExt::serialize(&acc).unwrap();
    
    c.bench_function("fadroma_de", |b| {
        b.iter(|| {
            let mut de = Deserializer::from(&bytes);
            de.deserialize::<Account>().unwrap();
        })
    });
}

fn bincode2(c: &mut Criterion) {
    let acc = Account::new();
    let bytes = bincode2::serialize(&acc).unwrap();

    c.bench_function("bincode2_de", |b| {
        b.iter(|| bincode2::deserialize::<Account>(&bytes).unwrap())
    });
}

fn cosmwasm(c: &mut Criterion) {
    let acc = Account::new();
    let bytes = to_vec(&acc).unwrap();

    c.bench_function("cosmwasm_de", |b| {
        b.iter(|| from_slice::<Account>(&bytes).unwrap())
    });
}
