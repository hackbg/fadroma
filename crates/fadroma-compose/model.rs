use syn::{
    Result, parse::ParseBuffer,
    Ident, Path, Generics, Attribute, ImplItem,
    TraitItem, TraitItemMethod
};

type Annotated<T> = (T, Vec<Attribute>);

/// Represents a component that is composed into the contract trait.
type Composition = Annotated<(Path, Vec<ImplItem>)>;

/// Represents a pairing between an API message definition
/// and the corresponding handler code.
type Method = Annotated<TraitItemMethod>;

/// Represents a regular, non-magic trait item with its attributes
type Regular = Annotated<TraitItem>;

/// Represents the parameters of the composed contract trait.
pub struct Contract {
    pub name:          Ident,
    pub generics:      Option<Generics>,
    pub regulars:      Vec<Regular>,
    pub components:    Vec<Composition>,
    pub custom_init:   Option<Method>,
    pub extra_handles: Vec<Method>,
    pub extra_queries: Vec<Method>,
}

/// Internal representation of the parameters of the component traits.
pub struct Component {
    pub name:         Ident,
    pub generics:     Option<Generics>,
    pub regulars:     Vec<Regular>,
    pub dependencies: Vec<Composition>,
    pub init:         Option<Method>,
    pub handles:      Vec<Method>,
    pub queries:      Vec<Method>,
}

/// List of valid magic attribute names.
pub const CLAUSES: [&str; 4] = [ "compose", "init", "handle", "query" ];

pub enum Clause {
    /// `#[compose]`: 
    /// * in contract: plugs a component into the composed contract
    /// * in component: makes the component depend on another component
    Compose(Composition),
    /// `#[init]`:
    /// * in contract: overrides the auto-generated init with custom code
    /// * in component: defines the component's init procedure
    Init(Method),
    /// `#[handle]` defines a handle message/method
    Handle(Method),
    /// `#[query]` defines a query message/method
    Query(Method),
    /// A regular, non-magic trait item, copied verbatim
    Item(Regular)
}

pub fn err_trailing <T> (input: &ParseBuffer) -> Result<T> {
    return Err(input.error(
        "Trailing tokens after macro"
    ))
}

pub fn err_invalid_section <T> (input: &ParseBuffer) -> Result<T> {
    return Err(input.error(concat!(
        "Each section of the #[contract] input should begin",
        " with #[init], #[supports], or #[extra(...)]"
    )))
}

pub fn err_invalid_trait_item <T> (input: &ParseBuffer) -> Result<T> {
    return Err(input.error("Invalid trait item"))
}

pub fn err_extra <T> (input: &ParseBuffer) -> Result<T> {
    return Err(input.error(concat!(
        "only #[extra(Handle)], #[extra(Query)] or #[extra(Response)]",
        " supported at this position"
    )))
}

pub fn err_unsupported_attributes <T> (input: &ParseBuffer) -> Result<T> {
    return Err(input.error(
        "Supported attributes here are #[compose], #[init], #[handle], #[query]"
    ))
}

pub fn err_duplicate_init <T> (input: &ParseBuffer) -> Result<T> {
    return Err(input.error("Only one #[init] clause is allowed."))
}

pub fn err_early_magic_attr <T> (input: &ParseBuffer) -> Result<T> {
    return Err(input.error("The magic attribute must follow any other attributes"))
}
