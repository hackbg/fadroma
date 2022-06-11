use fadroma_proc_derive::*;
use serde::{Serialize, Deserialize};

#[derive(Serialize, DeserializeFlat, PartialEq, Debug)]
#[serde(rename_all = "snake_case")]
enum TestMsg {
    A {
        one: u8,
        two: u8
    },
    B(ChildMsg),
    C
}

#[derive(Serialize, Deserialize, PartialEq, Debug)]
#[serde(rename_all = "snake_case")]
enum ChildMsg {
    A { one: u8 }
}

#[test]
fn test_nested_enum() {
    let string = r#"{ "b": { "a": { "one": 1 } } }"#;
    let result: TestMsg = serde_json::from_str(string).unwrap();

    let expected = TestMsg::B(
        ChildMsg::A { one: 1 }
    );

    assert_eq!(result, expected);

    let string = r#"{ "a": { "one": 1 } }"#;
    let result: TestMsg = serde_json::from_str(string).unwrap();

    assert_eq!(result, expected);
}

#[test]
fn test_named() {
    let expected = TestMsg::A { one: 1, two: 2 };

    let string = r#"{ "a": { "one": 1, "two": 2 } }"#;
    let result: TestMsg = serde_json::from_str(string).unwrap();

    assert_eq!(result, expected);
}
