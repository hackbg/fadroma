use quote::{quote, ToTokens};
use proc_macro2::TokenStream;
use syn::{
    Token, token::{Brace, Paren}, punctuated::Punctuated,
    Ident,
    Path, PathSegment, PathArguments,
    Fields, FieldsNamed, FieldsUnnamed, Field,
    Variant,
    TraitBound, TraitBoundModifier,
    ExprPath,
    Type, TypePath,
    ItemEnum
};

use crate::macros::*;
use crate::model::*;

impl Contract {
    pub fn write (&self) -> TokenStream {
        let browser_entrypoint = browser_entrypoint();
        let chain_entrypoint   = chain_entrypoint();
        let common_entrypoint  = common_entrypoint();
        let messages = write_messages(self);
        let trait_   = write_trait(self);
        let impls    = write_impls(self);
        TokenStream::from(quote! {
            #browser_entrypoint
            #chain_entrypoint
            #common_entrypoint
            #trait_
            #impls
            #messages
        })
    }
}

fn write_trait (contract: &Contract) -> TokenStream {
    // collect trait bounds and init calls
    let mut bounds = TokenStream::new();
    let mut inits  = TokenStream::new();
    for ((path, items), attrs) in contract.components.iter() {
        // add trait bound
        TraitBound {
            lifetimes:   None,
            modifier:    TraitBoundModifier::None,
            paren_token: None,
            path:        path.clone()
        }.to_tokens(&mut bounds);
        Token![+](sp!()).to_tokens(&mut bounds);
        // add trait init call
        let init_key = path.segments.last().unwrap().ident.to_string().to_lowercase();
        let init_key = Ident::new(init_key.as_str(), sp!());
        let mut init_path = path.clone();
        init_path.segments.push_punct(Token![::](sp!()));
        init_path.segments.push_value(PathSegment {
            ident:     Ident::new("init", sp!()),
            arguments: PathArguments::None
        });
        let init_expr = ExprPath {
            path:  init_path,
            qself: None,
            attrs: vec![]
        };
        inits = quote! {
            #inits
            #init_expr(self, env, msg.#init_key);
        };
    }
    TokenStream::from(quote! {
        pub trait Contract<S: fadroma::Storage, A: fadroma::Api, Q: fadroma::Querier>:
            fadroma::Composable<S, A, Q> + #bounds Sized
        {
            fn init (&mut self, env: fadroma::Env, msg: Init) ->
                fadroma::StdResult<fadroma::InitResponse>
            {
                let response = fadroma::InitResponse::default();
                #inits
                Ok(response)
            }
            fn handle (&mut self, env: fadroma::Env, msg: Handle) ->
                fadroma::StdResult<fadroma::HandleResponse>
            {
                msg.dispatch_handle(self, env)
            }
            fn query (&self, msg: Query) ->
                fadroma::StdResult<Response>
            {
                msg.dispatch_query(self)
            }
        }
    })
}

fn write_impls (contract: &Contract) -> TokenStream {
    TokenStream::from(quote! {})
}

fn write_messages (contract: &Contract) -> TokenStream {
    let mut init_struct = msg_struct!("Init");
    let mut init_struct_fields = FieldsNamed {
        brace_token: Brace { span: sp!() },
        named: Punctuated::new()
    };
    let mut handle_enum   = msg_enum!("Handle");
    let mut query_enum    = msg_enum!("Query");
    let mut response_enum = msg_enum!("Response");
    for ((path, _), _) in contract.components.iter() {
        let last = path.segments.last();
        let mut init_path = path.clone();
        init_path.segments.push_punct(Token![::](sp!()));
        init_path.segments.push_value(PathSegment {
            ident:     Ident::new("Init", sp!()),
            arguments: PathArguments::None
        });
        let field_name = last.unwrap().ident.to_string().to_lowercase();
        init_struct_fields.named.push_value(Field {
            attrs:       vec![],
            vis:         vis!(pub),
            ident:       Some(Ident::new(field_name.as_str(), sp!())),
            colon_token: Some(Token![:](sp!())),
            ty:          Type::Path(TypePath { qself: None, path: init_path })
        });
        init_struct_fields.named.push_punct(Token![,](sp!()));
        compose_enum_variants("Handle",   &mut handle_enum,   path, last.unwrap().ident.clone());
        compose_enum_variants("Query",    &mut query_enum,    path, last.unwrap().ident.clone());
        compose_enum_variants("Response", &mut response_enum, path, last.unwrap().ident.clone());
    }
    init_struct.fields = Fields::Named(init_struct_fields);
    TokenStream::from(quote! {
        #init_struct
        #handle_enum
        #query_enum
        #response_enum
    })
}

fn browser_entrypoint () -> TokenStream {
    TokenStream::from(quote! {
        #[cfg(browser)] #[macro_use] extern crate wasm_bindgen;
        #[cfg(all(feature="browser",target_arch="wasm32"))]
        mod wasm { fadroma_bind_js::bind_js!(fadroma, super); }
    })
}

fn chain_entrypoint () -> TokenStream {
    TokenStream::from(quote! {
        #[cfg(all(not(feature="browser"),target_arch="wasm32"))]
        mod wasm {
            use fadroma::{ExternalApi, ExternalQuerier, ExternalStorage};
            #[no_mangle] extern "C" fn init(env_ptr: u32, msg_ptr: u32) -> u32 {
                fadroma::do_init(
                    &super::init::<ExternalStorage, ExternalApi, ExternalQuerier>,
                    env_ptr,
                    msg_ptr
                )
            }
            #[no_mangle] extern "C" fn handle(env_ptr: u32, msg_ptr: u32) -> u32 {
                fadroma::do_handle(
                    &super::handle::<ExternalStorage, ExternalApi, ExternalQuerier>,
                    env_ptr,
                    msg_ptr
                )
            }
            #[no_mangle] extern "C" fn query(msg_ptr: u32) -> u32 {
                fadroma::do_query(
                    &super::query::<ExternalStorage, ExternalApi, ExternalQuerier>,
                    msg_ptr
                )
            }
        }
    })
}

fn common_entrypoint () -> TokenStream {
    TokenStream::from(quote! {
        pub fn init <
            S: fadroma::Storage,
            A: fadroma::Api,
            Q: fadroma::Querier
        > (
            deps: &mut fadroma::Extern<S, A, Q>,
            env:  fadroma::Env,
            msg:  Init
        ) -> fadroma::StdResult<fadroma::InitResponse> {
            Contract::init(deps, env, msg)
        }
        pub fn handle <
            S: fadroma::Storage,
            A: fadroma::Api,
            Q: fadroma::Querier
        > (
            deps: &mut fadroma::Extern<S, A, Q>,
            env: fadroma::Env,
            msg: Handle
        ) -> fadroma::StdResult<fadroma::HandleResponse> {
            Contract::handle(deps, env, msg)
        }
        pub fn query <
            S: fadroma::Storage,
            A: fadroma::Api,
            Q: fadroma::Querier
        > (
            deps: &fadroma::Extern<S, A, Q>,
            msg: Query
        ) -> fadroma::StdResult<fadroma::Binary> {
            fadroma::to_binary(&Contract::query(deps, msg)?)
        }
    })
}

fn compose_enum_variants (
    name:          &str,
    composed_enum: &mut ItemEnum,
    path:          &Path,
    ident:         Ident
) {
    let mut path = path.clone();
    path.segments.push_punct(Token![::](sp!()));
    path.segments.push_value(PathSegment {
        ident:     Ident::new(name, sp!()),
        arguments: PathArguments::None
    });

    let mut unnamed = Punctuated::new();
    unnamed.push_value(Field {
        attrs: vec![],
        vis:   vis!(inh),
        ident: None,
        colon_token: None,
        ty: Type::Path(TypePath { qself: None, path })
    });
    unnamed.push_punct(Token![,](sp!()));

    composed_enum.variants.push_value(Variant {
        ident,
        fields: Fields::Unnamed(FieldsUnnamed {
            paren_token: Paren { span: sp!() },
            unnamed
        }),
        attrs: vec![],
        discriminant: None
    });
    composed_enum.variants.push_punct(Token![,](sp!()));
}

impl Component {
    pub fn write (&self) -> TokenStream {
        let name = "Auth";
        TokenStream::from(quote! {
            //let foo = "#name";
            //pub trait #name<S: Storage, A: Api, Q: Querier>: Composable<S, A, Q> {
            //}
        })
    }
}
