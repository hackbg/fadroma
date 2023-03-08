use syn::{
    Item, ItemMod, ItemImpl, Type, TypePath, Ident,
    ItemStruct, ImplItem, ItemEnum, ItemFn, ImplItemMethod,
    GenericArgument, parse_quote
};
use quote::quote;
use proc_macro2::Span;

use crate::{
    attr::{MsgAttr, CONTRACT, ENTRY_META},
    err::{ErrorSink, CompileErrors},
    validate, generate::{self, MsgType}
};

pub fn derive(mut item_mod: ItemMod) -> Result<proc_macro2::TokenStream, CompileErrors> {
    let Some((_, items)) = &mut item_mod.content else {
        return Err(vec![
            syn::Error::new_spanned(
                &item_mod,
                "Contract mod definition must contain a block."
            )
        ]);
    };

    let mut sink = ErrorSink::default();

    let ident = Ident::new(CONTRACT, Span::call_site());
    let contract_struct: ItemStruct = parse_quote! {
        #[derive(Clone, Copy, Debug)]
        pub struct #ident;
    };

    items.push(Item::Struct(contract_struct));

    let contract = Contract::parse(&mut sink, item_mod.ident.span(), items);
    
    if let Some(g) = contract.generate(&mut sink) {
        items.push(Item::Struct(g.init_msg));
        items.push(Item::Enum(g.execute_msg));
        items.push(Item::Enum(g.query_msg));
    
        items.push(Item::Fn(g.entry.init));
        items.push(Item::Fn(g.entry.execute));
        items.push(Item::Fn(g.entry.query));
    }

    sink.check()?;

    Ok(quote!(#item_mod))
}

struct Contract<'a> {
    contract_impl: Option<&'a ItemImpl>,
    interfaces: Vec<&'a ItemImpl>
}

struct Generated {
    init_msg: ItemStruct,
    execute_msg: ItemEnum,
    query_msg: ItemEnum,
    entry: Entrypoints
}

struct Entrypoints {
    init: ItemFn,
    execute: ItemFn,
    query: ItemFn
}

impl<'a> Contract<'a> {
    fn parse(sink: &mut ErrorSink, mod_span: Span, items: &'a [Item]) -> Self {
        let mut contract_impl = None;
        let mut interfaces = vec![];

        for item in items {
            match item {
                Item::Impl(item) if is_interface_impl(item) => {
                    interfaces.push(item);
                }
                Item::Impl(item) if is_contract_impl(item) => {
                    if contract_impl.is_some() {
                        sink.push(
                            mod_span,
                            format!("Can only have a single \"impl {}\" item.", CONTRACT)
                        );
                    } else {
                        contract_impl = Some(item);
                    }
                }
                _ => { }
            }
        }

        Self {
            contract_impl,
            interfaces
        }
    }

    fn generate(self, sink: &mut ErrorSink) -> Option<Generated> {
        let mut init = None;
        let mut execute = vec![];
        let mut query = vec![];

        if let Some(contract_impl) = self.contract_impl {
            for item in &contract_impl.items {
                let ImplItem::Method(method) = item else {
                    continue;
                };

                if let Some(attr) = MsgAttr::parse(sink, &method.attrs) {
                    match attr {
                        MsgAttr::Init { .. } if init.is_some() => sink.push_spanned(
                            &contract_impl.self_ty,
                            format!("Only one method can be annotated as #[{}].", MsgAttr::INIT)
                        ),
                        MsgAttr::Init { entry } => {
                            if entry {
                                init = Some(method);
                            } else {
                                sink.push_spanned(
                                    &contract_impl.self_ty,
                                    format!(
                                        "Init methods in {} implementation must be marked as #[{}({})].",
                                        CONTRACT,
                                        MsgAttr::INIT,
                                        ENTRY_META
                                    )
                                )
                            }

                            validate_contract_method(sink, &method, Some(parse_quote!(Response)));
                        }
                        MsgAttr::Execute => {
                            validate_contract_method(sink, &method, Some(parse_quote!(Response)));
                            execute.push(method);
                        }
                        MsgAttr::Query => {
                            validate_contract_method(sink, &method, None);
                            query.push(method);
                        }
                    }
                }
            }
        }

        for interface in self.interfaces {
            let mut has_init = false;

            for item in &interface.items {
                let ImplItem::Method(method) = item else {
                    continue;
                };

                if let Some(attr) = MsgAttr::parse(sink, &method.attrs) {
                    match attr {
                        MsgAttr::Init { .. } if has_init => sink.push_spanned(
                            &item,
                            format!("Only one method can be annotated as #[{}].", MsgAttr::INIT)
                        ),
                        MsgAttr::Init { entry } if entry && init.is_some() => sink.push_spanned(
                            &item,
                            "Entry point already defined."
                        ),
                        MsgAttr::Init { entry } => {
                            if entry {
                                init = Some(method);
                                has_init = true;
                            }

                            validate_interface_method(sink, &method, Some(parse_quote!(Response)));
                        }
                        MsgAttr::Execute => {
                            validate_interface_method(sink, &method, Some(parse_quote!(Response)));
                            execute.push(method);
                        }
                        MsgAttr::Query => {
                            validate_interface_method(sink, &method, None);
                            query.push(method);
                        }
                    }
                }
            }
        }

        let Some(init) = init else {
            return None;
        };

        let entry = Entrypoints {
            init: generate::init_fn(
                sink,
                &init.sig
            ),
            execute: generate::execute_fn(
                sink,
                execute.iter().map(|x| &x.sig)
            ),
            query: generate::query_fn(
                sink,
                query.iter().map(|x| &x.sig)
            )
        };

        Some(Generated {
            init_msg: generate::init_msg(sink, &init.sig),
            execute_msg: generate::messages(
                sink,
                MsgType::Execute,
                execute.iter().map(|x| &x.sig)
            ),
            query_msg: generate::messages(
                sink,
                MsgType::Query,
                query.iter().map(|x| &x.sig)
            ),
            entry
        })
    }
}

#[inline]
fn validate_contract_method(
    sink: &mut ErrorSink,
    method: &ImplItemMethod,
    arg: Option<GenericArgument>
) {
    if method.vis != parse_quote!(pub) {
        sink.push_spanned(method, "Method must be public.");
    }

    validate::result_type(sink, &method.sig, (arg, None));
}

#[inline]
fn validate_interface_method(
    sink: &mut ErrorSink,
    method: &ImplItemMethod,
    arg: Option<GenericArgument>
) {
    let err_arg: GenericArgument = parse_quote!(Self::Error);
    validate::result_type(sink, &method.sig, (arg, Some(err_arg)));
}

#[inline]
fn is_contract_impl(item: &ItemImpl) -> bool {
    if let Type::Path(path) = &*item.self_ty {
        let ident = Ident::new(CONTRACT, Span::call_site());
        let expected: TypePath = parse_quote!(#ident);
    
        path.qself.is_none() && (path.path == expected.path)
    } else {
        false
    }
}

#[inline]
fn is_interface_impl(item: &ItemImpl) -> bool {
    is_contract_impl(item) && item.trait_.is_some()
}
