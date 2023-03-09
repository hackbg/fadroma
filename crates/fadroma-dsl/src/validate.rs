use syn::{Signature, ReturnType, Type, PathSegment, PathArguments, GenericArgument};
use quote::quote;

use crate::err::ErrorSink;

/// Represents the generic types in `std::result::Result<T, E>`.
pub struct ResultType<'a> {
    pub value: &'a GenericArgument,
    pub error: &'a GenericArgument
}

pub fn result_type<'a>(
    sink: &mut ErrorSink,
    sig: &'a Signature,
    generics: (Option<GenericArgument>, Option<GenericArgument>)
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

    let result_ty = match generics.0 {
        Some(ty) => quote!(#ty),
        None => quote!(T)
    };

    let err_ty = match generics.1 {
        Some(ty) => quote!(#ty),
        None => quote!(E)
    };

    sink.push_spanned(
        &sig,
        format!("Expecting return type to be \"std::result::Result<{}, {}>\"", result_ty, err_ty)
    );

    None
}

fn validate_return_type<'a, 'b>(
    segment: &'a PathSegment,
    generics: &'b (Option<GenericArgument>, Option<GenericArgument>)
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

    if let Some(expected) = &generics.0 {
        if expected != value {
            return None;
        }
    }

    let error = iter.next().unwrap();

    if let Some(expected) = &generics.1 {
        if expected != error {
            return None;
        }
    }

    Some(ResultType {
        value,
        error
    })
}
