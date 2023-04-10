use syn::{
    Signature, ReturnType, Type, PathSegment,
    PathArguments, GenericArgument, Generics,
    FnArg
};
use quote::quote;

use crate::err::ErrorSink;

/// Represents the generic types in `std::result::Result<T, E>`.
#[derive(Debug)]
pub struct ResultType<'a> {
    pub value: &'a GenericArgument,
    pub error: &'a GenericArgument
}

pub fn result_type<'a>(
    sink: &mut ErrorSink,
    sig: &'a Signature,
    generics: (&[GenericArgument], &[GenericArgument])
) -> Option<ResultType<'a>> {
    if let ReturnType::Type(_, return_type) = &sig.output {
        if let Type::Path(path) = return_type.as_ref() {
            if path.qself.is_some() {
                sink.push_spanned(
                    path,
                    "Unexpected \"Self\" in return type.",
                );
            }

            let last = path.path.segments.last();

            if let Some(segment) = last {
                let result = validate_return_type(&segment, &generics);

                if result.is_some() {
                    return result;
                }
            }
        }
    }

    let result_ty: Vec<String> = generics.0.iter().map(|x| quote!(#x).to_string()).collect();
    let err_ty: Vec<String> = generics.1.iter().map(|x| quote!(#x).to_string()).collect();

    sink.push_spanned(
        &sig,
        format!(
            "Expecting return type to be \"std::result::Result<T, E>\" where\nT is one of: {:?}\nE is one of: {:?}",
            result_ty,
            err_ty
        )
    );

    None
}

#[inline]
pub fn has_generics(generics: &Generics) -> bool {
    !generics.params.is_empty() || generics.where_clause.is_some()
}

pub fn has_single_arg(
    sink: &mut ErrorSink,
    sig: &Signature,
    test: impl FnOnce(&Type) -> bool
) -> bool {
    if let Some(arg) = sig.inputs.first() {
        match arg {
            FnArg::Typed(pat_type) => {
                return test(&pat_type.ty) && sig.inputs.len() == 1;
            }
            FnArg::Receiver(_) => {
                sink.push_spanned(
                    &arg,
                    "Method definition cannot contain \"self\".",
                );
            }
        }
    }

    false
}

fn validate_return_type<'a, 'b>(
    segment: &'a PathSegment,
    generics: &'b (&[GenericArgument], &[GenericArgument])
) -> Option<ResultType<'a>> {
    if segment.ident.to_string() != "Result" {
        return None;
    }

    let PathArguments::AngleBracketed(args) = &segment.arguments else {
        return None;
    };

    if args.args.len() != 2 {
        return None;
    }

    let mut iter = args.args.iter();

    let value = iter.next().unwrap();
    let error = iter.next().unwrap();

    if contains_arg(generics.0, value) && contains_arg(generics.1, error) {
        Some(ResultType {
            value,
            error
        })
    } else {
        None
    }
}

#[inline]
fn contains_arg(valid: &[GenericArgument], arg: &GenericArgument) -> bool {
    valid.is_empty() || valid.contains(&arg)
}
