use fadroma::{
    self,
    cosmwasm_std::{self, testing::mock_dependencies, Addr, Uint128},
    prelude::{storage, Canonize, Humanize, FadromaSerialize},
};

#[derive(Canonize, PartialEq, Clone, FadromaSerialize)]
struct Test {
    pub addr: Addr,
    amount: Uint128,
}

#[derive(Canonize, PartialEq, Clone, FadromaSerialize)]
struct TestTuple(pub Addr, Uint128);

impl Default for Test {
    fn default() -> Self {
        Self {
            addr: Addr::unchecked("marigold"),
            amount: Uint128::new(100),
        }
    }
}

impl Default for TestTuple {
    fn default() -> Self {
        Self(Addr::unchecked("flatline"), Uint128::new(200))
    }
}

#[test]
fn test_derive() {
    let mut deps = mock_dependencies();

    let test = Test::default();

    storage::save(&mut deps.storage, b"store", &test).unwrap();

    let canon = test.clone().canonize(&deps.api).unwrap();

    let canonized = TestCanon {
        addr: test.addr.clone().canonize(&deps.api).unwrap(),
        amount: test.amount,
    };

    storage::save(&mut deps.storage, b"store", &canonized).unwrap();

    assert_eq!(canon.addr, canonized.addr);
    assert_eq!(canon.amount, canonized.amount);

    let human = canonized.humanize(&deps.api).unwrap();

    assert_eq!(test.addr, human.addr);
    assert_eq!(test.amount, human.amount);
}

#[test]
fn test_derive_tuple() {
    let deps = mock_dependencies();

    let test = TestTuple::default();

    let canon = test.clone().canonize(&deps.api).unwrap();

    let canonized = TestTupleCanon(test.0.clone().canonize(&deps.api).unwrap(), test.1);

    assert_eq!(canon.0, canonized.0);
    assert_eq!(canon.1, canonized.1);

    let human = canonized.humanize(&deps.api).unwrap();

    assert_eq!(test.0, human.0);
    assert_eq!(test.1, human.1);
}
