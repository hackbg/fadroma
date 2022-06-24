use std::fmt::Debug;

use fadroma::{
    self,
    cosmwasm_std::{
        self,
        Uint128, HumanAddr,
        testing::mock_dependencies
    },
    prelude::{Canonize, Humanize, save, load}
};
use serde::{Serialize, Deserialize, de::DeserializeOwned};

#[derive(Canonize, PartialEq, Clone, Default, Debug)]
#[derive(Serialize, Deserialize)]
struct Test<T> {
    addr: T,
    amount: Uint128
}

#[derive(Canonize, PartialEq, Clone, Default, Debug)]
#[derive(Serialize, Deserialize)]
struct TestBounds<T: Clone> where T: Default {
    addr: T,
    amount: Uint128
}

#[derive(Canonize, Default, Clone)]
struct TestTuple<T>(T, Uint128);

#[derive(Canonize, Default, Clone)]
struct TestTupleBounds<T: Clone>(T, Uint128) where T: Default;

#[test]
fn test_derive_generic() {
    do_test(Test::default());
    do_test(TestBounds::default());

    let deps = mock_dependencies(20, &[]);

    let a: Test<HumanAddr> = Test::default();
    let b = a.clone().canonize(&deps.api).unwrap();

    assert_eq!(b.amount, a.amount);

    let a: TestTuple<HumanAddr> = TestTuple::default();
    let b = a.clone().canonize(&deps.api).unwrap();

    assert_eq!(b.1, a.1);

    let a: TestTupleBounds<HumanAddr> = TestTupleBounds::default();
    let b = a.clone().canonize(&deps.api).unwrap();

    assert_eq!(b.1, a.1);
}

fn do_test<T: Canonize + Clone + PartialEq + Debug + Serialize + DeserializeOwned>(value: T)
    where <T as Canonize>::Output: Serialize + DeserializeOwned
{
    let mut deps = mock_dependencies(20, &[]);

    save(&mut deps.storage, b"store", &value).unwrap();

    let canon = value.clone().canonize(&deps.api).unwrap();
    save(&mut deps.storage, b"store", &canon).unwrap();

    let canon: <T as Canonize>::Output = load(&mut deps.storage, b"store").unwrap().unwrap();
    canon.humanize(&deps.api).unwrap();
}
