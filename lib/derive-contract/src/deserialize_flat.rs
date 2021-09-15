use syn::{
    ItemImpl, Stmt, ItemEnum, ImplItemMethod, ImplItem,
    Visibility, Ident, Item, Fields, ExprMatch, Arm,
    parse_quote
};
use syn::token::Comma;
use syn::punctuated::Punctuated;
use proc_macro2::Span;

const HELPER_ENUM_NAME: &str = "Helper";

pub fn impl_deserialize_flat(item: &ItemEnum) -> ItemImpl {
    let ref enum_name = item.ident;

    let mut method_impl: ImplItemMethod = parse_quote! {
        fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
            where D: serde::Deserializer<'de>
        { }
    };

    method_impl.block.stmts.push(create_helper_enum_stmt(item.clone()));

    let value_ident = Ident::new("value", Span::call_site());

    method_impl.block.stmts.push(parse_quote! {
        let #value_ident = serde_json::Value::deserialize(deserializer)?;
    });

    // Try do deserialize the nested variant directly
    // in order to support the flat JSON structure.
    for variant in item.variants.iter() {
        // TODO: add skip attribute

        if let Fields::Unnamed(fields) = &variant.fields {
            if fields.unnamed.len() > 1 {
                panic!("Tuple variant can only contain a single field.")
            }

            let field = fields.unnamed.first().unwrap();
            let ref field_type = field.ty;
            let ref variant_name = variant.ident;

            // TODO: Check if calling "deserialize" on the helper struct would succeed as well.
            // If it does, should throw an error saying that the full path should be used
            // in order to disambiguate.
            let stmt = parse_quote! {
                if let Ok(val) = #field_type::deserialize(&#value_ident) {
                    return Ok(#enum_name::#variant_name(val));
                }
            };

            method_impl.block.stmts.push(stmt);
        }
    }

    let deserialize_result = Ident::new("helper", Span::call_site());
    let helper_enum = Ident::new(HELPER_ENUM_NAME, Span::call_site());

    method_impl.block.stmts.push(parse_quote! {
        let #deserialize_result = #helper_enum::deserialize(&#value_ident).map_err(serde::de::Error::custom)?;
    });

    let match_expr = create_fallback_match_expr(item, deserialize_result, helper_enum);
    let result_ident = Ident::new("result", Span::call_site());

    method_impl.block.stmts.push(parse_quote! {
        let #result_ident = #match_expr;
    });

    method_impl.block.stmts.push(parse_quote! {
        return Ok(#result_ident);
    });

    let mut impl_stmt: ItemImpl = parse_quote! {
        #[automatically_derived]
        impl<'de> serde::Deserialize<'de> for #enum_name {

        }
    };

    impl_stmt.items.push(ImplItem::Method(method_impl));

    return impl_stmt;
}

fn create_helper_enum_stmt(mut item: ItemEnum) -> Stmt {
    item.vis = Visibility::Inherited;
    item.ident = Ident::new(HELPER_ENUM_NAME, Span::call_site());

    item.attrs.clear();
    item.attrs.push(parse_quote! {
        #[derive(serde::Deserialize)]
    });
    item.attrs.push(parse_quote! {
        #[serde(rename_all = "snake_case")]
    });

    Stmt::Item(Item::Enum(item))
}

fn create_fallback_match_expr(
    item: &ItemEnum,
    deserialize_result: Ident,
    helper_enum: Ident
) -> ExprMatch {
    let ref enum_name = item.ident;

    let mut result: ExprMatch = parse_quote! {
        match #deserialize_result {

        }
    };

    for variant in item.variants.iter() {
        let ref variant_name = variant.ident;

        let arm: Arm = match &variant.fields {
            Fields::Named(fields) => {
                let mut args = Punctuated::<Ident, Comma>::new();
                
                for field in fields.named.iter() {
                    args.push(field.ident.clone().unwrap());
                }

                parse_quote! {
                    #helper_enum::#variant_name { #args } => #enum_name::#variant_name { #args }
                }
            },
            Fields::Unnamed(fields) => {                
                let mut args = Punctuated::<Ident, Comma>::new();

                for i in 0..fields.unnamed.len() {
                    args.push(Ident::new(format!("field_{}", i).as_str(), Span::call_site()));
                }

                parse_quote! {
                    #helper_enum::#variant_name(#args) => #enum_name::#variant_name(#args)
                }
            },
            Fields::Unit => {
                parse_quote! {
                    #helper_enum::#variant_name => #enum_name::#variant_name
                }
            }
        };

        result.arms.push(arm);
    }

    result
}
