use fadroma_platform_scrt::{
    cosmwasm_std::{
        StdResult, Storage, ReadonlyStorage, Api,
        Querier, Order, KV, to_vec, from_slice,
        testing::MockApi
    },
    Humanize, Canonize
};

use fadroma_storage::*;
use crate::*;
use crate::make_composable;

#[derive(Clone)]
/// Same as regular Extern but clonable.
pub struct MockExtern<S: Storage, A: Api, Q: Querier> {
    pub storage: S,
    pub api: A,
    pub querier: Q,
}
impl<Q: Querier> MockExtern<ClonableMemoryStorage, MockApi, Q> {
    pub fn new (querier: Q) -> Self {
        Self {
            storage: ClonableMemoryStorage::default(),
            api:     MockApi::new(40),
            querier
        }
    }
}

make_composable!(MockExtern<S, A, Q>);

#[derive(Default, Clone)]
pub struct ClonableMemoryStorage {
    data: std::collections::BTreeMap<Vec<u8>, Vec<u8>>,
}

impl ClonableMemoryStorage {
    pub fn new() -> Self {
        Self::default()
    }
}

impl ReadonlyStorage for ClonableMemoryStorage {
    fn get(&self, key: &[u8]) -> Option<Vec<u8>> {
        self.data.get(key).cloned()
    }
    fn range<'a>(
        &'a self,
        _start: Option<&[u8]>,
        _end: Option<&[u8]>,
        _order: Order,
    ) -> Box<dyn Iterator<Item = KV> + 'a> {
        unimplemented!()
    }
}

impl Storage for ClonableMemoryStorage {
    fn set(&mut self, key: &[u8], value: &[u8]) {
        self.data.insert(key.to_vec(), value.to_vec());
    }
    fn remove(&mut self, key: &[u8]) {
        self.data.remove(key);
    }
}

