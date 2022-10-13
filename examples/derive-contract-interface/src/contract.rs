use fadroma::{prelude::*, derive_contract::*};

mod state;
use state::State;

pub mod interface;
use interface::StateResponse;

#[contract_impl(entry, path = "interface")]
pub trait Contract {
    #[init]
    fn new(initial_value: u64) -> StdResult<Response> {
        State::save_state(
            deps.storage,
            &State {
                value: initial_value,
            },
        )?;

        Ok(Response::default())
    }

    #[execute]
    fn add(value: u64) -> StdResult<Response> {
        let mut state = State::load_state(deps.storage)?;

        state.value += value;
        State::save_state(deps.storage, &state)?;

        Ok(Response::default())
    }

    #[execute]
    fn sub(value: u64) -> StdResult<Response> {
        let mut state = State::load_state(deps.storage)?;

        state.value -= value;
        State::save_state(deps.storage, &state)?;

        Ok(Response::default())
    }

    #[execute]
    fn mul(value: u64) -> StdResult<Response> {
        let mut state = State::load_state(deps.storage)?;

        state.value *= value;
        State::save_state(deps.storage, &state)?;

        Ok(Response::default())
    }

    #[execute]
    fn div(value: u64) -> StdResult<Response> {
        let mut state = State::load_state(deps.storage)?;

        state.value /= value;
        State::save_state(deps.storage, &state)?;

        Ok(Response::default())
    }

    #[query]
    fn state() -> StdResult<StateResponse> {
        let state = State::load_state(deps.storage)?;

        Ok(StateResponse { value: state.value })
    }
}
