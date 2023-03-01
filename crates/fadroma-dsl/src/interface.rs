use syn::{
    ItemTrait, TraitItem, TraitItemMethod, Type,
    ReturnType, PathArguments, GenericArgument,
    PathSegment, parse_quote, TypePath, token::Add,
    TypeParamBound, TraitBoundModifier, punctuated::Punctuated
};
use quote::quote;

use crate::{
    attr::{INIT, EXECUTE, QUERY, ERROR_TYPE_IDENT},
    err::{ErrorSink, CompileErrors},
    generate::{MsgType, generate_init_msg, generate_messages}
};

pub struct Interface {
    /// Optional because an interface might not want to have an init method.
    init: Option<TraitItemMethod>,
    execute: Vec<TraitItemMethod>,
    query: Vec<TraitItemMethod>
}

impl Interface {
    pub fn derive(r#trait: ItemTrait) -> Result<proc_macro2::TokenStream, CompileErrors> {
        let mut sink = ErrorSink::default();
        let interface = Self::parse(&mut sink, r#trait);

        let init_msg = generate_init_msg(&mut sink, interface.init);
        let execute_msg = generate_messages(&mut sink, MsgType::Execute, &interface.execute);
        let query_msg = generate_messages(&mut sink, MsgType::Query, &interface.query);

        sink.check()?;

        Ok(quote! {
            #init_msg
            #execute_msg
            #query_msg
        })
    }

    fn parse(sink: &mut ErrorSink, r#trait: ItemTrait) -> Self {
        let mut has_error_ty = false;

        let trait_ident = r#trait.ident;
        let mut init = None;
        let mut execute = vec![];
        let mut query = vec![];

        for item in r#trait.items {
            match item {
                TraitItem::Method(method) => {
                    let mut attr_err = false;
                    let ident = method.sig.ident.clone();

                    if method.attrs.len() != 1 {
                        attr_err = true;
                    } else {
                        if let Some(ident) = method.attrs[0].path.get_ident() {
                            match ident.to_string().as_str() {
                                INIT if init.is_some() => sink.push_spanned(
                                    &trait_ident,
                                    "Only one method can be annotated as #[init].",
                                ),
                                INIT => {
                                    validate_method(sink, &method, Some(parse_quote!(Response)));
                                    init = Some(method);
                                },
                                EXECUTE => {
                                    validate_method(sink, &method, Some(parse_quote!(Response)));
                                    execute.push(method);
                                },
                                QUERY => {
                                    validate_method(sink, &method, None);
                                    query.push(method);
                                },
                                _ => attr_err = true
                            }
                        } else {
                            attr_err = true;
                        }
                    }

                    if attr_err {
                        const ATTRS: [&str; 3] = [INIT, EXECUTE, QUERY];

                        sink.push_spanned(
                            ident,
                            format!("Expecting exactly one attribute of: {:?}", ATTRS)
                        );
                    }
                }
                TraitItem::Type(type_def)
                    if type_def.ident.to_string() == ERROR_TYPE_IDENT => 
                {
                    has_error_ty = true;

                    if !validate_err_bound(&type_def.bounds) {
                        sink.push_spanned(
                            &type_def,
                            format!("{} type must have a single \"std::string::ToString\" bound.", ERROR_TYPE_IDENT)
                        );
                    }

                    if !type_def.generics.params.is_empty() ||
                        type_def.generics.where_clause.is_some() {
                        sink.push_spanned(
                            type_def.generics,
                            format!("{} type cannot have any generics.", ERROR_TYPE_IDENT)
                        );
                    }
                }
                _ => { }
            }
        }

        if !has_error_ty {
            sink.push_spanned(
                &trait_ident,
                format!("Missing \"type {}: ToString;\" trait type declaration.", ERROR_TYPE_IDENT)
            );
        }

        Self {
            init,
            execute,
            query
        }
    }
}

fn validate_method(
    sink: &mut ErrorSink,
    method: &TraitItemMethod,
    expected: Option<TypePath>
) {
    if method.default.is_some() {
        sink.push_spanned(
            method,
            "Contract interface method cannot contain a default implementation."
        );
    }

    if let ReturnType::Type(_, return_type) = &method.sig.output {
        if let Type::Path(path) = return_type.as_ref() {
            if path.qself.is_some() {
                sink.push_spanned(
                    path,
                    "Unexpected \"Self\" in return type.",
                );
            }

            let mut iter = path.path.segments.iter().rev();

            if let Some(segment) = iter.next() {
                if validate_return_type(&segment, &expected) {
                    return;
                }
            }
        }
    }

    let result_type = match expected {
        Some(ty) => quote!(#ty),
        None => quote!(T)
    };

    sink.push_spanned(
        &method,
        format!("Expecting return type to be \"std::result::Result<{}, Self::Error>\"", result_type)
    );
}

fn validate_return_type(segment: &PathSegment, expected: &Option<TypePath>) -> bool {
    if segment.ident.to_string() != "Result" {
        return false;
    }

    let PathArguments::AngleBracketed(args) = &segment.arguments else {
        return false;
    };

    if args.args.len() != 2 {
        return false;
    }

    let mut iter = args.args.iter();
    let next = iter.next().unwrap();

    if let Some(expected) = expected {
        let GenericArgument::Type(ty) = next else {
            return false;
        };

        let Type::Path(path) = ty else {
            return false;
        };

        if expected != path {
            return false;
        }
    }

    let next = iter.next().unwrap();
    let arg: GenericArgument = parse_quote!(Self::Error);

    if *next == arg {
        true
    } else {
        false
    }
}

fn validate_err_bound(bounds: &Punctuated<TypeParamBound, Add>) -> bool {
    if bounds.len() != 1 {
        return false;
    }

    let TypeParamBound::Trait(bound) = bounds.first().unwrap() else {
        return false;
    };

    if !matches!(bound.modifier, TraitBoundModifier::None) ||
        bound.lifetimes.is_some()
    {
        return false;
    }

    let Some(segment) = bound.path.segments.last() else {
        return false;
    };

    segment.ident.to_string() == "ToString" &&
        segment.arguments == PathArguments::None
}
