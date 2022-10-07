use std::marker::PhantomData;

use crate::prelude::testing::{MockApi, MockQuerier};
use super::*;

#[inline]
pub fn mock_deps() -> OwnedDeps<ClonableMemoryStorage, MockApi, MockQuerier> {
    mock_deps_with_querier(MockQuerier::default())
}

#[inline]
pub fn mock_deps_with_querier<Q: Querier>(
    querier: Q
) -> OwnedDeps<ClonableMemoryStorage, MockApi, Q> {
    OwnedDeps {
        storage: ClonableMemoryStorage::default(),
        api: MockApi::default(),
        querier,
        custom_query_type: PhantomData
    }
}

#[derive(Default, Clone)]
pub struct ClonableMemoryStorage {
    data: std::collections::BTreeMap<Vec<u8>, Vec<u8>>,
}

impl ClonableMemoryStorage {
    pub fn new() -> Self {
        Self::default()
    }
}

impl Storage for ClonableMemoryStorage {
    fn get(&self, key: &[u8]) -> Option<Vec<u8>> {
        self.data.get(key).cloned()
    }

    fn set(&mut self, key: &[u8], value: &[u8]) {
        self.data.insert(key.to_vec(), value.to_vec());
    }

    fn remove(&mut self, key: &[u8]) {
        self.data.remove(key);
    }

    fn range<'a>(
        &'a self,
        _start: Option<&[u8]>,
        _end: Option<&[u8]>,
        _order: Order,
    ) -> Box<dyn Iterator<Item = Record> + 'a> {
        unimplemented!()
    }
}
