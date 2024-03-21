mod common;
mod r#enum;
mod generic;
mod non_generic;
mod generic_enum;

use syn::{parse_macro_input, Item};
use proc_macro2::Span;

#[proc_macro_derive(Canonize)]
pub fn derive_canonize(stream: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let item = parse_macro_input!(stream as Item);

    match item {
        Item::Struct(input) => {
            if input.generics.params.len() == 0 {
                non_generic::generate(input)
            } else {
                generic::generate(input)
            }
        }
        Item::Enum(input) => {
            if input.generics.params.len() == 0 {
                r#enum::generate(input)
            } else {
                generic_enum::generate(input)
            }
        }
        _ => {
            let error = syn::Error::new(Span::call_site(), "Expecting a struct or enum definition.");

            error.to_compile_error().into()
        }
    }
}
