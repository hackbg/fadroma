#[fadroma::dsl::contract]
pub mod factory {
    use fadroma::{
        dsl::*,
        core::*,
        prelude::*,
        storage::{iterable::IterableStorage, SingleItem, StaticKey},
        bin_serde::{FadromaSerialize, FadromaDeserialize},
        namespace
    };
    use serde::{Serialize, Deserialize};
    use fadroma_example_factory_shared::*;

    namespace!(CodeNs, b"code");
    const CODE: SingleItem<ContractCode, CodeNs> = SingleItem::new();

    const PRODUCTS: StaticKey = StaticKey(b"products");
    #[inline]
    fn products() -> IterableStorage<ContractLink<CanonicalAddr>, StaticKey> {
        IterableStorage::new(PRODUCTS)
    }

    #[derive(Serialize, Deserialize, FadromaSerialize, FadromaDeserialize, Canonize, Debug)]
    #[serde(rename_all = "snake_case")]
    pub struct Entry<A: Address> {
        pub link: ContractLink<A>
    }

    impl Contract {
        #[init(entry_wasm)]
        pub fn new(code: ContractCode) -> Result<Response, StdError> {
            CODE.save(deps.storage, &code)?;
            Ok(Response::default())
        }

        #[execute]
        pub fn create(name: String) -> Result<Response, StdError> {
            let code = CODE.load_or_error(deps.storage)?;
            let address = CanonicalAddr(Binary::default());
            let link = ContractLink { address, code_hash: code.code_hash.clone() };
            products().push(deps.storage, &link)?;
            let label = format!("contract {} from factory {}", &name, &env.contract.address);
            let funds = vec![];
            let msg = fadroma_example_factory_shared::InstantiateMsg {};
            let msg = code.instantiate(label, &msg, funds)?;
            let msg = SubMsg::reply_on_success(msg, 0);
            Ok(Response::default().add_submessage(msg))
        }

        #[reply]
        pub fn reply(reply: Reply) -> Result<Response, StdError> {
            if reply.id != 0 {
                return Err(StdError::generic_err("Unexpected reply id."));
            }
            let resp = reply.result.unwrap();
            let address: Addr = from_binary(resp.data.as_ref().unwrap())?;
            let products = products();
            let index = products.len(deps.storage)? - 1;
            products.update(deps.storage, index, |mut entry| {
                entry.address = address.canonize(deps.api)?;
                Ok(entry)
            })?;
            Ok(Response::default())
        }

        #[query]
        pub fn list(
            pagination: Pagination
        ) -> Result<PaginatedResponse<ContractLink<Addr>>, StdError> {
            let limit = pagination.limit.min(Pagination::LIMIT);
            let products = products();
            let iterator = products
                .iter(deps.storage)?
                .skip(pagination.start as usize)
                .take(limit as usize);
            let total = products.len(deps.storage)?;
            let entries = iterator.into_iter()
                .map(|x| x?.humanize(deps.api))
                .collect::<StdResult<Vec<ContractLink<Addr>>>>()?;
            Ok(PaginatedResponse { total, entries })
        }
    }
}
