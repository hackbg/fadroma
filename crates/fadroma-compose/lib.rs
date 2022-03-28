use proc_macro::TokenStream;
use syn::parse_macro_input;

mod macros;
mod write;
mod model;
mod parse;

/// Attribute macro that defines the **composed contract** trait.
/// Invoke this to compose a contract, merging the `#[support]`-ed component traits.
#[proc_macro_attribute]
pub fn composed (
    _:     TokenStream,
    input: TokenStream
) -> TokenStream {
    parse_macro_input!(input as model::Contract).write().into()
}

/// Attribute macro that defines a **contract component** trait.
#[proc_macro_attribute]
pub fn component (
    _:     TokenStream,
    input: TokenStream
) -> TokenStream {
    parse_macro_input!(input as model::Component).write().into()
}
