use syn::{
    TraitItemMethod, Path, AttributeArgs, ItemTrait, Meta,
    TraitItem, ReturnType, Type, Ident, ItemEnum, Variant,
    FnArg, FieldsNamed, Field, Visibility, Pat, Fields,
    ItemStruct, ItemFn, Stmt, Expr, ExprMatch, ExprField,
    GenericArgument, PathArguments, parse_quote
};
use syn::token::{Comma, Brace, Colon};
use syn::punctuated::Punctuated;
use syn::spanned::Spanned;
use quote::quote;
use proc_macro2::{TokenStream, Span};

use crate::args::ContractArgs;
use crate::utils::to_pascal;
use crate::attr;

pub const DEFAULT_IMPL_STRUCT: &str = "DefaultImpl";

const INIT_MSG: &str = "InitMsg";
pub const HANDLE_MSG: &str = "HandleMsg";
const QUERY_MSG: &str = "QueryMsg";
const INIT_FN: &str = "init";
const HANDLE_FN: &str = "handle";
const QUERY_FN: &str = "query";

const CONTRACT_ARG: &str = "contract";

pub struct Contract {
    ty: ContractType,
    args: ContractArgs,
    ident: Ident,
    /// Optional because a component might not want to have an init method.
    init: Option<TraitItemMethod>,
    handle: Vec<TraitItemMethod>,
    query: Vec<TraitItemMethod>,
    handle_guard: Option<TraitItemMethod>
}

#[derive(Clone, Copy)]
pub enum ContractType {
    /// A contract that directly implements its functionality.
    Contract,
    /// An interface defines the methods that a contract exposes.
    Interface,
    /// A contract that implements an interface.
    Impl
}

#[derive(Clone, Copy)]
enum MsgType {
    Handle,
    Query
}

impl MsgType {
    pub fn to_ident(self) -> Ident {
        match self {
            Self::Handle => Ident::new(HANDLE_MSG, Span::call_site()),
            Self::Query => Ident::new(QUERY_MSG, Span::call_site())
        }
    }
}

impl Contract {
    pub fn parse(args: AttributeArgs, item_trait: ItemTrait, ty: ContractType) -> syn::Result<Self> {
        let args = ContractArgs::parse(args, ty)?;
        
        let mut init = None;
        let mut handle_guard = None;
        let mut handle = vec![];
        let mut query = vec![];

        for item in item_trait.items.into_iter() {
            if let TraitItem::Method(method) = item {
                for attr in method.attrs.iter() {
                    let segment = attr.path.segments.last().unwrap();
                    let path = format!("{}", quote!{ #segment });

                    let meta = attr.parse_meta()?;

                    match path.as_str() {
                        attr::INIT => {
                            if init.is_some() {
                                return Err(syn::Error::new(segment.span(), "Only one method can be annotated as #[init]."));
                            }

                            validate_method(&method, Some(parse_quote!(InitResponse)), ty)?;
                            init = Some(method);
                        },
                        attr::HANDLE => {
                            validate_method(&method, Some(parse_quote!(HandleResponse)), ty)?;
                            handle.push(method);
                        },
                        attr::QUERY => {
                            validate_method(&method, None, ty)?;
                            query.push(method);
                        },
                        attr::HANDLE_GUARD => {
                            if ty.is_interface() {
                                return Err(syn::Error::new(
                                    Span::call_site(),
                                    format!(
                                        "Interfaces cannot have the \"{}\" attribute. Specify this on the implementing trait instead.",
                                        attr::HANDLE_GUARD
                                    )
                                ));
                            }

                            if handle_guard.is_some() {
                                return Err(syn::Error::new(segment.span(), "Only one method can be annotated as #[handle_guard]."));
                            }

                            validate_method(&method, Some(parse_quote!(())), ty)?;
                            handle_guard = Some(method);
                        },
                        _ => continue
                    }

                    // Disallow any other stuff in our attributes. If we got to this line,
                    // we know for sure that we are looking at one of the macro's attributes.
                    match meta {
                        Meta::Path(_) => { },
                        _ => {
                            return Err(syn::Error::new(
                                meta.span(),
                                format!("Unexpected meta in \"{}\" attribute arguments.", path.as_str())
                            ));
                        }
                    }

                    break;
                }
            }
        }
    
        Ok(Self {
            ty,
            args,
            ident: item_trait.ident,
            init,
            handle,
            query,
            handle_guard
        })
    }

    pub fn generate_boilerplate(&self) -> syn::Result<TokenStream> {
        match self.ty {
            ContractType::Contract => {
                let init_msg = self.generate_init_msg()?;
                let handle_msg = self.generate_messages(MsgType::Handle)?;
                let query_msg = self.generate_messages(MsgType::Query)?;

                let struct_impl = self.generate_default_impl();

                let init = self.generate_init_fn()?;
                let handle = self.generate_handle_fn()?;
                let query = self.generate_query_fn()?;

                let entry = self.generate_entry_points();

                Ok(quote! {
                    #struct_impl
                    #init_msg
                    #handle_msg
                    #query_msg
                    #init
                    #handle
                    #query
                    #entry
                })
            },
            ContractType::Interface => {
                let init_msg = self.generate_init_msg()?;
                let handle_msg = self.generate_messages(MsgType::Handle)?;
                let query_msg = self.generate_messages(MsgType::Query)?;
        
                Ok(quote! {
                    #init_msg
                    #handle_msg
                    #query_msg
                })
            },
            ContractType::Impl => {
                let struct_impl = self.generate_default_impl();

                let init = self.generate_init_fn()?;
                let handle = self.generate_handle_fn()?;
                let query = self.generate_query_fn()?;

                let entry = self.generate_entry_points();
        
                Ok(quote! {
                    #struct_impl
                    #init
                    #handle
                    #query
                    #entry
                })
            }
        }
    }

    fn generate_default_impl(&self) -> TokenStream {
        let struct_ident = Ident::new(DEFAULT_IMPL_STRUCT, Span::call_site());
        let ref trait_ident = self.ident;

        quote! {
            #[derive(Clone, Copy)]
            pub struct #struct_ident;

            impl #trait_ident for #struct_ident { }
        }
    }

    fn generate_messages(&self, msg_type: MsgType) -> syn::Result<ItemEnum> {
        let methods = match msg_type {
            MsgType::Handle => &self.handle,
            MsgType::Query => &self.query
        };

        let enum_name = msg_type.to_ident();

        let mut result: ItemEnum = parse_quote!{
            #[derive(serde::Serialize, serde::Deserialize, schemars::JsonSchema, Debug)]
            #[serde(rename_all = "snake_case")]
            #[serde(deny_unknown_fields)]
            pub enum #enum_name {

            }
        };

        for method in methods {
            let variant_name = to_pascal(&method.sig.ident.to_string());
            let fields = extract_fields(method, Visibility::Inherited)?;

            result.variants.push(Variant {
                attrs: vec![],
                ident: Ident::new(&variant_name, Span::call_site()),
                fields: Fields::Named(fields),
                discriminant: None
            });
        }

        match msg_type {
            MsgType::Handle => {
                for component in self.args.handle_components() {
                    result.variants.push(component.create_enum_variant(HANDLE_MSG));
                }
            },
            MsgType::Query => {
                for component in self.args.query_components() {
                    result.variants.push(component.create_enum_variant(QUERY_MSG));
                }
            }
        }
        
        Ok(result)
    }

    fn generate_init_msg(&self) -> syn::Result<TokenStream> {
        if let Some(init) = &self.init {
            let msg = Ident::new(INIT_MSG, Span::call_site());

            let mut result: ItemStruct = parse_quote!{
                #[derive(serde::Serialize, serde::Deserialize, schemars::JsonSchema, Debug)]
                #[serde(deny_unknown_fields)]
                pub struct #msg {
    
                }
            };
    
            let fields = extract_fields(&init, parse_quote!(pub))?;
            result.fields = Fields::Named(fields);
    
            return Ok(quote!(#result));
        }

        Ok(TokenStream::new())
    }
    
    fn generate_init_fn(&self) -> syn::Result<TokenStream> {
        if let Some(init) = &self.init {
            let msg = self.args.interface_path_concat(&Ident::new(INIT_MSG, Span::call_site()));
            let fn_name = Ident::new(INIT_FN, Span::call_site());

            let ref trait_name = self.ident;
            let arg_name = Ident::new(CONTRACT_ARG, Span::call_site());
    
            let mut result: ItemFn = parse_quote! {
                pub fn #fn_name<S: cosmwasm_std::Storage, A: cosmwasm_std::Api, Q: cosmwasm_std::Querier>(
                    deps: &mut cosmwasm_std::Extern<S, A, Q>,
                    env: cosmwasm_std::Env,
                    msg: #msg,
                    #arg_name: impl #trait_name
                ) -> cosmwasm_std::StdResult<cosmwasm_std::InitResponse> { }
            };
        
            let mut args = Punctuated::<ExprField, Comma>::new();
    
            for input in &init.sig.inputs {
                let ident = extract_fn_arg_ident(input)?;

                args.push_value(parse_quote!(msg.#ident));
                args.push_punct(Comma(Span::call_site()));
            }
    
            let ref method_name = init.sig.ident;
    
            let call: Expr = parse_quote!(#arg_name.#method_name(#args deps, env));
            result.block.stmts.push(Stmt::Expr(call));
    
            return Ok(quote!(#result));
        }

        Ok(TokenStream::new())
    }
    
    fn generate_handle_fn(&self) -> syn::Result<ItemFn> {
        let msg = self.args.interface_path_concat(&MsgType::Handle.to_ident());
        let fn_name = Ident::new(HANDLE_FN, Span::call_site());

        let ref trait_name = self.ident;
        let arg_name = Ident::new(CONTRACT_ARG, Span::call_site());

        let mut result: ItemFn = parse_quote! {
            pub fn #fn_name<S: cosmwasm_std::Storage, A: cosmwasm_std::Api, Q: cosmwasm_std::Querier>(
                deps: &mut cosmwasm_std::Extern<S, A, Q>,
                env: cosmwasm_std::Env,
                msg: #msg,
                #arg_name: impl #trait_name
            ) -> cosmwasm_std::StdResult<cosmwasm_std::HandleResponse> { }
        };

        if let Some(guard) = &self.handle_guard {
            let ref method_name = guard.sig.ident;

            result.block.stmts.push(parse_quote! {
                #arg_name.#method_name(&msg, deps, &env)?;
            });
        }

        let match_expr = self.create_match_expr(MsgType::Handle)?;
        result.block.stmts.push(Stmt::Expr(match_expr));
        
        Ok(result)
    }

    fn generate_query_fn(&self) -> syn::Result<ItemFn> {
        let msg = self.args.interface_path_concat(&MsgType::Query.to_ident());
        let fn_name = Ident::new(QUERY_FN, Span::call_site());

        let ref trait_name = self.ident;
        let arg_name = Ident::new(CONTRACT_ARG, Span::call_site());

        let match_expr = self.create_match_expr(MsgType::Query)?;

        let mut result: ItemFn = parse_quote! {
            pub fn #fn_name<S: cosmwasm_std::Storage, A: cosmwasm_std::Api, Q: cosmwasm_std::Querier>(
                deps: &cosmwasm_std::Extern<S, A, Q>,
                msg: #msg,
                #arg_name: impl #trait_name
            ) -> cosmwasm_std::StdResult<cosmwasm_std::Binary> { }
        };
        
        result.block.stmts.push(Stmt::Expr(match_expr));

        Ok(result)
    }

    fn create_match_expr(&self, msg_type: MsgType) -> syn::Result<Expr> {
        let methods = match msg_type {
            MsgType::Handle => &self.handle,
            MsgType::Query => &self.query
        };

        let enum_name = self.args.interface_path_concat(&msg_type.to_ident());
        let arg_name = Ident::new(CONTRACT_ARG, Span::call_site());

        let mut match_expr: ExprMatch = parse_quote!(match msg {});

        for method in methods {
            let ref method_name = method.sig.ident;

            let variant = to_pascal(&method_name.to_string());
            let variant = Ident::new(&variant, Span::call_site());

            let mut args = Punctuated::<Ident, Comma>::new();

            for input in &method.sig.inputs {
                let ident = extract_fn_arg_ident(input)?;

                args.push_value(ident);
                args.push_punct(Comma(Span::call_site()));
            }

            match msg_type {
                MsgType::Handle => {
                    match_expr.arms.push(
                        parse_quote!(#enum_name::#variant { #args } => #arg_name.#method_name(#args deps, env))
                    );
                },
                MsgType::Query => {
                    match_expr.arms.push(
                        parse_quote! {
                            #enum_name::#variant { #args } => { 
                                let result = #arg_name.#method_name(#args deps)?;

                                cosmwasm_std::to_binary(&result)
                            }
                        }
                    );
                }
            }
        }

        match msg_type {
            MsgType::Handle => {
                for component in self.args.handle_components() {
                    let mod_name = component.mod_ident(true);
                    let ref mod_path = component.path;
                    let impl_struct = component.create_impl_struct();
                    let handle_fn = Ident::new(HANDLE_FN, Span::call_site());

                    match_expr.arms.push(
                        parse_quote!(#enum_name::#mod_name(msg) => #mod_path::#handle_fn(deps, env, msg, #impl_struct))
                    );
                }
            },
            MsgType::Query => {
                for component in self.args.query_components() {
                    let mod_name = component.mod_ident(true);
                    let ref mod_path = component.path;
                    let impl_struct = component.create_impl_struct();
                    let query_fn = Ident::new(QUERY_FN, Span::call_site());

                    match_expr.arms.push(
                        parse_quote!(#enum_name::#mod_name(msg) => #mod_path::#query_fn(deps, msg, #impl_struct))
                    );
                }
            }
        }

        Ok(Expr::Match(match_expr))
    }

    fn generate_entry_points(&self) -> TokenStream {
        if !self.args.is_entry {
            return TokenStream::new();
        }

        let init_fn = Ident::new(INIT_FN, Span::call_site());
        let handle_fn = Ident::new(HANDLE_FN, Span::call_site());
        let query_fn = Ident::new(QUERY_FN, Span::call_site());

        let init_msg_ident = Ident::new(INIT_MSG, Span::call_site());
        let handle_msg_ident = MsgType::Handle.to_ident();
        let query_msg_ident = MsgType::Query.to_ident();

        // If the contract is an impl, the messages are defined in the module of the interface.
        let (init_msg, handle_msg, query_msg): (Path, Path, Path) =
            if let Some(path) = &self.args.interface_path {
                (
                    parse_quote!(#path::#init_msg_ident),
                    parse_quote!(#path::#handle_msg_ident),
                    parse_quote!(#path::#query_msg_ident)
                )
            } else {
                (
                    parse_quote!(super::#init_msg_ident),
                    parse_quote!(super::#handle_msg_ident),
                    parse_quote!(super::#query_msg_ident)
                )
            };

        parse_quote! {
            #[cfg(target_arch = "wasm32")]
            mod wasm {
                use super::cosmwasm_std::{
                    do_handle, do_init, do_query, ExternalApi, ExternalQuerier, ExternalStorage,
                    to_binary, StdResult, InitResponse, HandleResponse, Storage, Api, Querier,
                    Extern, Env, Binary
                };

                fn entry_init<S: Storage, A: Api, Q: Querier>(
                    deps: &mut Extern<S, A, Q>,
                    env: Env,
                    msg: #init_msg,
                ) -> StdResult<InitResponse> {
                    super::#init_fn(deps, env, msg, super::DefaultImpl)
                }

                fn entry_handle<S: Storage, A: Api, Q: Querier>(
                    deps: &mut Extern<S, A, Q>,
                    env: Env,
                    msg: #handle_msg,
                ) -> StdResult<HandleResponse> {
                    super::#handle_fn(deps, env, msg, super::DefaultImpl)
                }

                fn entry_query<S: Storage, A: Api, Q: Querier>(
                    deps: &Extern<S, A, Q>,
                    msg: #query_msg
                ) -> StdResult<Binary> {
                    super::#query_fn(deps, msg, super::DefaultImpl)
                }

                #[no_mangle]
                extern "C" fn init(env_ptr: u32, msg_ptr: u32) -> u32 {
                    do_init(
                        &entry_init::<ExternalStorage, ExternalApi, ExternalQuerier>,
                        env_ptr,
                        msg_ptr,
                    )
                }

                #[no_mangle]
                extern "C" fn handle(env_ptr: u32, msg_ptr: u32) -> u32 {
                    do_handle(
                        &entry_handle::<ExternalStorage, ExternalApi, ExternalQuerier>,
                        env_ptr,
                        msg_ptr,
                    )
                }

                #[no_mangle]
                extern "C" fn query(msg_ptr: u32) -> u32 {
                    do_query(
                        &entry_query::<ExternalStorage, ExternalApi, ExternalQuerier>,
                        msg_ptr,
                    )
                }

                // Other C externs like cosmwasm_vm_version_1, allocate, deallocate are available
                // automatically because we `use cosmwasm_std`.
            }
        }
    }
}

impl ContractType {
    #[inline]
    pub fn is_impl(self) -> bool {
        matches!(self, ContractType::Impl)
    }

    #[inline]
    pub fn is_interface(self) -> bool {
        matches!(self, ContractType::Interface)
    }
}

fn extract_fields(method: &TraitItemMethod, vis: Visibility) -> syn::Result<FieldsNamed> {
    let mut fields = FieldsNamed {
        brace_token: Brace(Span::call_site()),
        named: Punctuated::<Field, Comma>::default()
    };

    for arg in method.sig.inputs.iter() {
        match arg {
            FnArg::Typed(pat_type) => {
                let ident = require_pat_ident(*pat_type.pat.to_owned())?;

                fields.named.push(Field {
                    attrs: vec![],
                    vis: vis.clone(),
                    ident: Some(ident),
                    ty: *pat_type.ty.to_owned(),
                    colon_token: Some(Colon(Span::call_site()))
                });
            },
            FnArg::Receiver(_) => {
                return Err(syn::Error::new(arg.span(), "Method definition cannot contain \"self\""));
            }
        }
    }

    Ok(fields)
}

fn validate_method(
    method: &TraitItemMethod,
    expected: Option<Type>,
    contract_type: ContractType
) -> syn::Result<()> {
    match contract_type {
        ContractType::Interface => {
            if method.default.is_some() {
                return Err(syn::Error::new(
                    method.span(),
                    format!("Contract interface method cannot contain a default implementation: \"{}\".", method.sig.ident)
                ));
            }
        }
        _ => {
            if method.default.is_none() {
                return Err(syn::Error::new(
                    method.span(),
                    format!("Contract method must contain a default implementation: \"{}\".", method.sig.ident)
                ));
            }
        }
    }

    cmp_return_type(&method.sig.output, expected)
}

fn cmp_return_type(
    return_ty: &ReturnType,
    expected: Option<Type>
) -> syn::Result<()> {
    if let ReturnType::Type(_, return_type) = return_ty {
        if let Type::Path(return_type_path) = return_type.as_ref() {
            if return_type_path.qself.is_some() {
                return Err(syn::Error::new(return_type_path.span(), "Unexpected \"Self\" in return type."));
            }

            let last = return_type_path.path.segments.last().unwrap();
            
            // Check that the return type is StdResult
            if last.ident.to_string().as_str() == "StdResult" {
                // If it is, unwrap the generic argument.
                if let PathArguments::AngleBracketed(args) = &last.arguments {
                    if let GenericArgument::Type(generic_ty) =  &args.args[0] {
                        // If we are not expecting a particular type, we are good to go.
                        if let Some(expected) = expected {
                            if match &expected {
                                // Compare just the type, excluding module paths if any.
                                Type::Path(expected_path) => {
                                    if let Type::Path(given_path) = generic_ty {
                                        let ref given = given_path.path.segments.last().unwrap().ident;
                                        let ref expected = expected_path.path.segments.last().unwrap().ident;
    
                                        given == expected
                                    } else {
                                        false
                                    }
                                },
                                // StdResult<()> will match this.
                                Type::Tuple(_) => expected == *generic_ty,
                                _ => unreachable!()
                            } {
                                return Ok(());
                            }

                            let expected_type = format!("{}", quote!{ #expected });
                    
                            return Err(syn::Error::new(
                                generic_ty.span(),
                                format!("Expecting return type: StdResult<{}>", expected_type)
                            ));
                        }

                        return Ok(());
                    }
                }
            }
        }
    }

    Err(syn::Error::new(return_ty.span(), "Expecting return type: StdResult<T>."))
}

fn extract_fn_arg_ident(arg: &FnArg) -> syn::Result<Ident> {
    match arg {
        FnArg::Typed(pat_type) => {
            require_pat_ident(*pat_type.pat.to_owned())
        },
        FnArg::Receiver(_) => Err(syn::Error::new(arg.span(), "Method definition cannot contain \"self\"."))
    }
}

fn require_pat_ident(pat: Pat) -> syn::Result<Ident> {
    if let Pat::Ident(pat_ident) = pat {
        // Strip leading underscores because we might want to include a field in the 
        // generated message, but not actually use it in the impl. A very rare case,
        // but it is used in the SNIP-20 implementation ('padding' field), for example.
        let name = pat_ident.ident.to_string();
        let name = name.trim_start_matches('_');

        Ok(Ident::new(name, pat_ident.ident.span()))
    } else {
        return Err(syn::Error::new(pat.span(), "Expected identifier."));
    }
}
