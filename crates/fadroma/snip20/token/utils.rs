use crate::scrt::{cosmwasm_std::{StdResult, Response}, space_pad, BLOCK_SIZE};

pub fn pad_response(response: StdResult<Response>) -> StdResult<Response> {
    response.map(|mut response| {
        response.data = response.data.map(|mut data| {
            space_pad(&mut data.0, BLOCK_SIZE);
            data
        });
        response
    })
}
