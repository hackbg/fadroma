use fadroma::{cosmwasm_std, derive_contract::*, HandleResponse, InitResponse, StdResult};

mod state;
use state::State;

pub mod interface;
use interface::StateResponse;

#[contract_impl(entry, path = "interface")]
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
    fn state() -> StdResult<StateResponse> {
        let state = State::load_state(&deps.storage)?;

        Ok(StateResponse { value: state.value })
    }
}
