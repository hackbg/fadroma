use std::collections::HashMap;

use super::{
    storage::TestStorage,
    bank::Bank
};

pub(crate) struct State {
    pub stores: HashMap<String, TestStorage>,
    pub bank: Bank,
    scopes: Vec<Scope>
}

#[derive(Clone, Debug)]
pub enum Op {
    StorageWrite {
        key: Vec<u8>,
        old: Option<Vec<u8>>
    }
}

struct Scope{
    address: String,
    ops: Vec<Op>
}

impl State {
    pub fn new() -> Self {
        Self {
            stores: HashMap::new(),
            bank: Bank::default(),
            scopes: vec![]
        }
    }

    pub fn push_ops(&mut self, ops: Vec<Op>) {
        assert!(self.scopes.len() > 0);
        
        let scope = self.scopes.last_mut().unwrap();
        scope.ops.extend(ops);
    }

    #[inline]
    pub fn commit(&mut self) {
        self.scopes.clear();
    }

    #[inline]
    pub fn revert(&mut self) {
        while self.scopes.len() > 0 {
            self.revert_scope();
        }
    }

    #[inline]
    pub fn push_scope(&mut self, address: String) {
        self.scopes.push(Scope::new(address));
    }

    pub fn revert_scope(&mut self) {
        assert!(self.scopes.len() > 0);

        let scope = self.scopes.pop().unwrap();

        for op in scope.ops {
            match op {
                Op::StorageWrite { key, old } => {
                    if let Some(storage) = self.stores.get_mut(&scope.address) {
                        if let Some(old) = old {
                            storage.storage.insert(key, old);
                        } else {
                            storage.storage.remove(&key);
                        }
                    }
                }
            }
        }
    }
}

impl Scope {
    fn new(address: String) -> Self {
        Scope {
            address,
            ops: vec![]
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::cosmwasm_std::Storage;
    use super::*;

    const CONTRACTS: &[&str] = &["A", "B", "C"];

    #[test]
    fn storage_revert_keeps_initial_value_and_removes_newly_set() {
        let mut state = setup_storage();

        state.push_scope(CONTRACTS[0].into());
        let store = state.stores.get_mut(CONTRACTS[0]).unwrap();
        store.remove(b"a");
        store.set(b"b", b"yyz");
        store.remove(b"c");

        let ops = store.ops();
        assert_eq!(ops.len(), 2);

        drop(store);

        state.push_ops(ops);
        state.revert();

        let store = state.stores.get_mut(CONTRACTS[0]).unwrap();
        assert_eq!(store.get(b"a"), Some(b"abc".to_vec()));
        assert_eq!(store.get(b"b"), None);
    }

    #[test]
    fn storage_commit_saves_changes_and_clears_all_scopes() {
        let mut state = setup_storage();

        state.push_scope(CONTRACTS[0].into());
        let store = state.stores.get_mut(CONTRACTS[0]).unwrap();
        store.remove(b"a");
        store.set(b"b", b"yyz");

        let ops = store.ops();
        drop(store);

        state.push_ops(ops);
        state.commit();

        assert_eq!(state.scopes.len(), 0);

        let store = state.stores.get_mut(CONTRACTS[0]).unwrap();
        assert_eq!(store.get(b"a"), None);
        assert_eq!(store.get(b"b"), Some(b"yyz".to_vec()));
    }

    #[test]
    fn storage_revert_scope_affects_only_topmost_scope() {
        let mut state = setup_storage();

        state.push_scope(CONTRACTS[0].into());
        let store = state.stores.get_mut(CONTRACTS[0]).unwrap();
        store.remove(b"a");
        store.set(b"b", b"yyz");

        let ops = store.ops();
        drop(store);

        state.push_ops(ops);

        state.push_scope(CONTRACTS[1].into());
        let store = state.stores.get_mut(CONTRACTS[1]).unwrap();
        store.set(b"a", b"yyz");

        let ops = store.ops();
        drop(store);

        state.push_ops(ops);
        state.revert_scope();

        let store = state.stores.get_mut(CONTRACTS[1]).unwrap();
        assert_eq!(store.get(b"a"), None);

        let store = state.stores.get_mut(CONTRACTS[0]).unwrap();
        assert_eq!(store.get(b"a"), None);
        assert_eq!(store.get(b"b"), Some(b"yyz".to_vec()));

        state.commit();

        assert_eq!(state.scopes.len(), 0);
    }

    fn setup_storage() -> State {
        let mut state = State::new();

        let mut storage = TestStorage::default();
        storage.storage.insert(b"a".to_vec(), b"abc".to_vec());

        state.stores.insert(CONTRACTS[0].into(), storage);
        state.stores.insert(CONTRACTS[1].into(), TestStorage::default());
        state.stores.insert(CONTRACTS[2].into(), TestStorage::default());

        state
    }
}
