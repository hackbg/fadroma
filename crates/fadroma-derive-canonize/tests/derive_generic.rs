use std::fmt::Debug;

use fadroma::{
    self,
    cosmwasm_std::{self, testing::mock_dependencies, Addr, Uint128},
    prelude::{
        storage, Binary, CanonicalAddr, Canonize,
        Humanize, FadromaSerialize, FadromaDeserialize
    },
};

#[derive(Canonize, PartialEq, Clone, Debug, FadromaSerialize, FadromaDeserialize)]
struct Test<T> {
    addr: T,
    amount: Uint128,
}

impl Default for Test<Addr> {
    fn default() -> Self {
        Test {
            addr: Addr::unchecked(""),
            amount: Uint128::default(),
        }
    }
}

impl Default for Test<CanonicalAddr> {
    fn default() -> Self {
        Test {
            addr: CanonicalAddr(Binary(Vec::new())),
            amount: Uint128::default(),
        }
    }
}

#[derive(Canonize, PartialEq, Clone, Debug, FadromaSerialize, FadromaDeserialize)]
struct TestBounds<T: Clone> {
    addr: T,
    amount: Uint128,
}

impl Default for TestBounds<Addr> {
    fn default() -> Self {
        TestBounds {
            addr: Addr::unchecked(""),
            amount: Uint128::default(),
        }
    }
}

impl Default for TestBounds<CanonicalAddr> {
    fn default() -> Self {
        TestBounds {
            addr: CanonicalAddr(Binary(Vec::new())),
            amount: Uint128::default(),
        }
    }
}
#[derive(Canonize, Clone)]
struct TestTuple<T>(T, Uint128);

impl Default for TestTuple<Addr> {
    fn default() -> Self {
        TestTuple(Addr::unchecked(""), Uint128::default())
    }
}

impl Default for TestTuple<CanonicalAddr> {
    fn default() -> Self {
        TestTuple(CanonicalAddr(Binary(Vec::new())), Uint128::default())
    }
}
#[derive(Canonize, Clone)]
struct TestTupleBounds<T: Clone>(T, Uint128);

impl Default for TestTupleBounds<Addr> {
    fn default() -> Self {
        TestTupleBounds(Addr::unchecked(""), Uint128::default())
    }
}

impl Default for TestTupleBounds<CanonicalAddr> {
    fn default() -> Self {
        TestTupleBounds(CanonicalAddr(Binary(Vec::new())), Uint128::default())
    }
}

#[test]
fn test_derive_generic() {
    do_test(Test::default());
    do_test(TestBounds::default());

    let deps = mock_dependencies();

    let a: Test<Addr> = Test::default();
    let b = a.clone().canonize(&deps.api).unwrap();

    assert_eq!(b.amount, a.amount);

    let a: TestTuple<Addr> = TestTuple::default();
    let b = a.clone().canonize(&deps.api).unwrap();

    assert_eq!(b.1, a.1);

    let a: TestTupleBounds<Addr> = TestTupleBounds::default();
    let b = a.clone().canonize(&deps.api).unwrap();

    assert_eq!(b.1, a.1);
}

fn do_test<T: Canonize + Clone + PartialEq + Debug + FadromaSerialize + FadromaDeserialize>(value: T)
where
    <T as Canonize>::Output: FadromaSerialize + FadromaDeserialize
{
    let mut deps = mock_dependencies();

    storage::save(&mut deps.storage, b"store", &value).unwrap();

    let canon = value.clone().canonize(&deps.api).unwrap();
    storage::save(&mut deps.storage, b"store", &canon).unwrap();

    let canon: <T as Canonize>::Output = storage::load(
        &mut deps.storage,
        b"store"
    )
    .unwrap()
    .unwrap();
    
    canon.humanize(&deps.api).unwrap();
}
