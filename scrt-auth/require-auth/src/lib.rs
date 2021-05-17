use proc_macro::TokenStream;
use syn::{
    FnArg, ItemFn, PathArguments, Stmt, Type, 
    parse_macro_input, parse_quote, Pat, PatIdent
};
use syn::punctuated::Punctuated;
use syn::token::Comma;
use quote::quote;

#[proc_macro_attribute]
pub fn require_sender_auth(_attr: TokenStream, func: TokenStream) -> TokenStream {
    let mut ast = parse_macro_input!(func as ItemFn);

    let (deps, env, key) = find_extern_arg(&ast.sig.inputs);

    let stmt = create_require_admin_stmt(deps, env, key);
    ast.block.stmts.insert(0, stmt);

    let result = quote! {
        #ast
    };

    TokenStream::from(result)
}

fn find_extern_arg(args: &Punctuated<FnArg, Comma>) -> (PatIdent, PatIdent, PatIdent) {
    let mut deps: Option<PatIdent> = None;
    let mut env: Option<PatIdent> = None;
    let mut key: Option<PatIdent> = None;

    for arg in args {
        match arg {
            FnArg::Typed(item) => {
                match item.ty.as_ref() {
                    Type::Reference(reference) => {
                        match reference.elem.as_ref() {
                            Type::Path(type_path) => {
                                let result = type_path.path.segments.iter()
                                    .find(|i| {
                                        if let PathArguments::AngleBracketed(_) = i.arguments {
                                            if i.ident.to_string() == "Extern" {
                                                return true
                                            }
                                        }

                                        false
                                    });

                                if let Some(_) = result {
                                    if let Pat::Ident(ident) = item.pat.as_ref() {
                                        deps = Some(ident.clone())
                                    }
                                }
                            },
                            _ => continue
                        }
                    },
                    Type::Path(type_path) => {
                        let result = type_path.path.segments.iter()
                            .find(|i| {
                                if i.ident.to_string() == "Env" {
                                    return true
                                }
                    
                                false
                            });
                
                        if let Some(_) = result {
                            if let Pat::Ident(ident) = item.pat.as_ref() {
                                env = Some(ident.clone())
                            }
                        }

                        let result = type_path.path.segments.iter()
                            .find(|i| {
                                if i.ident.to_string() == "ViewingKey" {
                                    return true
                                }
                    
                                false
                            });
            
                        if let Some(_) = result {
                            if let Pat::Ident(ident) = item.pat.as_ref() {
                                key = Some(ident.clone())
                            }
                        }
                    }
                    _ => continue
                }
            },
            _ => continue
        }
    }
    
    return (
        deps.unwrap_or_else(|| panic!("Couldn't find argument of type \"Extern<Storage, Api, Querier>\"")),
        env.unwrap_or_else(|| panic!("Couldn't find arguments of type \"Env\"")),
        key.unwrap_or_else(|| panic!("Couldn't find arguments of type \"ViewingKey\""))
    );
}

fn create_require_admin_stmt(deps: PatIdent, env: PatIdent, key: PatIdent) -> Stmt {
    let code = quote! {
        authenticate_sender(#deps, &#env, &#key)?;
    };

    parse_quote!(#code)
}
