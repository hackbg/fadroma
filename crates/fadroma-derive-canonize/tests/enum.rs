use fadroma::{
    self,
    cosmwasm_std::{self, testing::mock_dependencies, Addr, Uint128},
    prelude::Canonize,
};

#[derive(Canonize, PartialEq, Clone, serde::Serialize, serde::Deserialize)]
enum TestEnum {
    TestVarTwo { from: Addr, to: Addr },
    TestVar(Addr, Uint128),
}

#[derive(Canonize, PartialEq, Clone, serde::Serialize)]
enum TestEnumGeneric<A> {
    TestVar(A, Uint128),
    TestVarTwo { from: A, to: A, arg: Uint128 },
}

#[test]
fn test_derive_enum() {
    let addr_1 = Addr::unchecked("Alice");
    let addr_2 = Addr::unchecked("Bob");
    let deps = mock_dependencies();

    let test = TestEnum::TestVarTwo {
        from: addr_1.clone(),
        to: addr_2.clone(),
    };

    match test.canonize(&deps.api).unwrap() {
        TestEnumCanon::TestVarTwo { from: x, to: y } => {
            assert_eq!(x, addr_1.clone().canonize(&deps.api).unwrap());
            assert_eq!(y, addr_2.clone().canonize(&deps.api).unwrap());
        }
        _ => unreachable!(),
    };

    let test = TestEnum::TestVar(addr_1.clone(), Uint128::from(128u128));

    match test.canonize(&deps.api).unwrap() {
        TestEnumCanon::TestVar(x, y) => {
            assert_eq!(x, addr_1.clone().canonize(&deps.api).unwrap());
            assert_eq!(y, Uint128::from(128u128).canonize(&deps.api).unwrap());
            assert_eq!(y, Uint128::from(128u128));
        }
        _ => unreachable!(),
    }

    let test = TestEnumGeneric::TestVar(addr_1.clone(), Uint128::from(128u128))
        .canonize(&deps.api)
        .unwrap();

    match test {
        TestEnumGeneric::TestVar(x, y) => {
            assert_eq!(x, addr_1.clone().canonize(&deps.api).unwrap());
            assert_eq!(y, Uint128::from(128u128).canonize(&deps.api).unwrap());
            assert_eq!(y, Uint128::from(128u128));
        }
        _ => unreachable!(),
    };

    let test = TestEnumGeneric::TestVarTwo {
        from: addr_1.clone(),
        to: addr_2.clone(),
        arg: Uint128::from(128u128),
    }
    .canonize(&deps.api)
    .unwrap();

    match test {
        TestEnumGeneric::TestVarTwo {
            from: x,
            to: y,
            arg: z,
        } => {
            assert_eq!(x, addr_1.canonize(&deps.api).unwrap());
            assert_eq!(y, addr_2.canonize(&deps.api).unwrap());
            assert_eq!(z, Uint128::from(128u128));
        }
        _ => unreachable!(),
    };
}
