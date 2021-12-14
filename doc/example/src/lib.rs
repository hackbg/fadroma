#![allow(clippy::needless_question_mark)] // There are some needles question marks in the contract! macro
use fadroma::scrt::contract::*;
use fadroma::scrt::cosmwasm_std::Empty;

contract!(

    [State] {
        creator: CanonicalAddr,
        votes: Vec<(String, u32)>,
        voted: Vec<CanonicalAddr>
    }

    [Init] (deps, env, msg: {
        options: Vec<String>
    }) {
        let mut votes: Vec<(String, u32)> = vec![];

        for option in options {
            votes.push((option, 0));
        }

        let state = State {
            creator: deps.api.canonical_address(&env.message.sender)?,
            votes,
            voted: Vec::new(),
        };

        save_state!(state);

        InitResponse::<Empty>::default()
    }

    [Query] (_deps, state, msg) -> Response {
        Status () {
            Ok(Response::Results { votes: state.votes })
        }
    }

    [Response] {
        Results { votes: Vec<(String, u32)> }
    }

    [TX] (deps, env, state, msg) -> TXResponse {
        Vote (option: String) {
            let voter = deps.api.canonical_address(&env.message.sender)?;
            if let Some(_index) = state.voted.iter().position(|a| a == &voter) {
                return Err(StdError::GenericErr { msg: "Already voted".to_string(), backtrace: None });
            }

            if let Some(index) = state.votes.iter().position(|a| a.0 == option) {
                // We'll unwrap here since the index we got must exist
                let res = state.votes.get_mut(index).unwrap();
                res.1 += 1;
            } else {
                return Err(StdError::GenericErr { msg: "Option not found".to_string(), backtrace: None });
            }

            state.voted.push(voter);

            save_state!();

            Ok(HandleResponse::default())
        }
    }
);

#[cfg(test)]
mod test {
    use super::*;
    use fadroma::scrt::cosmwasm_std::{Extern};
    use fadroma::scrt::cosmwasm_std::from_binary;
    use fadroma::scrt::cosmwasm_std::testing::{mock_dependencies, mock_env, MockApi, MockQuerier, MockStorage};

    /// Query for right amount of votes
    fn assert_query_ok(
        deps: &mut Extern<MockStorage, MockApi, MockQuerier>,
        option1: u32,
        option2: u32,
    ) {
        let compare_votes: Vec<(String, u32)> = vec![
            ("option1".to_string(), option1),
            ("option2".to_string(), option2),
        ];

        let query_response = query(deps, msg::Query::Status {}).expect("Querying went wrong");
        let res = from_binary::<msg::Response>(&query_response)
            .expect("Converting query response from binary went wrong");
        match res {
            msg::Response::Results { votes } => {
                assert_eq!(votes, compare_votes);
            }
        };
    }

    #[test]
    fn init_vote_and_query() {
        let mut deps = mock_dependencies(1000, &[]);

        let mut env = mock_env("creator", &[]);
        env.block.height = 876;

        let res = init(
            &mut deps,
            env,
            Init {
                options: vec![String::from("option1"), String::from("option2")],
            },
        );

        // assert init didn't run into any trouble
        assert!(res.is_ok());

        // assert we can query the state and no votes are present and empty
        assert_query_ok(&mut deps, 0, 0);

        let mut env = mock_env("voter", &[]);
        env.block.height = 876;
        let handle_res = handle(
            &mut deps,
            env,
            msg::TX::Vote {
                option: "option1".to_string(),
            },
        );

        // assert voting went ok
        assert!(handle_res.is_ok());

        // assert vote has been recorded properly
        assert_query_ok(&mut deps, 1, 0);

        let mut env = mock_env("voter", &[]);
        env.block.height = 876;
        let handle_res = handle(
            &mut deps,
            env,
            msg::TX::Vote {
                option: "option1".to_string(),
            },
        );

        // assert we get error, since the vote cannot be cast twice by the same voter
        assert_eq!(
            handle_res,
            Err(StdError::GenericErr {
                msg: "Already voted".to_string(),
                backtrace: None
            })
        );

        let mut env = mock_env("voter1", &[]);
        env.block.height = 876;
        let handle_res = handle(
            &mut deps,
            env,
            msg::TX::Vote {
                option: "option3".to_string(),
            },
        );

        // assert we get error, since we tried voting for option that doesn't exist
        assert_eq!(
            handle_res,
            Err(StdError::GenericErr {
                msg: "Option not found".to_string(),
                backtrace: None
            })
        );

        let mut env = mock_env("voter1", &[]);
        env.block.height = 876;
        let handle_res = handle(
            &mut deps,
            env,
            msg::TX::Vote {
                option: "option2".to_string(),
            },
        );

        // assert voting went okay, and the proper votes are recorded
        assert!(handle_res.is_ok());
        assert_query_ok(&mut deps, 1, 1);
    }
}
