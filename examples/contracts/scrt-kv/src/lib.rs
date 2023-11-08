use fadroma::{schemars, storage::{ItemSpace, TypedKey}};

/** Some data, e.g. a string. */
type Data = String;
fadroma::namespace!(DataNs, b"data");
const DATA: ItemSpace::<Data, DataNs, TypedKey<String>> = ItemSpace::new();

/** Some metadata, e.g. a timestamp. */
type Time = u64;
fadroma::namespace!(TimeNs, b"meta");
const TIME: ItemSpace::<Time, TimeNs, TypedKey<String>> = ItemSpace::new();

fadroma::contract! {
    #[init(entry_wasm)]
    pub fn new () -> Result<Response, StdError> {
        Ok(Response::default())
    }

    #[query]
    pub fn get (key: String) -> Result<(Option<Data>, Option<Time>), StdError> {
        Ok((DATA.load(deps.storage, &key)?, TIME.load(deps.storage, &key)?))
    }

    #[execute]
    pub fn set (key: String, value: String) -> Result<Response, StdError> {
        DATA.save(deps.storage, &key, &value)?;
        TIME.save(deps.storage, &key, &env.block.time.nanos())?;
        Ok(Response::default())
    }
    
    #[execute]
    pub fn del (key: String) -> Result<Response, StdError> {
        DATA.remove(deps.storage, &key);
        TIME.save(deps.storage, &key, &env.block.time.nanos())?;
        Ok(Response::default())
    }
}
