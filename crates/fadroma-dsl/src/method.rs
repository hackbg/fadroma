use syn::{
    Signature, Path, Ident, FnArg, Pat,
    punctuated::Punctuated, token::Comma
};
use proc_macro2::Span;

use crate::err::ErrorSink;

pub enum Method<'a> {
    Contract(ContractMethod<'a>),
    Interface(InterfaceMethod<'a>)
}

pub struct ContractMethod<'a> {
    pub sig: &'a Signature
}

pub struct InterfaceMethod<'a> {
    pub sig: &'a Signature,
    pub trait_: &'a Path
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

impl<'a> Method<'a> {
    #[inline]
    pub fn sig(&self) -> &Signature {
        match self {
            Method::Contract(x) => x.sig,
            Method::Interface(x) => x.sig
        }
    }
}

impl<'a> InterfaceMethod<'a> {
    #[inline]
    pub fn trait_name(&self) -> &Ident {
        &self.trait_.segments.last().unwrap().ident
    }
}
