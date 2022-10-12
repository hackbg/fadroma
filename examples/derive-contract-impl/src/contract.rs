use fadroma::{prelude::*, derive_contract::*};

mod state;
use state::State;

#[contract(entry)]
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

    #[handle]
    fn add(value: u64) -> StdResult<Response> {
        let mut state = State::load_state(deps.storage)?;

        state.value += value;
        State::save_state(deps.storage, &state)?;

        Ok(Response::default())
    }

    #[handle]
    fn sub(value: u64) -> StdResult<Response> {
        let mut state = State::load_state(deps.storage)?;

        state.value -= value;
        State::save_state(deps.storage, &state)?;

        Ok(Response::default())
    }

    #[handle]
    fn mul(value: u64) -> StdResult<Response> {
        let mut state = State::load_state(deps.storage)?;

        state.value *= value;
        State::save_state(deps.storage, &state)?;

        Ok(Response::default())
    }

    #[handle]
    fn div(value: u64) -> StdResult<Response> {
        let mut state = State::load_state(deps.storage)?;

        state.value /= value;
        State::save_state(deps.storage, &state)?;

        Ok(Response::default())
    }

    #[query]
    fn state() -> StdResult<State> {
        State::load_state(deps.storage)
    }
}
