use fadroma::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, JsonSchema, Debug)]
pub struct State {
    pub value: u64,
}

impl State {
    const KEY_STATE: &'static [u8] = b"state";

    pub fn save_state(storage: &mut dyn Storage, state: &State) -> StdResult<()> {
        storage::save(storage, Self::KEY_STATE, &state)
    }

    pub fn load_state(storage: &dyn Storage) -> StdResult<State> {
        let result: State = storage::load(storage, Self::KEY_STATE)?.unwrap();

        Ok(result)
    }
}
