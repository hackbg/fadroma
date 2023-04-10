use syn::{
    AttributeArgs, NestedMeta, Meta, Path, Ident,
    ItemImpl, ImplItem, ImplItemType, Stmt, parse_quote
};
use proc_macro2::Span;

use crate::{
    attr::{MsgAttr, ERROR_TYPE},
    method::fn_args_to_idents,
    interface,
    err::{ErrorSink, CompileErrors}
};

pub struct AutoImpl(Path);

impl AutoImpl {
    pub fn parse(mut args: AttributeArgs) -> syn::Result<Self> {
        if args.len() != 1 {
            return Err(meta_list_args_error());
        }

        let NestedMeta::Meta(Meta::Path(path)) = args.pop().unwrap() else {
            return Err(meta_list_args_error());
        };

        Ok(Self(path))
    }

    pub fn replace(&self, item: &mut ItemImpl) -> Result<(), CompileErrors> {
        let Some((_, trait_, _)) = &item.trait_ else {
            return Err(vec![syn::Error::new_spanned(item, "Item must be a trait impl.")]);
        };

        let mut sink = ErrorSink::default();

        let impl_path = &self.0;

        for item in &mut item.items {
            let ImplItem::Method(method) = item else {
                continue;
            };

            if !method.block.stmts.is_empty() {
                continue;
            }

            match MsgAttr::parse(&mut sink, &method.attrs) {
                Some(attr) if !interface::is_valid_attr(attr) =>
                    sink.unsupported_interface_attr(
                        &method.sig.ident,
                        attr
                    ),
                Some(attr) =>{
                    let fn_name = &method.sig.ident;
                    let args = fn_args_to_idents(&mut sink, &method.sig.inputs);

                    let stmt = match attr {
                        MsgAttr::Init { .. } | MsgAttr::Execute => 
                            parse_quote!(<#impl_path as #trait_>::#fn_name(deps, env, info, #args)),
                        MsgAttr::Query =>
                            parse_quote!(<#impl_path as #trait_>::#fn_name(deps, env, #args)),
                        _ => unreachable!("{} should not be supported in interfaces.", attr.as_str())
                    };

                    method.block.stmts.push(Stmt::Expr(stmt));
                },
                None => sink.expected_interface_attrs(&method.sig.ident)
            }
        }

        let error_ident = Ident::new(ERROR_TYPE, Span::call_site());
        let type_def: ImplItemType = parse_quote!(type #error_ident = <#impl_path as #trait_>::#error_ident;);

        item.items.push(ImplItem::Type(type_def));

        sink.check()
    }
}

#[inline]
fn meta_list_args_error() -> syn::Error {
    syn::Error::new(
        Span::call_site(),
        "Expecting a single meta list argument with the path to the implementing struct."
    )
}
