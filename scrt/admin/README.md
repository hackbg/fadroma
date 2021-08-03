# Fadroma Admin Authentication for Secret Network (composable-admin)

Composable and configurable admin functionality
that can be added to an existing Secret Network smart contract.

## Setup

1. Choose one of the two implementations
   and add its handle and query messages
   to yours as an enum variant with a payload.
2. Call the handle and query functions
   of the selected implementation
   inside your match statements
   in the respective functions.
   Pass `DefaultHandleImpl`/`DefaultQueryImpl` as a parameter
   if you want the default method implementations.
3. (Optional) The `#[require_admin]` attribute
   (found in the root of the crate) is provided
   which can be used to annotate functions
   that require an admin sender.
   The "derive" feature (which is enabled by default) is required for this.
 
## Customization

If you want to change the implementation of any of the methods,
simply create a zero-sized struct and implement the trait(s)
in your chosen implementation.

Since all the methods are implemented as trait defaults,
it is possible to override only the desired methods in your `impl`.

Then in step 2 above, pass your struct instead of `DefaultHandleImpl`/`DefaultQueryImpl`.
