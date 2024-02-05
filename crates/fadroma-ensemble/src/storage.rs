use std::{
    iter,
    mem,
    collections::BTreeMap,
    ops::{Bound, RangeBounds}
};

use fadroma::cosmwasm_std::{
    Storage, Record, Order
};

use super::state::Op;

#[derive(Clone, Debug)]
pub struct TestStorage {
    pub backing: BTreeMap<Vec<u8>, Vec<u8>>,
    pub ops: Vec<Op>,
    address: String
}

impl TestStorage {
    pub fn new(address: impl Into<String>) -> Self {
        Self {
            address: address.into(),
            backing: BTreeMap::default(),
            ops: vec![]
        }
    }

    #[inline]
    pub fn ops(&mut self) -> Vec<Op> {
        mem::take(&mut self.ops)
    }
}

impl Storage for TestStorage {
    fn set(&mut self, key: &[u8], value: &[u8]) {
        let address = self.address.clone();
        let old = self.get(key);
        let key = key.to_vec();

        self.backing.insert(key.clone(), value.to_vec());
        self.ops.push(Op::StorageWrite { address, key, old });
    }

    fn remove(&mut self, key: &[u8]) {
        if let Some(old) = self.backing.remove(key) {
            self.ops.push(Op::StorageWrite {
                address: self.address.clone(),
                key: key.to_vec(),
                old: Some(old)
            });
        }
    }

    fn get(&self, key: &[u8]) -> Option<Vec<u8>> {
        self.backing.get(key).cloned()
    }

    fn range<'a>(
        &'a self,
        start: Option<&[u8]>,
        end: Option<&[u8]>,
        order: Order,
    ) -> Box<dyn Iterator<Item = Record> + 'a> {
        let bounds = range_bounds(start, end);

        // BTreeMap.range panics if range is start > end.
        // However, this cases represent just empty range and we treat it as such.
        match (bounds.start_bound(), bounds.end_bound()) {
            (Bound::Included(start), Bound::Excluded(end)) if start > end => {
                return Box::new(iter::empty());
            }
            _ => {}
        }

        let iter = self.backing.range(bounds);
        match order {
            Order::Ascending => Box::new(iter.map(clone_item)),
            Order::Descending => Box::new(iter.rev().map(clone_item)),
        }
    }
}

fn range_bounds(start: Option<&[u8]>, end: Option<&[u8]>) -> impl RangeBounds<Vec<u8>> {
    (
        start.map_or(Bound::Unbounded, |x| Bound::Included(x.to_vec())),
        end.map_or(Bound::Unbounded, |x| Bound::Excluded(x.to_vec())),
    )
}

type BTreeMapPairRef<'a, T = Vec<u8>> = (&'a Vec<u8>, &'a T);

fn clone_item<T: Clone>(item_ref: BTreeMapPairRef<T>) -> Record<T> {
    let (key, value) = item_ref;
    (key.clone(), value.clone())
}
