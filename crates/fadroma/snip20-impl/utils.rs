use fadroma_platform_scrt::{
    cosmwasm_std::{StdResult, HandleResponse},
    space_pad, BLOCK_SIZE
};

pub fn pad_response(response: StdResult<HandleResponse>) -> StdResult<HandleResponse> {
    response.map(|mut response| {
        response.data = response.data.map(|mut data| {
            space_pad(&mut data.0, BLOCK_SIZE);
            data
        });
        response
    })
}
