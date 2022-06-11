use fadroma::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, JsonSchema, Debug)]
pub struct State {
    pub value: u64,
}
impl State {
    const KEY_STATE: &'static [u8] = b"state";

    pub fn save_state(storage: &mut impl Storage, state: &State) -> StdResult<()> {
        save(storage, Self::KEY_STATE, &state)
    }

    pub fn load_state(storage: &impl Storage) -> StdResult<State> {
        let result: State = load(storage, Self::KEY_STATE)?.unwrap();

        Ok(result)
    }
}
