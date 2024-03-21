use proc_macro::TokenStream;
use syn::{FnArg, ItemFn, Stmt, Type, parse_macro_input, parse_quote, Pat, PatIdent};
use syn::punctuated::Punctuated;
use syn::token::Comma;
use quote::quote;

#[proc_macro_attribute]
pub fn require_admin(_attr: TokenStream, func: TokenStream) -> TokenStream {
    let mut ast = parse_macro_input!(func as ItemFn);

    let (deps, env) = find_extern_arg(&ast.sig.inputs);

    let stmt = create_require_admin_stmt(deps, env);
    ast.block.stmts.insert(0, stmt);

    let result = quote! {
        #ast
    };

    TokenStream::from(result)
}

fn find_extern_arg(args: &Punctuated<FnArg, Comma>) -> (PatIdent, PatIdent) {
    let mut deps: Option<PatIdent> = None;
    let mut info: Option<PatIdent> = None;

    for arg in args {
        match arg {
            FnArg::Typed(item) => {
                match item.ty.as_ref() {
                    Type::Path(type_path) => {
                        let info_arg = type_path.path.segments.iter()
                            .find(|i| {
                                if i.ident.to_string() == "MessageInfo" {
                                    return true
                                }
                    
                                false
                            });

                        let deps_arg = type_path.path.segments.iter().find(|i| {
                            let ident = i.ident.to_string();
                            if ident == "Deps" || ident == "DepsMut" {
                                return true;
                            }

                            false
                        });

                        if let Some(_) = deps_arg {
                            if let Pat::Ident(ident) = item.pat.as_ref() {
                                deps = Some(ident.clone())
                            }
                        }
                
                        if let Some(_) = info_arg {
                            if let Pat::Ident(ident) = item.pat.as_ref() {
                                info = Some(ident.clone())
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
        deps.unwrap_or_else(|| panic!("Couldn't find argument of type \"Deps or DepsMut\"")),
        info.unwrap_or_else(|| panic!("Couldn't find arguments of type \"MessageInfo\""))
    );
}

fn create_require_admin_stmt(deps: PatIdent, info: PatIdent) -> Stmt {
    let ref deps = deps.ident;
    let ref info = info.ident;

    let code = quote! {
        fadroma::admin::assert(#deps.as_ref(), &#info)?;
    };

    parse_quote!(#code)
}
