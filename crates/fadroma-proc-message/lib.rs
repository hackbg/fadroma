use quote::quote;
use proc_macro::TokenStream;

#[proc_macro_attribute]
pub fn message (
    _:    TokenStream, // takes no arguments
    body: TokenStream  // annotates a struct declaration
) -> TokenStream {
    let body: proc_macro2::TokenStream = body.into();
    TokenStream::from(quote! {
        #[derive(Clone,Debug,PartialEq,serde::Serialize,serde::Deserialize,schemars::JsonSchema)]
        #[serde(rename_all="snake_case",deny_unknown_fields)]
        #body
    })
}
