// Calculates the raw key prefix for a given namespace
// as documented in https://github.com/webmaster128/key-namespacing#length-prefixed-keys
pub fn key_prefix(namespace: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(namespace.len() + 2);
    extend_with_prefix(&mut out, namespace);
    out
}

// Calculates the raw key prefix for a given nested namespace
// as documented in https://github.com/webmaster128/key-namespacing#nesting
pub fn key_prefix_nested(namespaces: &[&[u8]]) -> Vec<u8> {
    let mut size = namespaces.len();
    for &namespace in namespaces {
        size += namespace.len() + 2;
    }

    let mut out = Vec::with_capacity(size);
    for &namespace in namespaces {
        extend_with_prefix(&mut out, namespace);
    }
    out
}

// extend_with_prefix is only for internal use to unify key_prefix and key_prefix_nested efficiently
// as documented in https://github.com/webmaster128/key-namespacing#nesting
fn extend_with_prefix(out: &mut Vec<u8>, namespace: &[u8]) {
    out.extend_from_slice(&key_len(namespace));
    out.extend_from_slice(namespace);
}

// returns the length as a 2 byte big endian encoded integer
fn key_len(prefix: &[u8]) -> [u8; 2] {
    if prefix.len() > 0xFFFF {
        panic!("only supports namespaces up to length 0xFFFF")
    }
    let length_bytes = (prefix.len() as u64).to_be_bytes();
    [length_bytes[6], length_bytes[7]]
}
