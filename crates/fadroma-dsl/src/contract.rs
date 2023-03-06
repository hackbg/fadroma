use syn::{
    Item, ItemMod, ItemImpl, Type, TypePath, Ident,
    ItemStruct, ImplItem, ItemEnum, ItemFn, parse_quote
};
use quote::quote;
use proc_macro2::Span;

use crate::{
    attr::{MsgAttr, CONTRACT},
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
    let Some(contract) = Contract::parse(&mut sink, item_mod.ident.span(), items) else {
        return Err(sink.check().unwrap_err());
    };

    let ident = Ident::new(CONTRACT, Span::call_site());
    let contract_struct: ItemStruct = parse_quote! {
        #[derive(Clone, Copy, Debug)]
        pub struct #ident;
    };

    let g = contract.generate(&mut sink);

    if let Some(init) = g.init_msg {
        items.push(Item::Struct(init));
    }
    items.push(Item::Enum(g.execute_msg));
    items.push(Item::Enum(g.query_msg));

    if let Some(entry) = g.entry {
        items.push(Item::Fn(entry.init));
        items.push(Item::Fn(entry.execute));
        items.push(Item::Fn(entry.query));
    }

    sink.check()?;

    Ok(quote! {
        #contract_struct
        #item_mod
    })
}

struct Contract<'a> {
    contract_impl: &'a ItemImpl
}

struct Generated {
    init_msg: Option<ItemStruct>,
    execute_msg: ItemEnum,
    query_msg: ItemEnum,
    entry: Option<Entrypoints>
}

struct Entrypoints {
    init: ItemFn,
    execute: ItemFn,
    query: ItemFn
}

impl<'a> Contract<'a> {
    fn parse(sink: &mut ErrorSink, mod_span: Span, items: &'a [Item]) -> Option<Self> {
        let mut contract_impl = None;

        for item in items {
            if let Item::Impl(item) = item {
                match item.self_ty.as_ref() {
                    Type::Path(path) if is_contract_impl(&path) => {
                        if contract_impl.is_some() {
                            sink.push(
                                mod_span,
                                format!("Can only have a single \"impl {}\" item.", CONTRACT)
                            );
                        } else {
                            contract_impl = Some(item);
                        }
                    },
                    _ => {}
                }
            }
        }

        if let Some(contract_impl) = contract_impl {
            Some(Self {
                contract_impl
            })
        } else {
            sink.push(mod_span, format!("Missing \"impl {}\" item.", CONTRACT));
            None
        }
    }

    fn generate(self, sink: &mut ErrorSink) -> Generated {
        let mut is_entry = false;
        let mut init = None;
        let mut execute = vec![];
        let mut query = vec![];

        for item in &self.contract_impl.items {
            if let ImplItem::Method(method) = item {
                if let Some(attr) = MsgAttr::parse(sink, &method.attrs) {
                    match attr {
                        MsgAttr::Init { .. } if init.is_some() => sink.push_spanned(
                            &self.contract_impl.self_ty,
                            "Only one method can be annotated as #[init]."
                        ),
                        MsgAttr::Init { entry } => {
                            is_entry = entry;

                            validate::result_type(sink, &method.sig, (Some(parse_quote!(Response)), None));
                            init = Some(method);
                        }
                        MsgAttr::Execute => {
                            validate::result_type(sink, &method.sig, (Some(parse_quote!(Response)), None));
                            execute.push(method);
                        }
                        MsgAttr::Query => {
                            validate::result_type(sink, &method.sig, (None, None));
                            query.push(method);
                        }
                    }
                }
            }
        }

        let init_msg = init.as_ref().and_then(|x|
            Some(generate::init_msg(sink, &x.sig))
        );

        let execute_msg = generate::messages(
            sink,
            MsgType::Execute,
            execute.iter().map(|x| &x.sig)
        );
        let query_msg = generate::messages(
            sink,
            MsgType::Query,
            query.iter().map(|x| &x.sig)
        );

        let entry = if is_entry {
            generate::init_fn(
                sink,
                &init.as_ref().unwrap().sig
            ).and_then(|init| 
                Some(Entrypoints {
                    init,
                    execute: generate::execute_fn(
                        sink,
                        execute.iter().map(|x| &x.sig)
                    ),
                    query: generate::query_fn(
                        sink,
                        query.iter().map(|x| &x.sig)
                    )
                }
            ))
        } else {
            None
        };

        Generated {
            init_msg,
            execute_msg,
            query_msg,
            entry
        }
    }
}

#[inline]
fn is_contract_impl(path: &TypePath) -> bool {
    let ident = Ident::new(CONTRACT, Span::call_site());
    let expected: TypePath = parse_quote!(#ident);

    path.qself.is_none() && (path.path == expected.path)
}
