use fadroma::{prelude::*, derive_contract::*};

fadroma::namespace!(pub StateNs, b"state");
pub const STATE: SingleItem<u64, StateNs> = SingleItem::new();

#[contract(entry)]
pub trait Contract {
    #[init]
    fn new(initial_value: u64) -> StdResult<Response> {
        STATE.save(deps.storage, &initial_value)?;

        Ok(Response::default())
    }

    #[execute]
    fn add(value: u64) -> StdResult<Response> {
        let mut state = STATE.load_or_default(deps.storage)?;
        state += value;

        STATE.save(deps.storage, &state)?;

        Ok(Response::default())
    }

    #[execute]
    fn sub(value: u64) -> StdResult<Response> {
        let mut state = STATE.load_or_default(deps.storage)?;
        state -= value;

        STATE.save(deps.storage, &state)?;

        Ok(Response::default())
    }

    #[execute]
    fn mul(value: u64) -> StdResult<Response> {
        let mut state = STATE.load_or_default(deps.storage)?;
        state *= value;

        STATE.save(deps.storage, &state)?;

        Ok(Response::default())
    }

    #[execute]
    fn div(value: u64) -> StdResult<Response> {
        let mut state = STATE.load_or_default(deps.storage)?;
        state /= value;

        STATE.save(deps.storage, &state)?;

        Ok(Response::default())
    }

    #[query]
    fn value() -> StdResult<u64> {
        STATE.load_or_default(deps.storage)
    }
}
