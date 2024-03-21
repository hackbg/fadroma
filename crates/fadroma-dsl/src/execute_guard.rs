use syn::{ItemFn, Ident, Type, parse_quote};
use quote::quote;
use proc_macro2::Span;

use crate::{
    err::{ErrorSink, CompileErrors},
    attr::{self, MsgAttr},
    generate,
    validate
};

pub fn derive(mut item: ItemFn) -> Result<proc_macro2::TokenStream, CompileErrors> {
    let mut sink = ErrorSink::default();
    let msg_type = Ident::new(attr::EXECUTE_MSG, Span::call_site());

    if !validate::has_single_arg(&mut sink, &item.sig, |ty| {
        if let Type::Reference(reference) = ty {
            if reference.mutability.is_none() &&
                reference.lifetime.is_none() &&
                reference.elem == parse_quote!(#msg_type)
            {
                return true;
            }
        }

        false
    }) {
        sink.push_spanned(
            &item.sig,
            format!(
                "Expecting exactly one parameter with the type: &{}",
                msg_type
            )
        );
    }

    generate::cw_arguments(&mut item.sig, MsgAttr::ExecuteGuard, true);
    sink.check()?;

    Ok(quote!(#item))
}
