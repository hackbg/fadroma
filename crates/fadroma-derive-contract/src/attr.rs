/// The init attribute.
pub const INIT: &str = "init";
/// The handle attribute.
pub const HANDLE: &str = "handle";
/// The query attribute.
pub const QUERY: &str = "query";
/// The handle_guard attribute.
pub const HANDLE_GUARD: &str = "handle_guard";

/// Used to include another contract' interface.
/// Requires a at least a "path" argument specified.
pub const COMPONENT: &str = "component";
/// Used to signal that WASM entry points should
/// be generated for the current contract.
pub const ENTRY: &str = "entry";
/// A path to some type or namespace.
pub const PATH: &str = "path";
/// Used in the component attribute to not
/// include the handle/query of the component.
pub const SKIP: &str = "skip";
/// Used to provide a custom implementation of a component
/// instead of using the auto generated default trait impl.
pub const CUSTOM_IMPL: &str = "custom_impl";
