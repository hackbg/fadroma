use syn::{ItemFn, FnArg, Ident, Type, parse_quote};
use quote::quote;
use proc_macro2::Span;

use crate::{
    err::{ErrorSink, CompileErrors},
    attr::{self, MsgAttr},
    generate
};

pub fn derive(mut item: ItemFn) -> Result<proc_macro2::TokenStream, CompileErrors> {
    let msg_type = Ident::new(attr::EXECUTE_MSG, Span::call_site());
    let mut sink = ErrorSink::default();

    if item.sig.inputs.len() != 1 {
        sink.push_spanned(
            &item.sig,
            format!(
                "Expecting one parameter with the type: &{}",
                msg_type
            ),
        );
    } else {
        let arg = &item.sig.inputs[0];
        match arg {
                
            FnArg::Typed(pat_type) => {
                let mut err = true;

                if let Type::Reference(reference) = &*pat_type.ty {
                    if reference.mutability.is_none() &&
                        reference.lifetime.is_none() &&
                        reference.elem == parse_quote!(#msg_type) {
                        err = false;
                    }
                }
    
                if err {
                    sink.push_spanned(
                        arg,
                        format!("Expecting argument type &{}", msg_type)
                    );
                }
            }
            FnArg::Receiver(_) => {
                sink.push_spanned(
                    &arg,
                    "Method definition cannot contain \"self\".",
                );
            }
        }
    }

    generate::cw_arguments(&mut item.sig, MsgAttr::ExecuteGuard, true);

    sink.check()?;

    Ok(quote!(#item))
}
