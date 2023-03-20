use syn::{
    Item, ItemMod, ItemImpl, Type, TypePath,
    Ident, ItemStruct, ItemEnum, ItemFn,
    GenericArgument, parse_quote
};
use quote::quote;
use proc_macro2::Span;

use crate::{
    attr::{MsgAttr, CONTRACT, ENTRY_META},
    err::{ErrorSink, CompileErrors},
    generate::{self, MsgType, ErrorEnum},
    method::{Method, item_impl_methods}
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
    items.push(Item::Impl(g.boilerplate.error_enum.err_impl));

    if let Some(i) = g.interfaces {
        items.push(Item::Struct(i.init_msg));
        items.push(Item::Enum(i.execute_msg));
        items.push(Item::Enum(i.query_msg));
    
        items.push(Item::Fn(i.entry.init));
        items.push(Item::Fn(i.entry.execute));
        items.push(Item::Fn(i.entry.query));
        items.push(Item::Mod(i.entry.wasm_ffi));
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
    query: ItemFn,
    wasm_ffi: ItemMod
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
        let mut init: Option<Method> = None;
        let mut contract_err_ty: Option<GenericArgument> = None;
        let mut execute_guard: Option<Method> = None;
        let mut execute: Vec<Method> = vec![];
        let mut query: Vec<Method> = vec![];

        if let Some(contract_impl) = self.contract_impl {
            for method in item_impl_methods(sink, &contract_impl) {
                match &contract_err_ty {
                    Some(err_ty) => {
                        if err_ty != method.return_ty().error {
                            sink.push_spanned(
                                &method.sig().output,
                                format!(
                                    "All methods in the \"impl {}\" block must have the same error type.",
                                    CONTRACT
                                )
                            );
                        }
                    },
                    None => contract_err_ty = Some(method.return_ty().error.clone())
                }

                match method.ty() {
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
                    }
                    MsgAttr::Execute => execute.push(method),
                    MsgAttr::Query => query.push(method),
                    MsgAttr::ExecuteGuard => {
                        if execute_guard.is_some() {
                            sink.push_spanned(
                                &contract_impl.self_ty,
                                format!("Only one method can be annotated as #[{}].", MsgAttr::EXECUTE_GUARD)
                            );
                        } else {
                            execute_guard = Some(method);
                        }
                    }
                };
            }
        }

        for interface in &self.interfaces {
            let mut has_init = false;

            for method in item_impl_methods(sink, interface) {
                match method.ty() {
                    MsgAttr::Init { .. } if has_init => sink.push_spanned(
                        interface,
                        format!("Only one method can be annotated as #[{}].", MsgAttr::INIT)
                    ),
                    MsgAttr::Init { entry } if entry && init.is_some() => sink.push_spanned(
                        method.sig(),
                        "Entry point already defined."
                    ),
                    MsgAttr::Init { entry } => {
                        if entry {
                            init = Some(method);
                            has_init = true;
                        }
                    }
                    MsgAttr::Execute => execute.push(method),
                    MsgAttr::Query => query.push(method),
                    MsgAttr::ExecuteGuard => sink.push_spanned(
                        &method.sig().ident,
                        format!(
                            "Interfaces cannot have the #[{}] attribute.",
                            MsgAttr::EXECUTE_GUARD
                        )
                    )
                }
            }
        }

        let interfaces = if let Some(init) = init {
            let entry = Entrypoints {
                init: generate::init_fn(
                    sink,
                    &init
                ),
                execute: generate::execute_fn(
                    sink,
                    &execute,
                    execute_guard
                ),
                query: generate::query_fn(
                    sink,
                    &query
                ),
                wasm_ffi: generate::wasm_entry()
            };
    
            Some(Interfaces {
                init_msg: generate::init_msg(sink, &init),
                execute_msg: generate::messages(
                    sink,
                    MsgType::Execute,
                    &execute
                ),
                query_msg: generate::messages(
                    sink,
                    MsgType::Query,
                    &query
                ),
                entry
            })
        } else {
            if let Some(guard) = execute_guard {
                sink.push_spanned(
                    guard.sig(),
                    format!(
                        "#[{}] attribute has no effect when no entry point is defined. Either remove it or set an entry point for the contract.",
                        MsgAttr::EXECUTE_GUARD
                    )
                );
            }

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
