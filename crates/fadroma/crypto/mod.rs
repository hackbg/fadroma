//! SHA256 hashing and pseudo rng.
//! *Feature flag: `crypto`*

use rand_chacha::ChaChaRng;
use rand_core::{RngCore, SeedableRng};
use sha2::{Digest, Sha256};

/// Hash the given data using SHA256.
pub fn sha_256(data: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let hash = hasher.finalize();

    let mut result = [0u8; 32];
    result.copy_from_slice(hash.as_slice());
    
    result
}

/// A pseudorandom number generator.
#[derive(Debug, Clone)]
pub struct Prng(ChaChaRng);

impl Prng {
    pub fn new(seed: &[u8], entropy: &[u8]) -> Self {
        let mut hasher = Sha256::new();

        hasher.update(&seed);
        hasher.update(&entropy);
        let hash = hasher.finalize();

        let mut hash_bytes = [0u8; 32];
        hash_bytes.copy_from_slice(hash.as_slice());

        let rng: ChaChaRng = ChaChaRng::from_seed(hash_bytes);
        
        Self(rng)
    }

    #[inline]
    pub fn fill_bytes(&mut self, dest: &mut [u8]) {
        self.0.fill_bytes(dest);
    }

    #[inline]
    pub fn next_u32(&mut self) -> u32 {
        self.0.next_u32()
    }

    #[inline]
    pub fn next_u64(&mut self) -> u64 {
        self.0.next_u64()
    }

    #[inline]
    pub fn rand_bytes(&mut self) -> [u8; 32] {
        let mut bytes = [0u8; 32];
        self.0.fill_bytes(&mut bytes);

        bytes
    }
}
