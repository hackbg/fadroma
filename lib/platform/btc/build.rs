extern crate cc;
fn main () {
    let mut build = cc::Build::new();
    println!("cargo:rerun-if-changed=../../../stub/wasm_secp256k1.c");
    println!("cargo:rerun-if-changed=../../../deps/secp256k1/secp256k1-sys/depend");
    build
        .std("c11")
        .include("../../../deps/secp256k1/secp256k1-sys/depend/secp256k1/")
        .include("../../../deps/secp256k1/secp256k1-sys/depend/secp256k1/include")
        .include("../../../deps/secp256k1/secp256k1-sys/depend/secp256k1/src")
        .file("../../../stub/wasm_secp256k1.c");
    build.compile("fadroma-stub-btc-wasm");
}
