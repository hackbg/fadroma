use crate::{
    scrt::*,
    scrt_storage::{
        load as storage_load,
        remove as storage_remove,
        save as storage_save,
    }
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
/// use fadroma::{scrt::*, scrt_storage_traits::*};
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
/// fn init(mut deps: DepsMut) -> StdResult<()> {
///     let config = Config { some_value: "foo".to_string() };
/// 
///     config.save(deps.branch())?;
/// 
///     let maybe_config: Option<Config> = Config::load(deps.as_ref(), b"some_key")?;
/// 
///     Ok(())
/// }
/// ```
pub trait Storable: Serialize + DeserializeOwned {
    /// Storage key used for saving Self
    fn key(&self) -> StdResult<Vec<u8>>;

    /// Save Self in the storage
    fn save(&self, deps: DepsMut) -> StdResult<()> {
        let key = self.key()?;
        let key = key.as_slice();

        Self::static_save(deps, key, self)
    }

    /// Remove Self from storage
    fn remove(self, deps: DepsMut) -> StdResult<()> {
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
    fn load(deps: Deps, key: &[u8]) -> StdResult<Option<Self>> {
        let key = Self::concat_key(key);

        storage_load::<Self>(deps.storage, key.as_slice())
    }

    /// Static: Save Self in the storage
    fn static_save(
        deps: DepsMut,
        key: &[u8],
        item: &Self,
    ) -> StdResult<()> {
        let key = Self::concat_key(key);
        storage_save::<Self>(deps.storage, &key.as_slice(), item)
    }

    /// Static: Remove Self from storage
    fn static_remove(deps: DepsMut, key: &[u8]
    ) -> StdResult<()> {
        let key = Self::concat_key(key);
        storage_remove(deps.storage, &key.as_slice());

        Ok(())
    }
}
