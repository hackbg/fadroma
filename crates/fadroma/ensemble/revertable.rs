#[derive(Debug)]
pub struct Revertable<T: Clone> {
    pub(crate) current: T,
    pending: Option<T>,
}

impl<T: Clone> Revertable<T> {
    pub fn commit(&mut self) {
        if let Some(pending) = self.pending.take() {
            self.current = pending;
        }
    }

    pub fn revert(&mut self) {
        self.pending = None;
    }

    pub fn writable(&mut self) -> &mut T {
        if self.pending.is_none() {
            self.pending = Some(self.current.clone());
        }

        self.pending.as_mut().unwrap()
    }

    pub fn readable(&self) -> &T {
        match &self.pending {
            Some(pending) => pending,
            None => &self.current,
        }
    }
}

impl<T: Default + Clone> Default for Revertable<T> {
    fn default() -> Self {
        Self {
            current: Default::default(),
            pending: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::Revertable;

    #[test]
    fn test_revertable() {
        #[derive(Default, Clone)]
        struct Data {
            one: u8,
            two: u8,
        }

        let mut data: Revertable<Data> = Default::default();

        data.writable().one = 1;
        assert_eq!(data.current.one, 0);
        assert_eq!(data.current.two, 0);
        assert!(data.pending.is_some());
        assert_eq!(data.readable().one, 1);
        assert_eq!(data.readable().two, 0);

        data.writable().two = 2;
        assert_eq!(data.current.one, 0);
        assert_eq!(data.current.two, 0);
        assert!(data.pending.is_some());
        assert_eq!(data.readable().one, 1);
        assert_eq!(data.readable().two, 2);

        data.commit();
        assert!(data.pending.is_none());

        assert_eq!(data.current.one, 1);
        assert_eq!(data.current.two, 2);

        data.writable().two = 3;
        assert!(data.pending.is_some());

        data.revert();
        assert!(data.pending.is_none());

        assert_eq!(data.readable().one, 1);
        assert_eq!(data.readable().two, 2);
        assert_eq!(data.current.one, 1);
        assert_eq!(data.current.two, 2);
    }
}
