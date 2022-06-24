mod non_generic;
mod generic;
mod common;

use syn::{ItemStruct, parse_macro_input};

#[proc_macro_derive(Canonize)]
pub fn derive_canonize(stream: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let strukt = parse_macro_input!(stream as ItemStruct);
    
    if strukt.generics.params.len() == 0 {
        non_generic::generate(strukt)
    } else {
        generic::generate(strukt)
    }
}
