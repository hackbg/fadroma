use std::collections::HashMap;

use syn::{
    Path, NestedMeta, Meta, AttributeArgs,
    Lit, LitStr, PathArguments, MetaNameValue,
    Ident, Variant, parse_quote
};
use syn::token::Comma;
use syn::punctuated::Punctuated;
use syn::parse::Parse;
use syn::spanned::Spanned;
use proc_macro2::Span;

use crate::contract::{DEFAULT_IMPL_STRUCT, ContractType};
use crate::utils::to_pascal;

pub struct ContractArgs {
    pub is_entry: bool,
    components: Vec<Component>,
    interface_path: Option<Path>
}

pub struct Component {
    pub path: Path,
    custom_impl: Option<Path>,
    skip_handle: bool,
    skip_query: bool,
}

struct MetaNameValueParser {
    entries: HashMap<String, LitStr>
}

impl ContractArgs {
    pub fn parse(args: AttributeArgs, ty: ContractType) -> syn::Result<Self> {
        let mut components = vec![];
        let mut parser = MetaNameValueParser::new();
        let mut is_entry = false;

        for arg in args {
            if let NestedMeta::Meta(meta) = arg {
                match meta {
                    Meta::List(list) => {
                        let segment = list.path.segments.first().unwrap();
                        let name = segment.ident.to_string();

                        if name == "component" {
                            components.push(Component::parse(list.nested, ty)?)
                        } else {
                            return Err(syn::Error::new(
                                segment.span(),
                                format!("Unexpected attribute: \"{}\"", name)
                            ));
                        }
                    },
                    Meta::NameValue(name_val) if ty.is_impl() => {
                        parser.parse(name_val)?;
                    }
                    Meta::Path(path) if !ty.is_interface() => {
                        let segment = path.segments.first().unwrap();
                        let name = segment.ident.to_string();

                        if name.as_str() == "entry" {
                            is_entry = true;
                        } else {
                            return Err(syn::Error::new(
                                segment.span(),
                                format!("Unexpected attribute: \"{}\"", name)
                            ));
                        }
                    },
                    _ => {
                        return Err(syn::Error::new(meta.span(), "Unexpected meta attribute."));
                    }
                }
            } else {
                return Err(syn::Error::new(arg.span(), "Unexpected literal in \"contract\" attribute."));
            }
        }

        let interface_path = if ty.is_impl() {
            Some(parser.require("path")?)
        } else {
            None
        };

        parser.finalize()?;

        Ok(Self {
            components,
            interface_path,
            is_entry
        })
    }

    pub fn handle_components(&self) -> impl Iterator<Item = &Component> {
        self.components.iter().filter(|x| !x.skip_handle)
    }

    pub fn query_components(&self) -> impl Iterator<Item = &Component> {
        self.components.iter().filter(|x| !x.skip_query)
    }

    pub fn interface_path_concat(&self, ident: &Ident) -> Path {
        if let Some(path) = &self.interface_path {
            return parse_quote!(#path::#ident);
        }

        parse_quote!(#ident)
    }
}

impl Component {
    pub fn parse(nested: Punctuated<NestedMeta, Comma>, ty: ContractType) -> syn::Result<Self> {
        let mut skip_handle = false;
        let mut skip_query = false;

        let mut parser = MetaNameValueParser::new();

        for entry in nested {
            match entry {
                NestedMeta::Meta(meta) => {
                    match meta {
                        Meta::NameValue(name_val) => {
                            parser.parse(name_val)?;
                        },
                        Meta::List(list) => {
                            let name = extract_path_ident_name(&list.path)?;

                            match name.as_str() {
                                "skip" => {
                                    for arg in list.nested {
                                        if let NestedMeta::Meta(meta) = arg {
                                            if let Meta::Path(skip_arg) = meta {
                                                let skipable = extract_path_ident_name(&skip_arg)?;

                                                match skipable.as_str() {
                                                    "handle" => skip_handle = true,
                                                    "query" => skip_query = true,
                                                    _ =>{
                                                        return Err(syn::Error::new(
                                                            skip_arg.span(),
                                                            format!("Unexpected argument in \"skip\" attribute: \"{}\"", skipable)
                                                        ));
                                                    }
                                                }
                                            }
                                        }
                                    }
                                },
                                _ =>{
                                    return Err(syn::Error::new(
                                        list.span(),
                                        format!("Unexpected attribute: \"{}\"", name)
                                    ));
                                }
                            }
                        },
                        Meta::Path(path) => {
                            return Err(syn::Error::new(path.span(), "Unexpected meta path in attribute."));
                        }
                    }
                },
                NestedMeta::Lit(lit) =>{
                    return Err(syn::Error::new(lit.span(), "Unexpected literal in attribute."));
                }
            }
        }

        let path = parser.require("path")?;
        let custom_impl = parser.get("custom_impl")?;

        if ty.is_interface() && custom_impl.is_some() {
            return Err(syn::Error::new(
                Span::call_site(),
                "Interfaces cannot have the \"custom_impl\" attribute. Specify this on the implementing trait instead.")
            );
        }

        parser.finalize()?;

        Ok(Self {
            path,
            custom_impl,
            skip_handle,
            skip_query
        })
    }

    pub fn path_concat(&self, ident: &Ident) -> Path {
        let ref path = self.path;

        parse_quote!(#path::#ident)
    }

    pub fn create_impl_struct(&self) -> Path {
        if let Some(custom_impl) = &self.custom_impl {
            return parse_quote!(#custom_impl);
        }

        let ref path = self.path;
        let default = Ident::new(DEFAULT_IMPL_STRUCT, Span::call_site());
        
        parse_quote!(#path::#default)
    }

    pub fn create_enum_variant(&self, msg_name: &'static str) -> Variant {
        let mod_ident = self.mod_ident(true);
        let msg_path = self.path_concat(&Ident::new(msg_name, Span::call_site()));

        parse_quote!(#mod_ident(#msg_path))
    }

    pub fn mod_ident(&self, pascal_case: bool) -> Ident {
        let ident = self.path.segments.last().unwrap().ident.clone();

        if pascal_case {
            return Ident::new(&to_pascal(&ident.to_string()), Span::call_site());
        }

        ident
    }
}

impl MetaNameValueParser {
    pub fn new() -> Self {
        Self {
            entries: HashMap::new()
        }
    }

    pub fn parse(&mut self, name_val: MetaNameValue) -> syn::Result<()> {
        let name = extract_path_ident_name(&name_val.path)?;

        match name_val.lit {
            Lit::Str(val) => {
                if self.entries.contains_key(&name) {
                    return Err(syn::Error::new(
                        val.span(),
                        format!("Duplicate \"{}\" attribute.", name)
                    ));
                }

                self.entries.insert(name, val);
            },
            _ => {
                return Err(syn::Error::new(
                    name_val.span(),
                    format!("Expected string literal for \"{}\".", name)
                ));
            }
        }

        Ok(())
    }

    pub fn require<T: Parse>(&mut self, name: &str) -> syn::Result<T> {
        if let Some(value) = self.entries.remove(name) {
            value.parse()
        } else {
            Err(syn::Error::new(
                Span::call_site(), 
                format!("Expected attribute: \"{}\"", name)
            ))
        }
    }

    pub fn get<T: Parse>(&mut self, name: &str) -> syn::Result<Option<T>> {
        if let Some(value) = self.entries.remove(name) {
            value.parse().map(|x| Some(x))
        } else {
            Ok(None)
        }
    }

    pub fn finalize(mut self) -> syn::Result<()> {
        if self.entries.len() > 0 {
            let unexpected: Vec<String> = self.entries.drain().map(|x| x.0).collect();

            return Err(syn::Error::new(
                Span::call_site(),
                format!("Unexpected atrributes: {}", unexpected.join(", "))
            ));
        }

        Ok(())
    }
}

fn extract_path_ident_name(path: &Path) -> syn::Result<String> {
    if path.segments.len() != 1 {
        return Err(syn::Error::new(path.span(), "Single path element expected."));
    }

    let name = path.segments.first().unwrap();

    if name.arguments != PathArguments::None {
        return Err(syn::Error::new(path.span(), "Unexpected path arguments."));
    }

    Ok(name.ident.to_string())
}
