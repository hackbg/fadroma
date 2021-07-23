//! Macros are truly a blessing in the disguise of a curse.
//!
//! * `attempted to repeat an expression containing no syntax variables matched
//!   as repeating at this depth` - best error message ever.
//! * or `this file contains an unclosed delimiter` (but it already
//!   optimized away that info by design so now we don't know where)
//! * or `repetition matches empty token tree` - jeez rustc, are you
//!   gonna loop back on yourself if you do that?!

/// A binding that exposes the default CosmWasm entry points.
/// This lets you compile a WASM contract to a form that runs on a
/// SecretNetwork blockchain.
#[macro_export] macro_rules! bind_chain {
    ($mod:ident /* module that exports your init, handle and query functions */) => {
        /// WASM entry points for running on chain.
        // Similar in spirit to [`create_entry_points`](https://docs.rs/cosmwasm-std/0.10.1/src/cosmwasm_std/entry_points.rs.html#49),
        // but doesn't need the implementation to be in a sibling module (the `super::contract` on L65)
        // TODO custom `migrate` for SecretNetwork
        mod wasm {
            use fadroma::scrt::cosmwasm_std::{
                ExternalStorage as Storage, ExternalApi as Api, ExternalQuerier as Querier,
                do_init, do_handle, do_query
            };
            #[no_mangle] extern "C" fn init (env_ptr: u32, msg_ptr: u32) -> u32 {
                do_init($mod::init::<Storage, Api, Querier>, env_ptr, msg_ptr)
            }
            #[no_mangle] extern "C" fn handle (env_ptr: u32, msg_ptr: u32) -> u32 {
                do_handle($mod::handle::<Storage, Api, Querier>, env_ptr, msg_ptr)
            }
            #[no_mangle] extern "C" fn query (msg_ptr: u32) -> u32 {
                do_query($mod::query::<Storage, Api, Querier>, msg_ptr,)
            }
            // Other C externs like cosmwasm_vm_version_1, allocate, deallocate are available
            // automatically because we `use cosmwasm_std`.
        }
    }
}

/// λ binding that exposes one or more wrapped Rust structs to JavaScript.
/// This lets you load a WASM contract in a browser and talk to it from JS.
///
/// Rust doesn't allow for monkey-patching
/// (we can't impl things on things that we don't own),
/// so we need to wrap each struct from the Rust API
/// in our own locally defined struct and expose that to wasm_bindgen.
///
/// From JS-land, the wrapped struct looks like an object
/// containing an opaque pointer to JS memory.
/// This macro also supports adding methods to the binding,
/// which methods will be exposed on the JS object.
#[macro_export] macro_rules! bind_js {

    // Entry point - generates module with all bindings
    // Arguments are methods and corresponding request/response types
    (
        $mod:ident,    /* module that exports your init, handle and query functions */
        $Init:path,    /* name of your init message struct */
        $TX:path,      /* name of your tx handle message enum */
        $Q:path,       /* name of your query message enum */
        $Response:path /* name of your query response enum */
    ) => {

        /// WASM entry points for running in browser with stub chain
        mod wasm {

            use wasm_bindgen::prelude::{wasm_bindgen, JsValue};
            use fadroma::scrt::cosmwasm_std as cw;

            // but a macro with a recursive dependency on itself? no problem
            use fadroma::scrt::contract::bind_js;

            #[derive(Copy, Clone)] pub struct Api;
            impl cw::Api for Api {
                fn canonical_address (&self, addr: &cw::HumanAddr) -> cw::StdResult<cw::CanonicalAddr> {
                    Ok(cw::CanonicalAddr(cw::Binary(Vec::from(addr.as_str()))))
                }
                fn human_address (&self, addr: &cw::CanonicalAddr) -> cw::StdResult<cw::HumanAddr> {
                    let trimmed: Vec<u8> = addr.as_slice().iter().cloned()
                        .filter(|&x| x != 0).collect();
                    // decode UTF-8 bytes into string
                    Ok(cw::HumanAddr(String::from_utf8(trimmed)
                        .map_err(cw::StdError::invalid_utf8)?))
                }
            }

            pub struct Querier {
                pub next_response: Option<cw::Binary>
            }

            impl cw::Querier for Querier {
                fn raw_query (&self, bin_request: &[u8]) -> cw::QuerierResult {
                    let response = self.next_response.clone().unwrap();
                    Ok(Ok(response))
                }
            }

            bind_js! {

                Env(cw::Env) {
                    #[wasm_bindgen(constructor)] fn new (height: u64) -> Env {
                        Ok(Env(cw::Env {
                            block: cw::BlockInfo {
                                height,
                                time: height * 5,
                                chain_id: "".into()
                            },
                            message: cw::MessageInfo {
                                sender:     cw::HumanAddr::from(""),
                                sent_funds: vec![]
                            },
                            contract: cw::ContractInfo {
                                address: cw::HumanAddr::from("")
                            },
                            contract_key: Some("".into()),
                            contract_code_hash: "".into()
                        }))
                    }
                }

                Contract(cw::Extern<cw::MemoryStorage, Api, Querier> /* ha! */) {
                    #[wasm_bindgen(constructor)] fn new () -> Contract {
                        Ok(Self(cw::Extern {
                            storage:  cw::MemoryStorage::default(),
                            querier:  Querier { next_response: None },
                            api:      Api {},
                        }))
                    }

                    #[wasm_bindgen(setter)]
                    fn set_next_query_response (&mut self, response: &[u8]) -> () {
                        self.0.querier.next_response = Some(response.into());
                        Ok(())
                    }

                    fn init (&mut self, env: Env, msg: &[u8]) -> Vec<u8> {
                        match cw::from_slice(msg) {
                            Err(e)  => Err(e.into()),
                            Ok(msg) => match $mod::init(&mut self.0, env.0, msg) {
                                Err(e)  => Err(e.into()),
                                Ok(res) => match cw::to_vec(&res) {
                                    Err(e)  => Err(e.into()),
                                    Ok(vec) => Ok(vec)
                                }
                            }
                        }
                    }
                    fn handle (&mut self, env: Env, msg: &[u8]) -> HandleResponse {
                        match cw::from_slice(msg) {
                            Err(e)  => Err(e.into()),
                            Ok(msg) => $mod::handle(&mut self.0, env.0, msg)
                                .map(|res|HandleResponse(res))
                        }
                    }
                    fn query (&self, msg: &[u8]) -> QueryResponse {
                        match cw::from_slice(msg) {
                            Err(e)  => Err(e.into()),
                            Ok(msg) => match $mod::query(&self.0, msg) {
                                Ok(res) => cw::from_binary(&res).map(|res|QueryResponse(res)),
                                Err(e) => Err(e)
                            }
                        }
                    }
                }

                HandleResponse(cw::HandleResponse) {
                    #[wasm_bindgen(getter)] fn json (&self) -> Vec<u8> {
                        cw::to_vec(&self.0)
                    }
                }

                QueryResponse($Response) {
                    #[wasm_bindgen(constructor)] fn new (json: &[u8]) -> QueryResponse {
                        cw::from_slice(json).map(|msg|QueryResponse(msg))
                    }
                    #[wasm_bindgen(getter)] fn json (&self) -> Vec<u8> {
                        cw::to_vec(&self.0)
                    }
                }

            }

        }

    };

    // Subroutine to generate every individual struct that is visible from JS
    // and define its bound methods.
    ( $(
        $struct:ident // the name of the resulting new binding struct
        $fields:tt    // `(cw::WrapAStruct)` or `{define: Custom, fields: Innit}`

        $({ // if there are any functions defined below
        $(  // each one will be implemented on the new struct

            // 1.             2.             3.               4.           5.
            $(#[$meta:meta])* fn $name:ident ($($args:tt)*) -> $returns:ty $body:block

            // 1. allows attribute macros such as doc strings to pass through
            // 2. `pub` will be added automatically
            // 3. positional arguments of bound function (&self, bla, bla...)
            // 4. the actual return type of the generated function is Result<$returns, JsValue>
            // 5. but the $body must return `Result<$returns, StdError>`, which gets converted to
            //    JsValue via MapErr because we can't implement a conversion trait between two
            //    structs that we do not own

        )+  // end iteration over each input function
        })? // end check for presence of input functions

    )* ) => { $(
        // generate a new struct and derive the wasm_bindgen trait suite for it
        // https://rustwasm.github.io/wasm-bindgen/reference/attributes/on-rust-exports/inspectable.html
        #[wasm_bindgen(inspectable)] pub struct $struct $fields;

        // if there are bound functions wrap em with da `impl` wrapper
        $(#[wasm_bindgen] impl $struct {
            $( // and output each one as a public bound method
            $(#[$meta])* // it's as meta as it gets...
            pub fn $name ($($args)*) -> Result<$returns, JsValue> {
                // single poit of error handling
                $body.map_err(|e: cw::StdError| format!("{:#?}", &e).into())
            })+ // end iteration
        })? // end conditional
    )* };

}
