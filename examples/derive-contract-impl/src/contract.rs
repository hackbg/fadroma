use fadroma::{prelude::*, derive_contract::*};

mod state;
use state::State;

#[contract(entry)]
pub trait Contract {
    #[init]
    fn new(initial_value: u64) -> StdResult<InitResponse> {
        State::save_state(
            &mut deps.storage,
            &State {
                value: initial_value,
            },
        )?;
        Ok(InitResponse::default())
    }

    #[handle]
    fn add(value: u64) -> StdResult<HandleResponse> {
        let mut state = State::load_state(&deps.storage)?;

        state.value += value;
        State::save_state(&mut deps.storage, &state)?;

        Ok(HandleResponse::default())
    }

    #[handle]
    fn sub(value: u64) -> StdResult<HandleResponse> {
        let mut state = State::load_state(&deps.storage)?;

        state.value -= value;
        State::save_state(&mut deps.storage, &state)?;

        Ok(HandleResponse::default())
    }

    #[handle]
    fn mul(value: u64) -> StdResult<HandleResponse> {
        let mut state = State::load_state(&deps.storage)?;

        state.value *= value;
        State::save_state(&mut deps.storage, &state)?;

        Ok(HandleResponse::default())
    }

    #[handle]
    fn div(value: u64) -> StdResult<HandleResponse> {
        let mut state = State::load_state(&deps.storage)?;

        state.value /= value;
        State::save_state(&mut deps.storage, &state)?;

        Ok(HandleResponse::default())
    }

    #[query]
    fn state() -> StdResult<State> {
        State::load_state(&deps.storage)
    }
}
