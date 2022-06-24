use fadroma::{
    self,
    cosmwasm_std::{
        self,
        Uint128, HumanAddr,
        testing::mock_dependencies
    },
    prelude::{Canonize, Humanize}
};
use fadroma_derive_canonize::Canonize;

#[derive(Canonize, PartialEq, Clone)]
struct Test {
    pub addr: HumanAddr,
    amount: Uint128
}

#[derive(Canonize, PartialEq, Clone)]
struct TestTuple(pub HumanAddr, Uint128);

impl Default for Test {
    fn default() -> Self {
        Self {
            addr: HumanAddr::from("marigold"),
            amount: Uint128(100)
        }
    }
}

impl Default for TestTuple {
    fn default() -> Self {
        Self(HumanAddr::from("flatline"), Uint128(200))
    }
}

#[test]
fn test_derive() {
    let deps = mock_dependencies(20, &[]);

    let test = Test::default();

    let canon = test.clone().canonize(&deps.api).unwrap();

    let canonized = TestCanon {
        addr: test.addr.clone().canonize(&deps.api).unwrap(),
        amount: test.amount
    };

    assert_eq!(canon.addr, canonized.addr);
    assert_eq!(canon.amount, canonized.amount);

    let human = canonized.humanize(&deps.api).unwrap();

    assert_eq!(test.addr, human.addr);
    assert_eq!(test.amount, human.amount);
}

#[test]
fn test_derive_tuple() {
    let deps = mock_dependencies(20, &[]);

    let test = TestTuple::default();

    let canon = test.clone().canonize(&deps.api).unwrap();

    let canonized = TestTupleCanon(
        test.0.clone().canonize(&deps.api).unwrap(),
        test.1
    );

    assert_eq!(canon.0, canonized.0);
    assert_eq!(canon.1, canonized.1);

    let human = canonized.humanize(&deps.api).unwrap();

    assert_eq!(test.0, human.0);
    assert_eq!(test.1, human.1);
}
