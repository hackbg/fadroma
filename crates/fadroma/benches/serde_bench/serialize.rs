
use criterion::Criterion;
use fadroma::{
    cosmwasm_std::to_vec,
    bin_serde::{FadromaSerialize, Serializer}
};

use super::Account;

criterion::criterion_group!(serialize, fadroma, bincode2, cosmwasm);

fn fadroma(c: &mut Criterion) {
    let acc = Account::new();

    let mut ser = Serializer::with_capacity(acc.size_hint());
    acc.to_bytes(&mut ser).unwrap();

    println!("Byte size: {}", ser.finish().len());
    
    c.bench_function("fadroma_ser", |b| {
        b.iter(|| {
            let mut ser = Serializer::with_capacity(acc.size_hint());
            acc.to_bytes(&mut ser).unwrap()
        })
    });
}

fn bincode2(c: &mut Criterion) {
    let acc = Account::new();

    let bytes = bincode2::serialize(&acc).unwrap();
    println!("Byte size: {}", bytes.len());

    c.bench_function("bincode2_ser", |b| {
        b.iter(|| bincode2::serialize(&acc).unwrap())
    });
}

fn cosmwasm(c: &mut Criterion) {
    let acc = Account::new();

    let bytes = to_vec(&acc).unwrap();
    println!("Byte size: {}", bytes.len());

    c.bench_function("cosmwasm_ser", |b| {
        b.iter(|| to_vec(&acc).unwrap())
    });
}
