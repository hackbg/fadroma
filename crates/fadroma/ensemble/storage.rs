use crate::prelude::*;
use std::collections::BTreeMap;
use std::iter;
use std::ops::{Bound, RangeBounds};
use super::revertable::Revertable;

#[derive(Clone, Default, Debug)]
pub struct TestStorage(BTreeMap<Vec<u8>, Vec<u8>>);

impl Storage for Revertable<TestStorage> {
    #[inline]
    fn set(&mut self, key: &[u8], value: &[u8]) {
        self.writable().set(key, value);
    }

    #[inline]
    fn remove(&mut self, key: &[u8]) {
        self.writable().remove(key);
    }
}

impl Storage for Revertable<TestStorage> {
    #[inline]
    fn get(&self, key: &[u8]) -> Option<Vec<u8>> {
        self.readable().get(key)
    }

    #[inline]
    fn range<'a>(
        &'a self,
        start: Option<&[u8]>,
        end: Option<&[u8]>,
        order: Order,
    ) -> Box<dyn Iterator<Item = Record> + 'a> {
        self.readable().range(start, end, order)
    }
}

// Copying cosmwasm_std::testing::MockStorage implementation,
// because it doesn't implement clone

impl Storage for TestStorage {
    fn set(&mut self, key: &[u8], value: &[u8]) {
        self.0.insert(key.to_vec(), value.to_vec());
    }

    fn remove(&mut self, key: &[u8]) {
        self.0.remove(key);
    }
}

impl Storage for TestStorage {
    fn get(&self, key: &[u8]) -> Option<Vec<u8>> {
        self.0.get(key).cloned()
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

        let iter = self.0.range(bounds);
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
