use syn::{ItemFn, Ident, Type, PathArguments};
use quote::quote;
use proc_macro2::Span;

use crate::{
    err::{ErrorSink, CompileErrors},
    attr::MsgAttr,
    generate,
    validate
};

pub fn derive(mut item: ItemFn) -> Result<proc_macro2::TokenStream, CompileErrors> {
    let mut sink = ErrorSink::default();
    let reply_ty = Ident::new("Reply", Span::call_site());

    if !validate::has_single_arg(&mut sink, &item.sig, |ty| {
        if let Type::Path(path) = ty {
            if let Some(segment) = path.path.segments.last() {
                if matches!(segment.arguments, PathArguments::None) &&
                    segment.ident == reply_ty &&
                    path.qself.is_none()
                {
                    return true;
                }
            }
        }

        false
    }) {
        sink.push_spanned(
            &item.sig,
            format!(
                "Expecting exactly one parameter with the type: cosmwasm_std::{}",
                reply_ty
            ),
        );
    }

    generate::cw_arguments(&mut item.sig, MsgAttr::Reply, true);
    sink.check()?;

    Ok(quote!(#item))
}
