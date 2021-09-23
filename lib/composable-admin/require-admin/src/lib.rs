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
                        if let Pat::Ident(ident) = item.pat.as_ref() {
                            let last = type_path.path.segments.last().unwrap();

                            match last.ident.to_string().as_str() {
                                "MessageInfo" => info = Some(ident.clone()),
                                "DepsMut" => deps = Some(ident.clone()),
                                _ => continue
                            };
                        }
                    }
                    _ => continue
                }
            },
            _ => continue
        }
    }
    
    return (
        deps.unwrap_or_else(|| panic!("Couldn't find argument of type \"DepsMut\"")),
        info.unwrap_or_else(|| panic!("Couldn't find arguments of type \"MessageInfo\""))
    );
}

fn create_require_admin_stmt(deps: PatIdent, info: PatIdent) -> Stmt {
    let code = quote! {
        assert_admin(#deps.as_ref(), &#info)?;
    };

    parse_quote!(#code)
}
