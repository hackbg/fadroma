use std::ops::Range;
use oorandom::Rand64;

#[derive(Clone, Debug)]
pub struct Block {
    pub height: u64,
    pub time: u64,
    incr: BlockIncrement,
    is_frozen: bool
}

#[derive(Clone, Debug)]
enum BlockIncrement {
    Random {
        height: Range<u64>,
        time: Range<u64>
    },
    Exact {
        /// Block height increment
        height: u64,
        /// Seconds per block increment
        time: u64
    }
}

impl Block {
    /// Will increase the block height by `height` and
    /// block time by `height` * `time` for each increment.
    /// 
    /// `time` is in seconds.
    /// 
    /// This is the default strategy.
    pub fn exact_increments(&mut self, height: u64, time: u64) {
        assert!(height > 0 && time > 0, "Height and time must be bigger than 0. Call \"freeze\" if you want to stop incrementing blocks.");

        self.incr = BlockIncrement::Exact { height, time };
    }

    /// Will increase the block height by a number within the range of `height` and
    /// block time by that same `height` * `time` for each increment.
    /// 
    /// `time` is in seconds.
    pub fn random_increments(&mut self, height: Range<u64>, time: Range<u64>) {
        assert!(height.start > 0 && time.start > 0, "Height and time range start must be bigger than 0.");

        self.incr = BlockIncrement::Random { height, time };
    }

    /// Will stop incrementing blocks on each message execution
    /// and calling `next` and `increment` will have no effect.
    pub fn freeze(&mut self) {
        self.is_frozen = true;
    }

    /// Will resume incrementing blocks on each message execution.
    pub fn unfreeze(&mut self) {
        self.is_frozen = false;
    }

    /// Increments the block height and time by the amount configured - once.
    ///  
    /// # Examples
    /// 
    /// ```
    /// use fadroma_ensemble::Block;
    /// 
    /// let mut block = Block::default();
    /// block.exact_increments(1, 5);
    /// 
    /// let old_height = block.height;
    /// let old_time = block.time;
    /// 
    /// block.next();
    /// 
    /// assert_eq!(block.height - old_height, 1);
    /// assert_eq!(block.time - old_time, 5);
    /// 
    /// ```
    #[inline]
    pub fn next(&mut self) {
        self.increment(1)
    }

    ///Increments the block height and time by the amount configured, multiplied by the `times` parameter.
    /// 
    /// # Examples
    /// 
    /// ```
    /// use fadroma_ensemble::Block;
    /// 
    /// let mut block = Block::default();
    /// block.exact_increments(1, 5);
    /// 
    /// let old_height = block.height;
    /// let old_time = block.time;
    /// 
    /// block.increment(3);
    /// 
    /// assert_eq!(block.height - old_height, 3);
    /// assert_eq!(block.time - old_time, 15);
    /// 
    /// ```
    pub fn increment(&mut self, times: u64) {
        if self.is_frozen {
            return;
        }

        match self.incr.clone() {
            BlockIncrement::Exact { height, time } => {
                let height = height * times;

                self.height += height;
                self.time += height * time;
            },
            BlockIncrement::Random { height, time } => {
                // TODO: randomize this seed
                let mut rng = Rand64::new(347593485789348572u128);

                let rand_height = rng.rand_range(height);
                let rand_time = rng.rand_range(time);

                let height = rand_height * times;

                self.height += height;
                self.time += height * rand_time;
            }
        }
    }
}

impl Default for Block {
    fn default() -> Self {
        Self {
            height: 1,
            #[cfg(target_arch = "wasm32")]
            time: 1600000000,
            #[cfg(not(target_arch = "wasm32"))]
            time: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            incr: BlockIncrement::Exact {
                height: 1,
                time: 10
            },
            is_frozen: false
        }
    }
}
