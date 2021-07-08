use fadroma_scrt_base::cosmwasm_std::{Api, Extern, Querier, StdResult, Storage};
use crate::{
    load as storage_load, remove as storage_remove, save as storage_save,
};
use serde::{de::DeserializeOwned, Serialize};

/// Trait that will add storage options to your struct,
/// at minimum, you will have to implement `key()` method that will let storage
/// know where to save or from where to load your data.
///
/// Optionally, you can define the namespace of your struct that
/// will namespace it when storing.
/// 
/// ```rust
/// use serde::{Deserialize, Serialize};
/// use fadroma_scrt_base::cosmwasm_std::{Api, Extern, Querier, ReadonlyStorage, StdResult, Storage, to_vec};
/// use fadroma_scrt_storage::Storable;
/// 
/// #[derive(Deserialize, Serialize)]
/// struct Config {
///     some_value: String,
/// }
/// 
/// impl Storable for Config {
///     fn key(&self) -> StdResult<Vec<u8>> {
///         Ok(to_vec(b"some_key")?)
///     }
/// }
/// 
/// fn init<S: Storage, A: Api, Q: Querier>(deps: &mut Extern<S, A, Q>) -> StdResult<()> {
///     let config = Config { some_value: "foo".to_string() };
/// 
///     config.save(deps)?;
/// 
///     let maybe_config: Option<Config> = Config::load(&deps, b"some_key")?;
/// 
///     Ok(())
/// }
/// ```
pub trait Storable: Serialize + DeserializeOwned {
    /// Storage key used for saving Self
    fn key(&self) -> StdResult<Vec<u8>>;

    /// Save Self in the storage
    fn save<S: Storage, A: Api, Q: Querier>(&self, deps: &mut Extern<S, A, Q>) -> StdResult<()> {
        let key = self.key()?;
        let key = key.as_slice();

        Self::static_save(deps, key, self)
    }

    /// Remove Self from storage
    fn remove<S: Storage, A: Api, Q: Querier>(self, deps: &mut Extern<S, A, Q>) -> StdResult<()> {
        let key = self.key()?;
        let key = key.as_slice();

        Self::static_remove(deps, key)
    }

    /// Static: namespace for self
    fn namespace() -> Vec<u8> {
        Vec::new()
    }

    /// Static: Concat of namespace and key
    fn concat_key(key: &[u8]) -> Vec<u8> {
        let mut ns = Self::namespace();
        ns.extend_from_slice(key);

        ns
    }

    /// Static: Load Self from the storage
    fn load<S: Storage, A: Api, Q: Querier>(
        deps: &Extern<S, A, Q>,
        key: &[u8],
    ) -> StdResult<Option<Self>> {
        let key = Self::concat_key(key);

        storage_load::<Self, S>(&deps.storage, key.as_slice())
    }

    /// Static: Save Self in the storage
    fn static_save<S: Storage, A: Api, Q: Querier>(
        deps: &mut Extern<S, A, Q>,
        key: &[u8],
        item: &Self,
    ) -> StdResult<()> {
        let key = Self::concat_key(key);
        storage_save::<Self, S>(&mut deps.storage, &key.as_slice(), item)
    }

    /// Static: Remove Self from storage
    fn static_remove<S: Storage, A: Api, Q: Querier>(
        deps: &mut Extern<S, A, Q>,
        key: &[u8],
    ) -> StdResult<()> {
        let key = Self::concat_key(key);
        storage_remove(&mut deps.storage, &key.as_slice());

        Ok(())
    }
}
