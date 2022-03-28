use syn::{
    Result,
    parse::{Parse, ParseBuffer, ParseStream},
    Token, token::Brace,
    braced,
    Path, Ident, Generics,
    Attribute, Meta,
    ImplItem,
    Visibility,
    TraitItem, TraitItemConst, TraitItemMethod, TraitItemType, TraitItemMacro
};

use crate::model::*;

/// Parses the `pub trait Something` sequence
/// with which each Contract or Component trait begins.
/// Return the trait name and any extra generics specified
/// (besides the implicit S, A, Q).
fn parse_trait_head (input: &ParseBuffer) -> Result<(Ident, Option<Generics>)> {
    let _ = input.call(Visibility::parse);
    let _ = input.call(<Token![trait]>::parse);
    let name = input.call(Ident::parse)?;
    let generics = if input.peek(Token![<]) {
        Some(input.call(Generics::parse)?)
    } else {
        None
    };
    Ok((name, generics))
}

fn parse_trait_body (input: &ParseBuffer) -> Result<Vec<Clause>> {
    let mut clauses = vec![];
    if input.peek(Brace) {
        let body;
        let _ = braced!(body in input);
        if !input.is_empty() {
            return err_trailing(&input);
        }
        loop {
            println!("\n{}", &body);
            if body.is_empty() {
                break
            }
            if body.peek(Token![#]) {
                // get all outer attributes starting with this # token
                let attrs = body.call(Attribute::parse_outer)?;
                let last  = attrs.len() - 1;
                println!("attrs = {:?}", &attrs);
                // parse attribute sequence
                for (index, attr) in attrs.iter().enumerate() {
                    // make sure only the last attribute is magic
                    if index < last && is_magic(attr) {
                        return err_early_magic_attr(&body);
                    }
                    // if last attribute is not magic,
                    // pass the item and its attributes as-is
                    if index == last && !is_magic(attr) {
                        clauses.push(parse_non_magic_item(attrs.clone(), &body)?);
                        continue
                    }
                }
                // if last attribute is magic, handle it
                clauses.push(parse_magic_item(attrs, &body)?);
            } else {
                clauses.push(parse_non_magic_item(vec![], &body)?)
            }
        }
    }
    Ok(clauses)
}

/// Check if this attribute is one of the magic attributeds defined in CLAUSES
fn is_magic (attr: &Attribute) -> bool {
    if let Ok(Meta::Path(path)) = attr.parse_meta() {
        if let Some(ident) = path.get_ident() {
            let s = ident.to_string();
            for magic in CLAUSES.iter() {
                if s == *magic {
                    return true
                }
            }
        }
    }
    false
}

fn parse_non_magic_item (attrs: Vec<Attribute>, body: &ParseBuffer) -> Result<Clause> {
    let trait_item;
    if let Ok(item) = body.call(TraitItemConst::parse) {
        trait_item = TraitItem::Const(item);
    } else if let Ok(item) = body.call(TraitItemMethod::parse) {
        trait_item = TraitItem::Method(item);
    } else if let Ok(item) = body.call(TraitItemType::parse) {
        trait_item = TraitItem::Type(item);
    } else if let Ok(item) = body.call(TraitItemMacro::parse) {
        trait_item = TraitItem::Macro(item);
    } else {
        return err_invalid_trait_item(body);
    }
    Ok(Clause::Item((trait_item, attrs)))
}

fn parse_magic_item (mut attrs: Vec<Attribute>, body: &ParseBuffer) -> Result<Clause> {
    // get the magic attr
    if let Some(magic_attr) = attrs.pop() {
        if let Ok(Meta::Path(path)) = magic_attr.parse_meta() {
            if let Some(ident) = path.get_ident() {
                match ident.to_string().as_str() {
                    "compose" => {
                        let path  = body.call(Path::parse)?;
                        let items = collect_impl_items(body)?;
                        return Ok(Clause::Compose(((path, items), attrs)))
                    }
                    "init" => {
                        let method = body.call(TraitItemMethod::parse)?;
                        return Ok(Clause::Init((method, attrs)))
                    }
                    "handle" => {
                        let method = body.call(TraitItemMethod::parse)?;
                        return Ok(Clause::Handle((method, attrs)))
                    }
                    "query" => {
                        let method = body.call(TraitItemMethod::parse)?;
                        return Ok(Clause::Query((method, attrs)))
                    }
                    _ => unreachable!()
                }
            }
        }
    }
    unreachable!();
}

/// Collect all items from the optional body of a #[compose] clause.
/// These are used to override Component trait defaults when composing a Contract.
fn collect_impl_items (body: &ParseBuffer) -> Result<Vec<ImplItem>> {
    let mut items = vec![];
    if body.peek(Brace) {
        let override_body;
        let _ = braced!(override_body in body);
        loop {
            if override_body.is_empty() {
                break
            }
            items.push(override_body.call(ImplItem::parse)?);
        }
    }
    Ok(items)
}

impl Parse for Contract {
    fn parse (input: ParseStream) -> Result<Self> {
        // parse contract head (`pub trait MyContract`)
        let (name, generics) = parse_trait_head(&input)?;
        let clauses = parse_trait_body(&input)?;
        // create an empty Contract scaffold
        let mut contract = Contract {
            name,
            generics,
            regulars:        vec![],
            components:      vec![],
            custom_init:     None,
            extra_handles:   vec![],
            extra_queries:   vec![],
        };
        // populate it with the implementation specified by the clauses
        for clause in clauses.into_iter() {
            match clause {
                Clause::Item(item)         => contract.regulars.push(item),
                Clause::Compose(component) => contract.components.push(component),
                Clause::Init(method)       => contract.custom_init = Some(method),
                Clause::Handle(method)     => contract.extra_handles.push(method),
                Clause::Query(method)      => contract.extra_queries.push(method)
            }
        }
        Ok(contract)
    }
}

impl Parse for Component {
    fn parse (input: ParseStream) -> Result<Self> {
        // parse component head (`pub trait MyComponent`)
        let (name, generics) = parse_trait_head(&input)?;
        let clauses = parse_trait_body(&input)?;
        // create an empty Component scaffold
        let mut component = Component {
            name,
            generics,
            regulars:     vec![],
            dependencies: vec![],
            init:         None, // default init method for a component is a no-op
            handles:      vec![],
            queries:      vec![],
        };
        // populate it with the implementation specified by the clauses
        for clause in clauses.into_iter() {
            match clause {
                Clause::Item(item)          => component.regulars.push(item),
                Clause::Compose(dependency) => component.dependencies.push(dependency),
                Clause::Init(method)        => component.init = Some(method),
                Clause::Handle(method)      => component.handles.push(method),
                Clause::Query(method)       => component.queries.push(method)
            }
        }
        Ok(component)
    }
}
