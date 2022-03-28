macro_rules! sp {
    () => { proc_macro2::Span::call_site() }
}

pub(crate) use sp;

macro_rules! vis {
    (pub) => {
        syn::Visibility::Public(syn::VisPublic { pub_token: syn::Token![pub](sp!()) })
    };
    (inh) => {
        syn::Visibility::Inherited
    };
}

pub(crate) use vis;

macro_rules! no_generics {
    () => {
        syn::Generics {
            gt_token:     None,
            params:       syn::punctuated::Punctuated::new(),
            lt_token:     None,
            where_clause: None
        }
    };
}

pub(crate) use no_generics;

macro_rules! msg_struct {
    ($name:expr) => {
        syn::ItemStruct {
            attrs:        vec![],
            generics:     no_generics!(),
            ident:        syn::Ident::new($name, sp!()),
            semi_token:   Some(syn::Token![;](sp!())),
            struct_token: syn::Token![struct](sp!()),
            vis:          vis!(pub),
            fields:       syn::Fields::Named(syn::FieldsNamed {
                brace_token: syn::token::Brace { span: sp!() },
                named:       syn::punctuated::Punctuated::new()
            }),
        }
    }
}

pub(crate) use msg_struct;

macro_rules! msg_enum {
    ($name:expr) => {
        syn::ItemEnum {
            attrs:       Vec::new(),
            vis:         vis!(pub),
            enum_token:  Token![enum](sp!()),
            ident:       syn::Ident::new($name, sp!()),
            generics:    no_generics!(),
            brace_token: syn::token::Brace { span: sp!() },
            variants:    syn::punctuated::Punctuated::new()
        }
    }
}

pub(crate) use msg_enum;
