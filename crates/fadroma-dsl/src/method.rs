use std::slice;

use syn::{
    Signature, Path, Ident, FnArg, Pat, GenericArgument, ItemTrait,
    TraitItem, ItemImpl, ImplItem, punctuated::Punctuated,
    token::Comma, parse_quote
};
use proc_macro2::Span;

use crate::{
    validate::{self, ResultType},
    attr::{MsgAttr, ERROR_TYPE},
    err::ErrorSink
};

pub enum Method<'a> {
    Contract(ContractMethod<'a>),
    Interface(InterfaceMethod<'a>)
}

pub struct ContractMethod<'a> {
    ty: MsgAttr,
    sig: &'a Signature,
    return_ty: ResultType<'a>
}

pub struct InterfaceMethod<'a> {
    pub ty: MsgAttr,
    pub sig: &'a Signature,
    pub return_ty: ResultType<'a>,
    trait_: Path
}

pub fn trait_methods<'a>(
    sink: &mut ErrorSink,
    trait_: &'a ItemTrait
) -> Vec<InterfaceMethod<'a>> {
    let mut methods = vec![];

    for item in &trait_.items {
        let TraitItem::Method(method) = item else {
            continue;
        };

        if method.default.is_some() {
            sink.push_spanned(
                method,
                "Contract interface method cannot contain a default implementation."
            );
        }

        let Some(ty) = MsgAttr::parse(sink, &method.attrs) else {
            sink.expected_interface_attrs(&method.sig.ident);

            continue;
        };

        let trait_ = Path::from(trait_.ident.clone());

        if let Some(return_ty) = interface_method_return_ty(
            sink,
            ty,
            &trait_,
            &method.sig
        ) {
            methods.push(InterfaceMethod {
                ty,
                sig: &method.sig,
                trait_,
                return_ty
            });
        }
    }

    methods
}

pub fn item_impl_methods<'a>(
    sink: &mut ErrorSink,
    item_impl: &'a ItemImpl
) -> Vec<Method<'a>> {
    let mut methods = vec![];

    for item in &item_impl.items {
        let ImplItem::Method(method) = item else {
            continue;
        };

        let Some(ty) = MsgAttr::parse(sink, &method.attrs) else {
            // Require an attribute for trait impls only.
            // The "Contract" struct methods don't all
            // have to be part of its interface.
            if item_impl.trait_.is_some() {
                sink.expected_interface_attrs(&method.sig.ident);
            }

            continue;
        };

        if let Some((_, trait_, _)) = &item_impl.trait_ {
            if let Some(return_ty) = interface_method_return_ty(
                sink,
                ty,
                &trait_,
                &method.sig
            ) {
                methods.push(Method::Interface(InterfaceMethod {
                    ty,
                    sig: &method.sig,
                    trait_: trait_.clone(),
                    return_ty
                }));
            }
        } else {
            if method.vis != parse_quote!(pub) {
                sink.push_spanned(method, "Method must be public.");
            }

            if let Some(return_ty) = contract_method_return_ty(
                sink,
                ty,
                &method.sig
            ) {
                methods.push(Method::Contract(ContractMethod {
                    ty,
                    sig: &method.sig,
                    return_ty
                }));
            }
        }
    }

    methods
}

pub fn fn_args_to_idents(
    sink: &mut ErrorSink,
    inputs: &Punctuated<FnArg, Comma>
) -> Punctuated<Ident, Comma> {
    let mut result = Punctuated::<Ident, Comma>::new();

    for input in inputs {
        if let Some(ident) = fn_arg_ident(sink, input) {
            result.push_value(ident);
            result.push_punct(Comma(Span::call_site()));
        }
    }

    result
}

#[inline]
pub fn fn_arg_ident(sink: &mut ErrorSink, arg: &FnArg) -> Option<Ident> {
    match arg {
        FnArg::Typed(pat_type) => pat_ident(sink, *pat_type.pat.to_owned()),
        FnArg::Receiver(_) => {
            sink.push_spanned(
                &arg,
                "Method definition cannot contain \"self\".",
            );

            None
        }
    }
}

#[inline]
pub fn pat_ident(sink: &mut ErrorSink, pat: Pat) -> Option<Ident> {
    if let Pat::Ident(pat_ident) = pat {
        // Strip leading underscores because we might want to include a field in the
        // generated message, but not actually use it in the impl. A very rare case,
        // but it is used in the SNIP-20 implementation ('padding' field), for example.
        let name = pat_ident.ident.to_string();
        let name = name.trim_start_matches('_');

        Some(Ident::new(name, pat_ident.ident.span()))
    } else {
        sink.push_spanned(pat, "Expected identifier.");

        None
    }
}

fn interface_method_return_ty<'a>(
    sink: &mut ErrorSink,
    ty: MsgAttr,
    trait_ident: &Path,
    sig: &'a Signature
) -> Option<validate::ResultType<'a>> {
    let err_ty = Ident::new(ERROR_TYPE, Span::call_site());
    let err_args: &[GenericArgument] = &[
        parse_quote!(Self::#err_ty),
        parse_quote!(<Self as #trait_ident>::#err_ty)
    ];

    let expected = expected_value_type(ty);
    let expected = if let Some(expected) = &expected {
        slice::from_ref(expected)
    } else {
        &[]
    };

    validate::result_type(sink, sig, (expected, err_args))
}

#[inline]
fn contract_method_return_ty<'a>(
    sink: &mut ErrorSink,
    ty: MsgAttr,
    sig: &'a Signature
) -> Option<ResultType<'a>> {
    let expected = expected_value_type(ty);
    let expected = if let Some(expected) = &expected {
        slice::from_ref(expected)
    } else {
        &[]
    };

    validate::result_type(sink, sig, (expected, &[]))
}

#[inline]
fn expected_value_type(ty: MsgAttr) -> Option<GenericArgument> {
    match ty {
        MsgAttr::Init { .. } | MsgAttr::Execute | MsgAttr::Reply =>
            Some(parse_quote!(Response)),
        MsgAttr::Query => None,
        MsgAttr::ExecuteGuard => Some(parse_quote!(()))
    }
}

impl<'a> Method<'a> {
    #[inline]
    pub fn sig(&self) -> &Signature {
        match self {
            Method::Contract(x) => x.sig,
            Method::Interface(x) => x.sig
        }
    }

    #[inline]
    pub fn ty(&self) -> MsgAttr {
        match self {
            Method::Contract(x) => x.ty,
            Method::Interface(x) => x.ty
        }
    }

    #[inline]
    pub fn return_ty(&self) -> &ResultType<'_> {
        match self {
            Method::Contract(x) => &x.return_ty,
            Method::Interface(x) => &x.return_ty
        }
    }
}

impl<'a> InterfaceMethod<'a> {
    #[inline]
    pub fn trait_name(&self) -> &Ident {
        &self.trait_.segments.last().unwrap().ident
    }
}
