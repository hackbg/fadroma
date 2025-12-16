extern crate cc;
fn main () {
    let mut build = cc::Build::new();
    build.file("src/wasm.c");
    build.compile("fadroma-stub-btc-wasm.a");
}
