use syn::{Signature, ReturnType, Type, PathSegment, PathArguments, GenericArgument};
use quote::quote;

use crate::err::ErrorSink;

pub fn result_type(
    sink: &mut ErrorSink,
    sig: &Signature,
    generics: (Option<GenericArgument>, Option<GenericArgument>)
) {
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
                if validate_return_type(&segment, &generics) {
                    return;
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
}

fn validate_return_type(
    segment: &PathSegment,
    generics: &(Option<GenericArgument>, Option<GenericArgument>)
) -> bool {
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

    if let Some(expected) = &generics.0 {
        if expected != next {
            return false;
        }
    }

    let next = iter.next().unwrap();

    if let Some(expected) = &generics.1 {
        if expected != next {
            return false;
        }
    }

    true
}
