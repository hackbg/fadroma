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
    validate::{self, ResultType},
    generate::{self, MsgType, ErrorEnum},
    method::{Method, ContractMethod, InterfaceMethod}
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

    let contract = Contract::parse(&mut sink, item_mod.ident.span(), items);
    let g = contract.generate(&mut sink);

    items.push(Item::Struct(g.boilerplate.contract_struct));
    items.push(Item::Enum(g.boilerplate.error_enum.enum_def));
    items.push(Item::Impl(g.boilerplate.error_enum.display_impl));

    if let Some(i) = g.interfaces {
        items.push(Item::Struct(i.init_msg));
        items.push(Item::Enum(i.execute_msg));
        items.push(Item::Enum(i.query_msg));
    
        items.push(Item::Fn(i.entry.init));
        items.push(Item::Fn(i.entry.execute));
        items.push(Item::Fn(i.entry.query));
    }

    sink.check()?;

    Ok(quote!(#item_mod))
}

struct Contract<'a> {
    contract_impl: Option<&'a ItemImpl>,
    interfaces: Vec<&'a ItemImpl>
}

struct Generated {
    interfaces: Option<Interfaces>,
    boilerplate: Boilerplate
}

struct Interfaces {
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

struct Boilerplate {
    contract_struct: ItemStruct,
    error_enum: ErrorEnum
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

    fn generate(self, sink: &mut ErrorSink) -> Generated {
        let mut init = None;
        let mut contract_err_ty = None;
        let mut execute = vec![];
        let mut query = vec![];

        if let Some(contract_impl) = self.contract_impl {
            for item in &contract_impl.items {
                let ImplItem::Method(method) = item else {
                    continue;
                };

                if let Some(attr) = MsgAttr::parse(sink, &method.attrs) {
                    let return_ty = match attr {
                        MsgAttr::Init { .. } if init.is_some() => {
                            sink.push_spanned(
                                &contract_impl.self_ty,
                                format!("Only one method can be annotated as #[{}].", MsgAttr::INIT)
                            );

                            None
                        }
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

                            validate_contract_method(sink, &method, Some(parse_quote!(Response)))
                        }
                        MsgAttr::Execute => {
                            execute.push(Method::Contract(ContractMethod {
                                sig: &method.sig
                            }));

                            validate_contract_method(sink, &method, Some(parse_quote!(Response)))
                        }
                        MsgAttr::Query => {
                            query.push(Method::Contract(ContractMethod {
                                sig: &method.sig
                            }));

                            validate_contract_method(sink, &method, None)
                        }
                    };

                    if let Some(return_ty) = return_ty {
                        match contract_err_ty {
                            Some(err_ty) => {
                                if err_ty != return_ty.error {
                                    sink.push_spanned(
                                        &method.sig.output,
                                        format!(
                                            "All methods in the \"impl {}\" block must have the same error type.",
                                            CONTRACT
                                        )
                                    );
                                }
                            },
                            None => contract_err_ty = Some(return_ty.error)
                        }
                    }
                }
            }
        }

        for interface in &self.interfaces {
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
                            execute.push(Method::Interface(InterfaceMethod {
                                sig: &method.sig,
                                trait_: &interface.trait_.as_ref().unwrap().1
                            }));
                        }
                        MsgAttr::Query => {
                            validate_interface_method(sink, &method, None);
                            query.push(Method::Interface(InterfaceMethod {
                                sig: &method.sig,
                                trait_: &interface.trait_.as_ref().unwrap().1
                            }));
                        }
                    }
                }
            }
        }

        let interfaces = if let Some(init) = init {
            let entry = Entrypoints {
                init: generate::init_fn(
                    sink,
                    &init.sig
                ),
                execute: generate::execute_fn(
                    sink,
                    &execute
                ),
                query: generate::query_fn(
                    sink,
                    &query
                )
            };
    
            Some(Interfaces {
                init_msg: generate::init_msg(sink, &init.sig),
                execute_msg: generate::messages(
                    sink,
                    MsgType::Execute,
                    execute.iter().map(|x| x.sig())
                ),
                query_msg: generate::messages(
                    sink,
                    MsgType::Query,
                    query.iter().map(|x| x.sig())
                ),
                entry
            })
        } else {
            None
        };

        let boilerplate = Boilerplate {
            contract_struct: create_contract_struct(),
            error_enum: generate::error_enum(sink, contract_err_ty, &self.interfaces)
        };

        Generated {
            interfaces,
            boilerplate
        }
    }
}

fn create_contract_struct() -> ItemStruct {
    let ident = Ident::new(CONTRACT, Span::call_site());

    parse_quote! {
        #[derive(Clone, Copy, Debug)]
        pub struct #ident;
    }
}

#[inline]
fn validate_contract_method<'a>(
    sink: &mut ErrorSink,
    method: &'a ImplItemMethod,
    arg: Option<GenericArgument>
) -> Option<ResultType<'a>> {
    if method.vis != parse_quote!(pub) {
        sink.push_spanned(method, "Method must be public.");
    }

    validate::result_type(sink, &method.sig, (arg, None))
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
